"""Patient records.

Every patient belongs to exactly one doctor. doctor_id is always taken from
the JWT, never from the request — otherwise any doctor could read another
clinic's records by guessing an id.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Query, status

import database as db
from middleware.auth import get_current_doctor
from models.doctor import Doctor
from models.patient import Patient, PatientCreate, PatientSummary
from models.session import Session

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.post("", response_model=Patient, status_code=201)
async def create_patient(
    payload: PatientCreate,
    current: Doctor = Depends(get_current_doctor),
) -> Patient:
    patient = Patient(doctor_id=current.id, **payload.model_dump())
    await db.patients().insert_one(patient.model_dump())
    return patient


@router.get("", response_model=list[PatientSummary])
async def list_patients(
    q: str | None = Query(None, description="Search name or phone"),
    limit: int = Query(50, le=200),
    current: Doctor = Depends(get_current_doctor),
) -> list[PatientSummary]:
    """List or search this doctor's patients, most recently seen first.

    Search and listing are the same endpoint — an empty q just means no
    filter. A separate /search route would collide with /{patient_id}
    unless declared first, which is a footgun worth avoiding entirely.
    """
    match: dict = {"doctor_id": current.id}

    if q:
        # re.escape matters: an unescaped user string is a regex, and
        # something like "(((((" would either error or hang the query.
        safe = re.escape(q.strip())
        match["$or"] = [
            {"full_name": {"$regex": safe, "$options": "i"}},
            {"phone": {"$regex": safe, "$options": "i"}},
        ]

    pipeline = [
        {"$match": match},
        {
            "$lookup": {
                "from": "sessions",
                "localField": "id",
                "foreignField": "patient_id",
                "as": "visits",
            }
        },
        {
            "$addFields": {
                "visit_count": {"$size": "$visits"},
                "last_visit": {"$max": "$visits.encounter_start"},
            }
        },
        {"$sort": {"last_visit": -1, "created_at": -1}},
        {"$limit": limit},
    ]

    rows = await db.patients().aggregate(pipeline).to_list(length=limit)
    return [PatientSummary(**row) for row in rows]


async def _owned_patient(patient_id: str, doctor_id: str) -> Patient:
    """Fetch a patient, scoped to the owning doctor.

    Returns 404 rather than 403 when the patient belongs to someone else —
    confirming that an id exists but is off-limits leaks information.
    """
    doc = await db.patients().find_one({"id": patient_id, "doctor_id": doctor_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found"
        )
    return Patient(**doc)


@router.get("/{patient_id}", response_model=Patient)
async def get_patient(
    patient_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Patient:
    return await _owned_patient(patient_id, current.id)


@router.get("/{patient_id}/history", response_model=list[Session])
async def patient_history(
    patient_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> list[Session]:
    """Consultation history, newest first."""
    await _owned_patient(patient_id, current.id)  # ownership check

    rows = (
        await db.sessions()
        .find({"patient_id": patient_id})
        .sort("encounter_start", -1)
        .to_list(length=200)
    )
    return [Session(**row) for row in rows]