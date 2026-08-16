"""Patient records.

Patients never log in. The doctor enters these details at the start of a
consultation, and the record belongs to that doctor's clinic.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .common import Gender, Language, new_id, utcnow


class PatientCreate(BaseModel):
    full_name: str
    age: int = Field(ge=0, le=130)
    gender: Gender
    phone: str | None = None
    abha_id: str | None = None          # optional, never validated by us
    preferred_language: Language = Language.ENGLISH

class PatientUpdate(BaseModel):
    """All fields optional — only what's being changed needs to be sent."""
    full_name: str | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Gender | None = None
    phone: str | None = None
    abha_id: str | None = None
    preferred_language: Language | None = None

class Patient(BaseModel):
    id: str = Field(default_factory=new_id)
    doctor_id: str                      # owning clinic
    short_id: str                       # e.g. "A01" — quick lookup, spoken aloud easily
    full_name: str
    age: int
    gender: Gender
    phone: str | None = None
    abha_id: str | None = None
    preferred_language: Language = Language.ENGLISH
    created_at: datetime = Field(default_factory=utcnow)


class PatientSummary(BaseModel):
    """Row shape for search results and the patient list."""

    id: str
    short_id: str
    full_name: str
    age: int
    gender: Gender
    preferred_language: Language
    last_visit: datetime | None = None
    visit_count: int = 0