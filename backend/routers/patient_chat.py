"""Grounded Q&A endpoint for a single patient's confirmed visit history."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import database as db
from middleware.auth import get_current_doctor
from models.doctor import Doctor
from models.report import Report
from services import patient_chat as chat_service

router = APIRouter(prefix="/api/patients", tags=["patient-chat"])


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str


@router.post("/{patient_id}/ask", response_model=AskResponse)
async def ask_about_patient(
    patient_id: str,
    payload: AskRequest,
    current: Doctor = Depends(get_current_doctor),
) -> AskResponse:
    patient_doc = await db.patients().find_one(
        {"id": patient_id, "doctor_id": current.id}
    )
    if patient_doc is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    from models.patient import Patient
    patient = Patient(**patient_doc)

    sessions = (
        await db.sessions()
        .find({"patient_id": patient_id, "doctor_id": current.id})
        .sort("encounter_start", -1)
        .to_list(length=50)
    )

    confirmed_reports: list[tuple[Report, str]] = []
    for session_doc in sessions:
        report_doc = await db.reports().find_one({"session_id": session_doc["id"]})
        if report_doc and report_doc.get("confirmed"):
            report = Report(**report_doc)
            visit_date = session_doc["encounter_start"].strftime("%d %b %Y")
            confirmed_reports.append((report, visit_date))

    answer = await chat_service.ask_about_patient(patient, confirmed_reports, payload.question)
    return AskResponse(answer=answer)