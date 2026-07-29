"""Doctor account and credential models.

Doctors are the only users of this system. Patients do not log in.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from .common import AuthProvider, VerificationStatus, new_id, utcnow


class DoctorRegister(BaseModel):
    """Email/password signup. Google OAuth bypasses this."""

    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str


class DoctorLogin(BaseModel):
    email: EmailStr
    password: str


class DoctorProfile(BaseModel):
    """Credential onboarding, completed after first login.

    registration_number becomes the Practitioner identifier in the FHIR
    bundle, so it is required for ABDM-shaped export.
    """

    qualification: str          # MBBS, MD, MS, ...
    specialization: str         # General Medicine, Paediatrics, ...
    registration_number: str    # state medical council registration
    state_medical_council: str
    year_of_registration: int = Field(ge=1950, le=2100)
    clinic_name: str | None = None
    clinic_address: str | None = None


class Doctor(BaseModel):
    """Full stored document. Never returned to the client directly."""

    id: str = Field(default_factory=new_id)
    email: EmailStr
    hashed_password: str | None = None      # None for Google accounts
    auth_provider: AuthProvider
    full_name: str

    qualification: str | None = None
    specialization: str | None = None
    registration_number: str | None = None
    state_medical_council: str | None = None
    year_of_registration: int | None = None
    clinic_name: str | None = None
    clinic_address: str | None = None
    credential_document_url: str | None = None

    verification_status: VerificationStatus = VerificationStatus.PENDING
    profile_complete: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class DoctorPublic(BaseModel):
    """What the API returns. Never includes hashed_password."""

    id: str
    email: EmailStr
    full_name: str
    qualification: str | None
    specialization: str | None
    registration_number: str | None
    state_medical_council: str | None
    clinic_name: str | None
    verification_status: VerificationStatus
    profile_complete: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    doctor: DoctorPublic