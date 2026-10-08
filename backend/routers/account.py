"""Delete-your-own-account endpoints, for doctors and receptionists.

The caller must confirm with their password (accounts that only ever signed
in with Google have no password, so for them the signed-in session is the
confirmation). Deletion is permanent.

A doctor's deletion also removes everything that belongs to them: their
patients, consultations, reports, patient cards, referral letters and
reminders. A receptionist's deletion removes only the account; the patients
she registered belong to their doctors and stay.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

import database as db
from middleware.auth import get_current_doctor, get_current_receptionist
from models.doctor import Doctor
from models.receptionist import Receptionist
from utils.rate_limit import check_rate_limit
from utils.security import verify_password

router = APIRouter(tags=["account"])


class DeleteAccountRequest(BaseModel):
    password: str | None = None


def _confirm_password(account_id: str, hashed: str | None, password: str | None) -> None:
    # Slows down someone guessing the password through this endpoint.
    check_rate_limit(f"delete-account:{account_id}", 5, 900)
    if hashed is None:
        return  # Google-only account: no password to check
    if not password or not verify_password(password, hashed):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )


@router.delete("/auth/me", status_code=204)
async def delete_doctor_account(
    payload: DeleteAccountRequest,
    current: Doctor = Depends(get_current_doctor),
) -> None:
    _confirm_password(current.id, current.hashed_password, payload.password)

    sessions = await db.sessions().find({"doctor_id": current.id}).to_list(length=None)
    session_ids = [s["id"] for s in sessions]
    if session_ids:
        by_session = {"session_id": {"$in": session_ids}}
        await db.reports().delete_many(by_session)
        await db.patient_cards().delete_many(by_session)
        await db.referral_summaries().delete_many(by_session)
        await db.reminders().delete_many(by_session)
    await db.sessions().delete_many({"doctor_id": current.id})
    await db.patients().delete_many({"doctor_id": current.id})
    await db.password_resets().delete_many({"account_id": current.id, "role": "doctor"})
    await db.doctors().delete_one({"id": current.id})


@router.delete("/auth/receptionist/me", status_code=204)
async def delete_receptionist_account(
    payload: DeleteAccountRequest,
    current: Receptionist = Depends(get_current_receptionist),
) -> None:
    _confirm_password(current.id, current.hashed_password, payload.password)

    await db.password_resets().delete_many(
        {"account_id": current.id, "role": "receptionist"}
    )
    await db.receptionists().delete_one({"id": current.id})
