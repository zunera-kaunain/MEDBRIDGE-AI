"""Shared test setup.

Tests never touch the real MongoDB Atlas database: every test gets a fresh
in-memory fake (mongomock) swapped in for the app's database handle. The
password-reset email is captured instead of sent, and the in-memory rate
limiter is reset so tests cannot affect each other.
"""

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

import database
from utils import rate_limit


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    client = AsyncMongoMockClient(tz_aware=True)
    monkeypatch.setattr(database, "_client", client)
    monkeypatch.setattr(database, "_db", client["medbridge_test"])
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


@pytest.fixture
def sent_emails(monkeypatch):
    """Collects (to, subject, body) instead of sending real email."""
    outbox: list[tuple[str, str, str]] = []

    def fake_send(to, subject, body):
        outbox.append((to, subject, body))

    from routers import password_reset

    monkeypatch.setattr(password_reset, "send_email", fake_send)
    return outbox


@pytest.fixture
async def client():
    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


PASSWORD = "CorrectHorse#1"

PROFILE = {
    "qualification": "MBBS",
    "specialization": "General Medicine",
    "registration_number": "KMC-TEST-1",
    "state_medical_council": "Karnataka Medical Council",
    "year_of_registration": 2015,
}


async def make_doctor(client, email="doc@example.com", complete_profile=True):
    """Registers a doctor and returns (auth headers, doctor dict)."""
    r = await client.post(
        "/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Dr Test"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    if complete_profile:
        p = await client.post("/api/doctor/profile", json=PROFILE, headers=headers)
        assert p.status_code == 200, p.text
    return headers, body["doctor"]


async def make_patient(client, headers, name="Asha Patient"):
    r = await client.post(
        "/api/patients",
        json={
            "full_name": name,
            "age": 40,
            "gender": "female",
            "phone": "9999999999",
            "preferred_language": "en",
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()
