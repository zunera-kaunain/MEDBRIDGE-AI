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


class Patient(BaseModel):
    id: str = Field(default_factory=new_id)
    doctor_id: str                      # owning clinic
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
    full_name: str
    age: int
    gender: Gender
    preferred_language: Language
    last_visit: datetime | None = None
    visit_count: int = 0