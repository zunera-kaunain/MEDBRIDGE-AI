"""Authentication dependencies.

Any route needing a logged-in doctor declares:

    current: Doctor = Depends(get_current_doctor)

Routes that touch consultations use require_complete_profile instead, since
a FHIR Practitioner resource needs the registration number.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import database as db
from models.doctor import Doctor
from utils.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_doctor(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Doctor:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    doctor_id = decode_access_token(credentials.credentials)
    if doctor_id is None:
        raise unauthorized

    doc = await db.doctors().find_one({"id": doctor_id})
    if doc is None:
        raise unauthorized

    return Doctor(**doc)


async def require_complete_profile(
    current: Doctor = Depends(get_current_doctor),
) -> Doctor:
    """Gate consultation features behind completed credential onboarding.

    The FHIR Practitioner resource requires a registration number, so a
    report cannot be exported without one. Better to block at the door than
    to fail at export time.
    """
    if not current.profile_complete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete your professional profile before starting consultations",
        )
    return current