"""Password hashing and JWT token handling.

Uses bcrypt directly rather than passlib — passlib's bcrypt backend emits
version-detection warnings with modern bcrypt releases and adds nothing we
need here.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from config import settings

# bcrypt silently truncates anything past 72 bytes, which would make two
# different long passwords interchangeable. Reject instead.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError("Password must be 72 bytes or fewer")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject_id: str, role: str = "doctor") -> str:
    """Issue a JWT whose subject is the account's id, tagged with its role.

    Every downstream route derives the account id (and now the role) from
    this token, never from the request body. A client must not be able to
    read or write another account's records by passing a different id, and
    must not be able to claim a role it wasn't issued.

    role defaults to "doctor" so every existing call site (and every token
    already issued before roles existed) keeps working unchanged.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Return the account id, or None if the token is invalid or expired.

    Kept exactly as before for every caller that only ever dealt with
    doctors (get_current_doctor, the WebSocket endpoint) — they don't need
    the role, since a receptionist id will simply never match a doctor_id
    anywhere those callers check ownership.
    """
    payload = _decode_payload(token)
    if payload is None:
        return None
    return payload.get("sub")


def decode_access_token_role(token: str) -> str | None:
    """Return the role claim, or None if the token is invalid or expired.

    Tokens issued before roles existed carry no "role" claim at all — those
    are treated as "doctor", since every account before this change was a
    doctor.
    """
    payload = _decode_payload(token)
    if payload is None:
        return None
    return payload.get("role", "doctor")


def _decode_payload(token: str) -> dict | None:
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        return None