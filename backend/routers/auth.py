"""Registration, login, and current-user endpoints.

Google OAuth lands later; email/password is enough to unblock everything
downstream and is simpler to test.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

import database as db
from middleware.auth import get_current_doctor
from models.common import AuthProvider
from models.doctor import (
    Doctor,
    DoctorLogin,
    DoctorPublic,
    DoctorRegister,
    TokenResponse,
)
from utils.rate_limit import check_rate_limit, rate_limit
from utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_public(doctor: Doctor) -> DoctorPublic:
    return DoctorPublic(**doctor.model_dump())


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=201,
    dependencies=[Depends(rate_limit("register", 10, 3600))],
)
async def register(payload: DoctorRegister) -> TokenResponse:
    try:
        hashed = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    doctor = Doctor(
        email=payload.email.lower(),
        hashed_password=hashed,
        auth_provider=AuthProvider.EMAIL,
        full_name=payload.full_name,
    )

    try:
        await db.doctors().insert_one(doctor.model_dump())
    except DuplicateKeyError:
        # The unique index on email is what actually enforces this. Checking
        # first with find_one would leave a race between the check and insert.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    return TokenResponse(
        access_token=create_access_token(doctor.id),
        doctor=_to_public(doctor),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("login", 15, 60))],
)
async def login(payload: DoctorLogin) -> TokenResponse:
    # Per-email limit too, so password guessing against one account is
    # slowed even when the attempts come from many addresses.
    check_rate_limit(f"login:doctor:{payload.email.lower()}", 8, 900)
    doc = await db.doctors().find_one({"email": payload.email.lower()})

    # Same error for unknown email and wrong password — telling an attacker
    # which emails are registered is free reconnaissance.
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
    )

    if doc is None:
        raise invalid

    doctor = Doctor(**doc)
    if doctor.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google sign-in",
        )

    if not verify_password(payload.password, doctor.hashed_password):
        raise invalid

    return TokenResponse(
        access_token=create_access_token(doctor.id),
        doctor=_to_public(doctor),
    )


@router.get("/me", response_model=DoctorPublic)
async def me(current: Doctor = Depends(get_current_doctor)) -> DoctorPublic:
    return _to_public(current)