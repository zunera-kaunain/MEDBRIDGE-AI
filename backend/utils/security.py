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


def create_access_token(doctor_id: str) -> str:
    """Issue a JWT whose subject is the doctor's id.

    Every downstream route derives doctor_id from this token, never from
    the request body. A client must not be able to read or write another
    doctor's records by passing a different id.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": doctor_id,
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """Return the doctor id, or None if the token is invalid or expired."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        return None
    return payload.get("sub")