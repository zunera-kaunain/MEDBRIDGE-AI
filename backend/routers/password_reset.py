"""Forgot-password and reset-password endpoints, for doctors and receptionists.

Flow: the user enters their email -> we email a single-use link that is
valid for one hour -> the link opens /reset-password in the frontend, which
posts the token and a new password here.

Only a SHA-256 hash of the token is stored, so a database leak does not
hand out working reset links. Same idea as hashing passwords.
"""

import asyncio
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

import database as db
from config import settings
from services.email import send_email
from utils.rate_limit import check_rate_limit, rate_limit
from utils.security import hash_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["password-reset"])

RESET_TOKEN_MINUTES = 60

Role = Literal["doctor", "receptionist"]


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    role: Role = "doctor"


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class MessageResponse(BaseModel):
    message: str


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _accounts(role: str):
    return db.receptionists() if role == "receptionist" else db.doctors()


@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("forgot", 10, 900))],
)
async def forgot_password(payload: ForgotPasswordRequest) -> MessageResponse:
    # Stops someone using this endpoint to flood one person's inbox.
    check_rate_limit(f"forgot:email:{payload.email.lower()}", 3, 900)
    # The reply is identical whether or not the email exists. Saying "no
    # such account" would let anyone check which emails are registered.
    generic = MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )

    account = await _accounts(payload.role).find_one({"email": payload.email.lower()})
    if account is None:
        return generic
    if account.get("hashed_password") is None:
        # Google-only account: there is no password to reset.
        return generic

    token = secrets.token_urlsafe(32)
    await db.password_resets().insert_one(
        {
            "token_hash": _hash_token(token),
            "account_id": account["id"],
            "role": payload.role,
            "expires_at": datetime.now(timezone.utc)
            + timedelta(minutes=RESET_TOKEN_MINUTES),
            "used": False,
        }
    )

    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    body = (
        f"Hello {account.get('full_name', '')},\n\n"
        "We received a request to reset your MedBridge AI password.\n"
        f"Open this link to choose a new one (valid for {RESET_TOKEN_MINUTES} minutes):\n\n"
        f"{link}\n\n"
        "If you did not ask for this, you can ignore this email. "
        "Your password will not change.\n\n"
        "MedBridge AI"
    )

    try:
        # send_email is blocking smtplib, so keep it off the event loop.
        await asyncio.to_thread(
            send_email, payload.email, "Reset your MedBridge AI password", body
        )
    except Exception:
        # Do not tell the caller: a failure here must not reveal that the
        # account exists. In development (no SMTP set up) print the link so
        # the flow can still be tested.
        logger.exception("Could not send password reset email")
        if not settings.smtp_email:
            print(f"[password-reset] SMTP not configured. Reset link: {link}")

    return generic


@router.post(
    "/reset-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("reset", 10, 900))],
)
async def reset_password(payload: ResetPasswordRequest) -> MessageResponse:
    invalid = HTTPException(
        status_code=400,
        detail="This reset link is invalid or has expired. Request a new one.",
    )

    record = await db.password_resets().find_one(
        {"token_hash": _hash_token(payload.token)}
    )
    if record is None or record.get("used"):
        raise invalid
    if record["expires_at"] < datetime.now(timezone.utc):
        raise invalid

    try:
        hashed = hash_password(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = await _accounts(record["role"]).update_one(
        {"id": record["account_id"]}, {"$set": {"hashed_password": hashed}}
    )
    if result.matched_count == 0:
        raise invalid

    # Single use: burn this token, and any other open ones for the account.
    await db.password_resets().update_many(
        {"account_id": record["account_id"], "role": record["role"]},
        {"$set": {"used": True}},
    )

    return MessageResponse(message="Password updated. You can sign in now.")
