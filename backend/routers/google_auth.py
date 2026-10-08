"""Sign in with Google, for doctors and receptionists.

The browser gets a signed ID token from Google (Google Identity Services)
and posts it here. We ask Google to verify it, check it was issued for OUR
client id and that the email is verified, then find or create the account
and issue our normal JWT. Needs GOOGLE_CLIENT_ID in backend/.env.
"""

from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import database as db
from config import settings
from models.common import AuthProvider
from models.doctor import Doctor, DoctorPublic, TokenResponse
from models.receptionist import (
    Receptionist,
    ReceptionistPublic,
    ReceptionistTokenResponse,
)
from utils.rate_limit import rate_limit
from utils.security import create_access_token

router = APIRouter(prefix="/auth", tags=["google-auth"])

TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
VALID_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


class GoogleSignInRequest(BaseModel):
    credential: str
    role: Literal["doctor", "receptionist"] = "doctor"


async def _verify_google_token(credential: str) -> dict:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503, detail="Google sign-in is not set up on this server"
        )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(TOKENINFO_URL, params={"id_token": credential})
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail="Could not reach Google. Try again."
        ) from exc

    invalid = HTTPException(status_code=401, detail="Google sign-in failed")
    if res.status_code != 200:
        raise invalid

    info = res.json()
    if info.get("aud") != settings.google_client_id:
        raise invalid
    if info.get("iss") not in VALID_ISSUERS:
        raise invalid
    if str(info.get("email_verified")).lower() != "true":
        raise invalid
    if not info.get("email"):
        raise invalid
    return info


@router.get("/google/config")
async def google_config() -> dict:
    """Lets the frontend know whether to show the Google button at all."""
    return {"client_id": settings.google_client_id or None}


@router.post("/google", dependencies=[Depends(rate_limit("google", 20, 60))])
async def google_sign_in(payload: GoogleSignInRequest):
    info = await _verify_google_token(payload.credential)
    email = info["email"].lower()
    name = info.get("name") or email.split("@")[0]

    if payload.role == "receptionist":
        doc = await db.receptionists().find_one({"email": email})
        if doc is None:
            receptionist = Receptionist(
                email=email, auth_provider=AuthProvider.GOOGLE, full_name=name
            )
            await db.receptionists().insert_one(receptionist.model_dump())
        else:
            receptionist = Receptionist(**doc)
        return ReceptionistTokenResponse(
            access_token=create_access_token(receptionist.id, role="receptionist"),
            receptionist=ReceptionistPublic(**receptionist.model_dump()),
        )

    doc = await db.doctors().find_one({"email": email})
    if doc is None:
        doctor = Doctor(email=email, auth_provider=AuthProvider.GOOGLE, full_name=name)
        await db.doctors().insert_one(doctor.model_dump())
    else:
        doctor = Doctor(**doc)
    return TokenResponse(
        access_token=create_access_token(doctor.id),
        doctor=DoctorPublic(**doctor.model_dump()),
    )
