"""Registration, login, and current-user endpoints for receptionists.

Mirrors routers/auth.py's doctor flow, but issues a token tagged
role="receptionist" and stores into the receptionists collection instead.
Kept as its own router (rather than folded into auth.py) so the doctor
flow stays untouched and this can be deleted cleanly if the approach
changes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

import database as db
from middleware.auth import get_current_receptionist
from models.common import AuthProvider
from models.receptionist import (
    Receptionist,
    ReceptionistLogin,
    ReceptionistPublic,
    ReceptionistRegister,
    ReceptionistTokenResponse,
)
from utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth/receptionist", tags=["receptionist-auth"])


def _to_public(receptionist: Receptionist) -> ReceptionistPublic:
    return ReceptionistPublic(**receptionist.model_dump())


@router.post("/register", response_model=ReceptionistTokenResponse, status_code=201)
async def register(payload: ReceptionistRegister) -> ReceptionistTokenResponse:
    try:
        hashed = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    receptionist = Receptionist(
        email=payload.email.lower(),
        hashed_password=hashed,
        auth_provider=AuthProvider.EMAIL,
        full_name=payload.full_name,
    )

    try:
        await db.receptionists().insert_one(receptionist.model_dump())
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    return ReceptionistTokenResponse(
        access_token=create_access_token(receptionist.id, role="receptionist"),
        receptionist=_to_public(receptionist),
    )


@router.post("/login", response_model=ReceptionistTokenResponse)
async def login(payload: ReceptionistLogin) -> ReceptionistTokenResponse:
    doc = await db.receptionists().find_one({"email": payload.email.lower()})

    # Same error for unknown email and wrong password, same reasoning as
    # the doctor login — don't leak which emails are registered.
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
    )

    if doc is None:
        raise invalid

    receptionist = Receptionist(**doc)
    if receptionist.hashed_password is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google sign-in",
        )

    if not verify_password(payload.password, receptionist.hashed_password):
        raise invalid

    return ReceptionistTokenResponse(
        access_token=create_access_token(receptionist.id, role="receptionist"),
        receptionist=_to_public(receptionist),
    )


@router.get("/me", response_model=ReceptionistPublic)
async def me(
    current: Receptionist = Depends(get_current_receptionist),
) -> ReceptionistPublic:
    return _to_public(current)
