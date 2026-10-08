"""Sign-in, password reset, rate limiting, account deletion, data isolation
and the audit log. Run from the backend folder with:  python -m pytest
"""

import asyncio
import re

from tests.conftest import PASSWORD, make_doctor, make_patient


# ---------------------------------------------------------------- sign-in

async def test_register_login_and_me(client):
    headers, doctor = await make_doctor(client)
    me = await client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "doc@example.com"

    login = await client.post(
        "/auth/login", json={"email": "doc@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
    assert "access_token" in login.json()


async def test_wrong_password_is_rejected(client):
    await make_doctor(client)
    r = await client.post(
        "/auth/login", json={"email": "doc@example.com", "password": "nope-nope-1"}
    )
    assert r.status_code == 401


async def test_protected_routes_need_a_valid_token(client):
    assert (await client.get("/auth/me")).status_code == 401
    bad = {"Authorization": "Bearer not.a.token"}
    r = await client.get("/api/patients", headers=bad)
    assert r.status_code == 401
    assert r.json()["detail"] == "Not authenticated"


async def test_receptionist_token_cannot_use_doctor_routes(client):
    r = await client.post(
        "/auth/receptionist/register",
        json={"full_name": "Front Desk", "email": "fd@example.com", "password": PASSWORD},
    )
    assert r.status_code == 201, r.text
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert (await client.get("/api/patients", headers=headers)).status_code in (401, 403)


# ----------------------------------------------------------- rate limiting

async def test_login_is_blocked_after_too_many_attempts(client):
    await make_doctor(client)
    codes = []
    for _ in range(10):
        r = await client.post(
            "/auth/login", json={"email": "doc@example.com", "password": "wrong-pass-1"}
        )
        codes.append(r.status_code)
    assert codes[:8] == [401] * 8
    assert 429 in codes[8:]


async def test_blocked_response_tells_client_when_to_retry(client):
    await make_doctor(client)
    last = None
    for _ in range(10):
        last = await client.post(
            "/auth/login", json={"email": "doc@example.com", "password": "wrong-pass-1"}
        )
    assert last.status_code == 429
    assert int(last.headers["Retry-After"]) > 0


# ---------------------------------------------------------- password reset

def _token_from(body: str) -> str:
    match = re.search(r"reset-password\?token=([\w\-]+)", body)
    assert match, body
    return match.group(1)


async def test_password_reset_flow_and_single_use(client, sent_emails):
    await make_doctor(client)

    r = await client.post(
        "/auth/forgot-password", json={"email": "doc@example.com", "role": "doctor"}
    )
    assert r.status_code == 200
    assert len(sent_emails) == 1
    token = _token_from(sent_emails[0][2])

    new_password = "BrandNewPass#2"
    done = await client.post(
        "/auth/reset-password", json={"token": token, "new_password": new_password}
    )
    assert done.status_code == 200

    ok = await client.post(
        "/auth/login", json={"email": "doc@example.com", "password": new_password}
    )
    assert ok.status_code == 200
    old = await client.post(
        "/auth/login", json={"email": "doc@example.com", "password": PASSWORD}
    )
    assert old.status_code == 401

    again = await client.post(
        "/auth/reset-password", json={"token": token, "new_password": "AnotherPass#3"}
    )
    assert again.status_code == 400


async def test_forgot_password_does_not_reveal_whether_email_exists(client, sent_emails):
    await make_doctor(client)
    known = await client.post("/auth/forgot-password", json={"email": "doc@example.com"})
    unknown = await client.post("/auth/forgot-password", json={"email": "ghost@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert len(sent_emails) == 1  # only the real account got an email


async def test_reset_token_is_stored_hashed(client, sent_emails):
    import database

    await make_doctor(client)
    await client.post("/auth/forgot-password", json={"email": "doc@example.com"})
    token = _token_from(sent_emails[0][2])
    stored = await database.password_resets().find_one({})
    assert stored is not None
    assert token not in str(stored)


async def test_garbage_reset_token_is_rejected(client):
    r = await client.post(
        "/auth/reset-password", json={"token": "made-up", "new_password": "Whatever#123"}
    )
    assert r.status_code == 400


# --------------------------------------------------- data isolation / delete

async def test_a_doctor_cannot_open_another_doctors_patient(client):
    headers_a, _ = await make_doctor(client, "a@example.com")
    headers_b, _ = await make_doctor(client, "b@example.com")
    patient = await make_patient(client, headers_a)

    mine = await client.get(f"/api/patients/{patient['id']}", headers=headers_a)
    theirs = await client.get(f"/api/patients/{patient['id']}", headers=headers_b)
    assert mine.status_code == 200
    assert theirs.status_code in (403, 404)

    listing = await client.get("/api/patients", headers=headers_b)
    assert listing.status_code == 200
    assert listing.json() == []


async def test_delete_account_needs_the_right_password(client):
    headers, _ = await make_doctor(client)
    wrong = await client.request(
        "DELETE", "/auth/me", json={"password": "not-it-at-all"}, headers=headers
    )
    assert wrong.status_code == 401
    assert (await client.get("/auth/me", headers=headers)).status_code == 200


async def test_deleting_a_doctor_removes_their_patients(client):
    import database

    headers, _ = await make_doctor(client)
    await make_patient(client, headers)
    assert await database.patients().count_documents({}) == 1

    gone = await client.request(
        "DELETE", "/auth/me", json={"password": PASSWORD}, headers=headers
    )
    assert gone.status_code == 204
    assert await database.patients().count_documents({}) == 0
    assert await database.doctors().count_documents({}) == 0

    login = await client.post(
        "/auth/login", json={"email": "doc@example.com", "password": PASSWORD}
    )
    assert login.status_code == 401


async def test_deleting_a_receptionist_keeps_the_doctors_patients(client):
    import database

    doc_headers, _ = await make_doctor(client)
    await make_patient(client, doc_headers)
    r = await client.post(
        "/auth/receptionist/register",
        json={"full_name": "Front Desk", "email": "fd@example.com", "password": PASSWORD},
    )
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

    gone = await client.request(
        "DELETE", "/auth/receptionist/me", json={"password": PASSWORD}, headers=headers
    )
    assert gone.status_code == 204
    assert await database.receptionists().count_documents({}) == 0
    assert await database.patients().count_documents({}) == 1


# ---------------------------------------------------------------- audit log

async def test_audit_log_records_actions_but_never_content(client):
    headers, doctor = await make_doctor(client)
    patient = await make_patient(client, headers, name="Secret Name Patient")
    await client.get(f"/api/patients/{patient['id']}", headers=headers)
    await asyncio.sleep(0.2)  # entries are written in the background

    r = await client.get("/api/audit-log", headers=headers)
    assert r.status_code == 200
    entries = r.json()
    assert entries, "expected at least one audit entry"
    assert all(e["actor_id"] == doctor["id"] for e in entries)
    assert any(e["method"] == "GET" and "patients" in e["path"] for e in entries)

    blob = str(entries)
    assert "Secret Name Patient" not in blob
    assert PASSWORD not in blob
    assert "access_token" not in blob


async def test_audit_log_only_shows_your_own_entries(client):
    headers_a, _ = await make_doctor(client, "a@example.com")
    headers_b, doctor_b = await make_doctor(client, "b@example.com")
    await client.get("/api/patients", headers=headers_a)
    await asyncio.sleep(0.2)

    mine = (await client.get("/api/audit-log", headers=headers_b)).json()
    assert all(e["actor_id"] == doctor_b["id"] for e in mine)
