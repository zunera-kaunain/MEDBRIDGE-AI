"""Consultation session lifecycle — creation only for now.

A session is created the moment a doctor chooses to start recording for a
specific patient. Everything else (transcript, report) attaches to this id.
"""

from fastapi import APIRouter, Depends
from fastapi import HTTPException
import database as db
from middleware.auth import get_current_doctor
from models.doctor import Doctor
from models.session import Session, SessionCreate

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