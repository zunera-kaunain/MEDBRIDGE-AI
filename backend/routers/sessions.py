"""Consultation session lifecycle — creation, consent, and lookup.

A session is created the moment a doctor chooses to start recording for a
specific patient. Everything else (transcript, report) attaches to this id.
"""

from fastapi import APIRouter, Depends
from fastapi import HTTPException
import database as db
from middleware.auth import get_current_doctor
from models.doctor import Doctor
from models.common import utcnow
from models.session import ConsentConfirm, Session, SessionCreate

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=Session, status_code=201)
async def create_session(
    payload: SessionCreate,
    current: Doctor = Depends(get_current_doctor),
) -> Session:
    session = Session(doctor_id=current.id, **payload.model_dump())
    await db.sessions().insert_one(session.model_dump())
    return session

@router.get("/{session_id}", response_model=Session)
async def get_session(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Session:
    doc = await db.sessions().find_one({"id": session_id, "doctor_id": current.id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return Session(**doc)

@router.post("/{session_id}/consent", response_model=Session)
async def confirm_consent(
    session_id: str,
    payload: ConsentConfirm,
    current: Doctor = Depends(get_current_doctor),
) -> Session:
    """Record patient consent for this session. The timestamp is always
    stamped server-side — never trust a client-supplied time here.
    Recording should not start on the frontend until this has succeeded.
    """
    doc = await db.sessions().find_one({"id": session_id, "doctor_id": current.id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if not payload.confirmed:
        raise HTTPException(status_code=400, detail="Consent was not confirmed")

    await db.sessions().update_one(
        {"id": session_id, "doctor_id": current.id},
        {"$set": {"consent_given": True, "consent_timestamp": utcnow()}},
    )

    updated = await db.sessions().find_one({"id": session_id, "doctor_id": current.id})
    return Session(**updated)

@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> None:
    """Permanently delete a session, along with its report and patient
    card if any exist. Used to discard an in-progress or unwanted
    consultation — irreversible, no undo.
    """
    result = await db.sessions().delete_one({"id": session_id, "doctor_id": current.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.reports().delete_one({"session_id": session_id})
    await db.patient_cards().delete_many({"session_id": session_id})