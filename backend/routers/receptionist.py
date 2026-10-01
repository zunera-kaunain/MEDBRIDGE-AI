"""Receptionist-only routes: see the doctor roster, get a routing
suggestion, and register a patient assigned to a chosen doctor.

Everything here uses get_current_receptionist, not require_role — these
are receptionist-specific actions, not ones a doctor would ever call.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

import database as db
from middleware.auth import get_current_receptionist
from models.doctor import Doctor, DoctorForRouting
from models.patient import Patient, ReceptionistPatientCreate
from models.receptionist import Receptionist
from services.routing import suggest_doctor

router = APIRouter(prefix="/api/receptionist", tags=["receptionist"])


def _to_routing_shape(doc: dict) -> DoctorForRouting:
    doctor = Doctor(**doc)
    return DoctorForRouting(
        id=doctor.id,
        full_name=doctor.full_name,
        specialization=doctor.specialization,
        qualification=doctor.qualification,
    )


@router.get("/doctors", response_model=list[DoctorForRouting])
async def list_doctors(
    current: Receptionist = Depends(get_current_receptionist),
) -> list[DoctorForRouting]:
    """Every doctor with a completed profile — no Clinic entity exists in
    this system, so "every doctor account" IS the clinic (see DECISIONS.md
    on the single-clinic assumption). Profile-incomplete doctors are
    excluded since they have no specialization to route by.
    """
    rows = await db.doctors().find({"profile_complete": True}).to_list(length=200)
    return [_to_routing_shape(row) for row in rows]


@router.get("/suggest-doctor")
async def suggest(
    chief_complaint: str = Query(..., min_length=1),
    age: int = Query(..., ge=0, le=130),
    current: Receptionist = Depends(get_current_receptionist),
) -> dict:
    """Return a suggested doctor_id (or null) for the dropdown to
    preselect. The receptionist always sees and can change the full list —
    this is a starting point, not a verdict.
    """
    rows = await db.doctors().find({"profile_complete": True}).to_list(length=200)
    doctors = [_to_routing_shape(row) for row in rows]
    suggested_id = suggest_doctor(chief_complaint, age, doctors)
    return {"suggested_doctor_id": suggested_id}


def _next_short_id(existing_count: int) -> str:
    """Same scheme as patients.py: A01, A02, ... A99, B01, ... — short
    enough to say out loud. Kept as its own copy rather than imported, to
    keep the two routers independent.
    """
    import string

    letter_index, number = divmod(existing_count, 99)
    letter = string.ascii_uppercase[letter_index]
    return f"{letter}{number + 1:02d}"


@router.post("/patients", response_model=Patient, status_code=201)
async def register_patient(
    payload: ReceptionistPatientCreate,
    current: Receptionist = Depends(get_current_receptionist),
) -> Patient:
    """Register a new patient and assign them to the chosen doctor.

    doctor_id comes from the receptionist's own routing decision (the
    dropdown, pre-filled by /suggest-doctor but hers to change) — never
    inferred from who's logged in, since she isn't attached to one doctor.
    """
    doctor_doc = await db.doctors().find_one({"id": payload.doctor_id})
    if doctor_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected doctor not found",
        )

    existing_count = await db.patients().count_documents(
        {"doctor_id": payload.doctor_id}
    )
    short_id = _next_short_id(existing_count)

    patient = Patient(
        doctor_id=payload.doctor_id,
        short_id=short_id,
        full_name=payload.full_name,
        age=payload.age,
        gender=payload.gender,
        phone=payload.phone,
        email=payload.email,
        abha_id=payload.abha_id,
        preferred_language=payload.preferred_language,
        intake_chief_complaint=payload.chief_complaint,
        registered_by_receptionist_id=current.id,
    )
    await db.patients().insert_one(patient.model_dump())
    return patient
