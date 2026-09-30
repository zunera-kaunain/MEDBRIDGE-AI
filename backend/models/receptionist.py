"""Receptionist accounts.

A receptionist works the front desk for the whole clinic, not one doctor.
There is no separate Clinic entity — this capstone only ever runs one
clinic, so "every doctor account in the system" IS the clinic. She can see
every doctor (to route new patients by chief complaint + age) and every
patient's demographics and consultation status, but never a consultation's
transcript, structured report, diagnosis, medications, or patient card.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from .common import AuthProvider, new_id, utcnow


class ReceptionistRegister(BaseModel):
    """Email/password signup, same shape as DoctorRegister."""

    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str


class ReceptionistLogin(BaseModel):
    email: EmailStr
    password: str


class Receptionist(BaseModel):
    """Full stored document. Never returned to the client directly."""

    id: str = Field(default_factory=new_id)
    email: EmailStr
    hashed_password: str | None = None      # None for Google accounts
    auth_provider: AuthProvider
    full_name: str
    created_at: datetime = Field(default_factory=utcnow)


class ReceptionistPublic(BaseModel):
    """What the API returns. Never includes hashed_password."""

    id: str
    email: EmailStr
    full_name: str
    created_at: datetime


class ReceptionistTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    receptionist: ReceptionistPublic
