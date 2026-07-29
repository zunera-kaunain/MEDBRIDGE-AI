"""Doctor credential onboarding.

IMPORTANT — these credentials are COLLECTED, not verified. There is no
public NMC Indian Medical Register API available to us, so accounts remain
at verification_status = PENDING permanently.

Never write UI copy or report text implying real verification has occurred.
"""

from fastapi import APIRouter, Depends

import database as db
from middleware.auth import get_current_doctor
from models.doctor import Doctor, DoctorProfile, DoctorPublic

router = APIRouter(prefix="/api/doctor", tags=["doctor"])


@router.post("/profile", response_model=DoctorPublic)
async def complete_profile(
    payload: DoctorProfile,
    current: Doctor = Depends(get_current_doctor),
) -> DoctorPublic:
    """Save professional credentials and mark onboarding complete.

    registration_number becomes the Practitioner identifier in the FHIR
    bundle, which is why profile_complete gates consultation access.

    verification_status is deliberately NOT touched here — it stays PENDING.
    """
    updates = payload.model_dump()
    updates["profile_complete"] = True

    await db.doctors().update_one({"id": current.id}, {"$set": updates})

    doc = await db.doctors().find_one({"id": current.id})
    return DoctorPublic(**Doctor(**doc).model_dump())


@router.get("/profile", response_model=DoctorPublic)
async def get_profile(
    current: Doctor = Depends(get_current_doctor),
) -> DoctorPublic:
    return DoctorPublic(**current.model_dump())