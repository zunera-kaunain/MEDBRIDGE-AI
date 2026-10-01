"""Receptionist-only routes: see the doctor roster, get a routing
suggestion, and register a patient assigned to a chosen doctor.

Everything here uses get_current_receptionist, not require_role — these
are receptionist-specific actions, not ones a doctor would ever call.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Query, status

import database as db
from middleware.auth import get_current_receptionist
from models.doctor import Doctor, DoctorForRouting
from models.patient import (
    Patient,
    ReceptionistPatientCreate,
    ReceptionistPatientReassign,
    ReceptionistPatientSummary,
)
from models.receptionist import Receptionist
from models.report import ReceptionistReferralNotice
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


@router.get("/patients", response_model=list[ReceptionistPatientSummary])
async def list_patients(
    q: str | None = Query(None, description="Search name, phone, or short ID"),
    limit: int = Query(100, le=300),
    current: Receptionist = Depends(get_current_receptionist),
) -> list[ReceptionistPatientSummary]:
    """Every patient across every doctor — unlike the doctor's own
    /api/patients, which is scoped to just their own. Shows a
    consultation's bare status and next follow-up date, never any
    clinical content (see ReceptionistPatientSummary's docstring).

    Built with plain queries + Python joins rather than one aggregation
    pipeline — simpler to read, and avoids depending on a specific
    MongoDB version's aggregation operators for what's a small dataset in
    this capstone's scale.
    """
    match: dict = {}
    if q:
        safe = re.escape(q.strip())
        match["$or"] = [
            {"full_name": {"$regex": safe, "$options": "i"}},
            {"phone": {"$regex": safe, "$options": "i"}},
            {"short_id": {"$regex": safe, "$options": "i"}},
        ]

    patients = (
        await db.patients()
        .find(match)
        .sort("created_at", -1)
        .to_list(length=limit)
    )
    if not patients:
        return []

    patient_ids = [p["id"] for p in patients]
    doctor_ids = list({p["doctor_id"] for p in patients})

    doctor_rows = await db.doctors().find({"id": {"$in": doctor_ids}}).to_list(
        length=len(doctor_ids)
    )
    doctors_by_id = {d["id"]: d for d in doctor_rows}

    # Sorted newest-first, so the first entry seen per patient_id is the
    # latest session — cheaper than a second query per patient.
    session_rows = (
        await db.sessions()
        .find({"patient_id": {"$in": patient_ids}})
        .sort("encounter_start", -1)
        .to_list(length=2000)
    )
    latest_status_by_patient: dict[str, str] = {}
    for s in session_rows:
        latest_status_by_patient.setdefault(s["patient_id"], s["status"])

    reminder_rows = (
        await db.reminders()
        .find({"patient_id": {"$in": patient_ids}, "sent": False})
        .sort("send_at", 1)
        .to_list(length=2000)
    )
    next_followup_by_patient: dict[str, object] = {}
    for r in reminder_rows:
        next_followup_by_patient.setdefault(r["patient_id"], r["send_at"])

    summaries: list[ReceptionistPatientSummary] = []
    for p in patients:
        doctor = doctors_by_id.get(p["doctor_id"])
        summaries.append(
            ReceptionistPatientSummary(
                id=p["id"],
                short_id=p["short_id"],
                full_name=p["full_name"],
                age=p["age"],
                gender=p["gender"],
                doctor_id=p["doctor_id"],
                doctor_name=doctor["full_name"] if doctor else None,
                doctor_specialization=doctor.get("specialization") if doctor else None,
                intake_chief_complaint=p.get("intake_chief_complaint"),
                latest_session_status=latest_status_by_patient.get(p["id"]),
                next_followup_at=next_followup_by_patient.get(p["id"]),
            )
        )
    return summaries


@router.patch("/patients/{patient_id}/doctor", response_model=Patient)
async def reassign_patient(
    patient_id: str,
    payload: ReceptionistPatientReassign,
    current: Receptionist = Depends(get_current_receptionist),
) -> Patient:
    """Move a patient to a different doctor — for when the original
    routing call was wrong. Past sessions/reports keep their own
    doctor_id (they're historical records of who actually saw the
    patient at the time); patient.doctor_id is "who owns this patient
    now", which is what every ownership check in patients.py/sessions.py
    actually reads.

    short_id is NOT renumbered on reassignment — it was unique within the
    old doctor's patient count and may not be within the new doctor's.
    Harmless (it's a display label, not a key), but worth knowing.
    """
    patient_doc = await db.patients().find_one({"id": patient_id})
    if patient_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found"
        )

    doctor_doc = await db.doctors().find_one({"id": payload.doctor_id})
    if doctor_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Selected doctor not found"
        )

    await db.patients().update_one(
        {"id": patient_id}, {"$set": {"doctor_id": payload.doctor_id}}
    )
    updated = await db.patients().find_one({"id": patient_id})
    return Patient(**updated)


@router.get("/referrals", response_model=list[ReceptionistReferralNotice])
async def list_referrals(
    limit: int = Query(50, le=200),
    current: Receptionist = Depends(get_current_receptionist),
) -> list[ReceptionistReferralNotice]:
    """Recent referrals, across every doctor, logistics-only.

    This is the one place a referral reaches the receptionist at all. The
    patient always gets the full referral letter (diagnosis, ICD codes,
    medications) by email the moment the doctor generates it — see
    auto_send.send_referral_to_patient in routers/reports.py. This
    endpoint deliberately strips all of that down to specialist_name,
    department, and reason, because her job here is to tell the patient
    where to go next, not to read their clinical record. If a referral
    row has neither a specialist_name nor a department, there is nothing
    actionable for her to say, so it's left out.

    Built with the same plain-query + Python-join pattern as /patients:
    referral_summaries -> sessions (for patient_id) -> patients (for the
    display name/short_id). ReferralSummary itself has no patient_id, only
    session_id, hence the two-step join.
    """
    referral_rows = (
        await db.referral_summaries()
        .find({})
        .sort("generated_at", -1)
        .to_list(length=limit * 3)  # over-fetch since some rows get filtered below
    )
    if not referral_rows:
        return []

    session_ids = list({r["session_id"] for r in referral_rows})
    session_rows = await db.sessions().find({"id": {"$in": session_ids}}).to_list(
        length=len(session_ids)
    )
    patient_id_by_session = {s["id"]: s["patient_id"] for s in session_rows}

    patient_ids = list(set(patient_id_by_session.values()))
    patient_rows = await db.patients().find({"id": {"$in": patient_ids}}).to_list(
        length=len(patient_ids)
    )
    patients_by_id = {p["id"]: p for p in patient_rows}

    notices: list[ReceptionistReferralNotice] = []
    for r in referral_rows:
        if not r.get("specialist_name") and not r.get("department"):
            continue  # nothing actionable for her to relay
        patient_id = patient_id_by_session.get(r["session_id"])
        patient = patients_by_id.get(patient_id) if patient_id else None
        if patient is None:
            continue
        notices.append(
            ReceptionistReferralNotice(
                id=r["id"],
                patient_id=patient["id"],
                patient_name=patient["full_name"],
                patient_short_id=patient["short_id"],
                specialist_name=r.get("specialist_name"),
                department=r.get("department"),
                reason=r["reason"],
                generated_at=r["generated_at"],
            )
        )
        if len(notices) >= limit:
            break
    return notices
