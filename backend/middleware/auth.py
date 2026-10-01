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
from models.receptionist import Receptionist
from utils.security import decode_access_token, decode_access_token_role

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

    # Explicit role check, not just reliance on the doctors-collection lookup
    # below missing a receptionist id. That lookup-miss happened to work as
    # a boundary, but it was an accident of data layout, not an intentional
    # guard — this makes the guard the actual reason, so the boundary holds
    # even if the two account types ever end up in the same collection or
    # share an id space. Old doctor tokens (issued before the role claim
    # existed) decode to role "doctor" by default, so this changes nothing
    # for them.
    role = decode_access_token_role(credentials.credentials)
    if role != "doctor":
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


async def get_current_receptionist(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Receptionist:
    """Mirror of get_current_doctor, for routes that are receptionist-only
    (there aren't many — most shared routes should use require_role below).
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    account_id = decode_access_token(credentials.credentials)
    role = decode_access_token_role(credentials.credentials)
    if account_id is None or role != "receptionist":
        raise unauthorized

    doc = await db.receptionists().find_one({"id": account_id})
    if doc is None:
        raise unauthorized

    return Receptionist(**doc)


def require_role(*allowed: str):
    """Build a dependency that accepts a token from any of the given roles.

    Returns whichever account object matches — a Doctor or a Receptionist —
    so the route still gets a real, typed object, not just a role string.
    Use this (not get_current_doctor) on any route both roles may call, e.g.:

        current: Doctor | Receptionist = Depends(require_role("doctor", "receptionist"))

    Putting the role check in one place, applied per-route, is deliberate:
    it's the difference between "a route forgets to check" (a silent hole)
    and "a route forgets to declare its allowed roles at all" (FastAPI
    still runs it with NO auth dependency, which is loud and obvious in
    review — nobody can call a route with a typo'd or missing Depends()
    and have it quietly work for a role it shouldn't).
    """

    async def dependency(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    ) -> Doctor | Receptionist:
        unauthorized = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        forbidden = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not permitted for this role",
        )

        if credentials is None:
            raise unauthorized

        account_id = decode_access_token(credentials.credentials)
        role = decode_access_token_role(credentials.credentials)
        if account_id is None or role is None:
            raise unauthorized

        if role not in allowed:
            raise forbidden

        if role == "doctor":
            doc = await db.doctors().find_one({"id": account_id})
            if doc is None:
                raise unauthorized
            return Doctor(**doc)

        if role == "receptionist":
            doc = await db.receptionists().find_one({"id": account_id})
            if doc is None:
                raise unauthorized
            return Receptionist(**doc)

        raise forbidden  # unreachable while Role only has these two values

    return dependency