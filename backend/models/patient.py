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
    email: str | None = None
    abha_id: str | None = None          # optional, never validated by us
    preferred_language: Language = Language.ENGLISH

class ReceptionistPatientCreate(BaseModel):
    """What a receptionist submits at intake.

    Separate from PatientCreate (the doctor's own version) because a
    receptionist additionally supplies chief_complaint (used only to
    suggest/confirm a doctor — it is not a clinical finding, so it is
    stored as intake_chief_complaint, never as Report.chief_complaint,
    which is the AI-extracted, doctor-confirmed clinical one) and
    doctor_id (her routing decision, not implied by who's logged in).
    """

    full_name: str
    age: int = Field(ge=0, le=130)
    gender: Gender
    phone: str = Field(min_length=1)       # mandatory at receptionist intake
    email: str = Field(min_length=1)       # mandatory at receptionist intake
    abha_id: str | None = None
    preferred_language: Language = Language.ENGLISH
    chief_complaint: str | None = None     # optional — not every intake states one
    doctor_id: str


class PatientUpdate(BaseModel):
    """All fields optional — only what's being changed needs to be sent."""
    full_name: str | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    gender: Gender | None = None
    phone: str | None = None
    email: str | None = None
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
    email: str | None = None
    abha_id: str | None = None
    preferred_language: Language = Language.ENGLISH
    created_at: datetime = Field(default_factory=utcnow)

    # Only set when a receptionist registered this patient. Never the
    # clinical chief complaint (that's Report.chief_complaint, AI-extracted
    # and doctor-confirmed) — this is just what she typed to route them,
    # kept for the doctor's reference at the start of the consultation.
    intake_chief_complaint: str | None = None
    registered_by_receptionist_id: str | None = None


class ReceptionistPatientSummary(BaseModel):
    """Row shape for the receptionist's patient list — across every
    doctor, unlike PatientSummary (one doctor's own list). Shows that a
    consultation happened and its bare status, and whether a follow-up is
    due — never transcript/diagnosis/medication content. See DECISIONS.md
    on the receptionist privacy boundary.
    """

    id: str
    short_id: str
    full_name: str
    age: int
    gender: Gender
    doctor_id: str
    doctor_name: str | None = None
    doctor_specialization: str | None = None
    intake_chief_complaint: str | None = None
    latest_session_status: str | None = None   # SessionStatus value, or None
    next_followup_at: datetime | None = None    # soonest unsent reminder


class ReceptionistPatientReassign(BaseModel):
    doctor_id: str


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