"""Shared enums and primitives. Every other model file imports from here."""

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


def new_id() -> str:
    """Document IDs are UUID hex strings, not Mongo ObjectIds.

    ObjectId does not serialise to JSON without custom encoders and causes
    constant friction between FastAPI, Pydantic and the frontend. Plain
    strings avoid the entire problem.
    """
    return uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class AuthProvider(str, Enum):
    GOOGLE = "google"
    EMAIL = "email"


class VerificationStatus(str, Enum):
    """Doctor credentials are COLLECTED, never automatically verified.

    There is no public NMC register API available to us. Accounts stay
    PENDING. Never display copy implying real verification has occurred.
    """

    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class Language(str, Enum):
    """Patient card output languages."""

    ENGLISH = "en"
    HINDI = "hi"
    KANNADA = "kn"
    TAMIL = "ta"
    TELUGU = "te"
    MALAYALAM = "ml"


class LanguagePair(str, Enum):
    """Consultation input pairs, selected by the doctor before recording.

    Passed to Whisper as a language hint. Auto-detection locks onto one
    language and mangles code-switches.

    KN_EN and HI_EN are formally evaluated. The rest are best-effort.
    """

    KN_EN = "kn-en"
    HI_EN = "hi-en"
    TA_EN = "ta-en"
    TE_EN = "te-en"
    ML_EN = "ml-en"
    EN = "en"

    @property
    def whisper_hint(self) -> str:
        return self.value.split("-")[0]


class ExtractedField(BaseModel):
    """A single value pulled from the transcript by the NLP service.

    confidence drives the colour badge in the UI:
        >= 0.85  high    (green)
        0.60-0.85 medium (amber)
        <  0.60  low     (red)

    transcript_offset is the character span in Session.transcript that
    produced this value. Focusing the field in the UI highlights that span.
    """

    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    transcript_offset: tuple[int, int] | None = None
    edited_by_doctor: bool = False