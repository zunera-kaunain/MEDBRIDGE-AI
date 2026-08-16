"""Report generation and retrieval.

A report is generated once per session, from that session's transcript.
Generation is triggered explicitly by the doctor (not automatic), since
extraction costs an API call once real NLP lands.

Reports are immutable once confirmed. The patient card may only be
generated from a confirmed report — a patient must never see clinical
content the doctor has not signed off on.
"""
from services import pdf as pdf_service
from fastapi.responses import Response
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

import database as db
from middleware.auth import get_current_doctor
from models.common import Language
from models.doctor import Doctor
from models.patient import Patient
from models.report import PatientCard, Report
from models.session import Session
from models.report import PatientCard, Report, ReportUpdate
from services import card as card_service
from services import nlp
from services import fhir

router = APIRouter(prefix="/api/sessions", tags=["reports"])


async def _owned_session(session_id: str, doctor_id: str) -> Session:
    doc = await db.sessions().find_one({"id": session_id, "doctor_id": doctor_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return Session(**doc)


async def _owned_patient(patient_id: str, doctor_id: str) -> Patient:
    doc = await db.patients().find_one({"id": patient_id, "doctor_id": doctor_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found"
        )
    return Patient(**doc)


@router.post("/{session_id}/report", response_model=Report, status_code=201)
async def generate_report(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Report:
    """Generate (or regenerate) the structured report for a session.

    Regenerating a CONFIRMED report is rejected — confirmed records are
    immutable, and regenerating would silently overwrite a signed-off
    document.
    """
    session = await _owned_session(session_id, current.id)

    existing = await db.reports().find_one({"session_id": session_id})
    if existing and existing.get("confirmed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is confirmed and cannot be regenerated",
        )

    await db.sessions().update_one(
        {"id": session_id}, {"$set": {"status": "processing"}}
    )

    report = await nlp.extract_report(
        transcript=session.transcript,
        session_id=session.id,
        doctor_id=current.id,
        patient_id=session.patient_id,
    )

    await db.reports().update_one(
        {"session_id": session_id},
        {"$set": report.model_dump()},
        upsert=True,
    )

    await db.sessions().update_one(
        {"id": session_id},
        {
            "$set": {
                "status": "ready",
                "report_generated_at": report.generated_at,
            }
        },
    )
    return report


@router.get("/{session_id}/report", response_model=Report)
async def get_report(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Report:
    await _owned_session(session_id, current.id)  # ownership check

    doc = await db.reports().find_one({"session_id": session_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not generated yet"
        )
    return Report(**doc)

@router.patch("/{session_id}/report", response_model=Report)
async def update_report(
    session_id: str,
    payload: ReportUpdate,
    current: Doctor = Depends(get_current_doctor),
) -> Report:
    """Doctor edits to a report. Rejected once confirmed — confirmed
    records are immutable.
    """
    await _owned_session(session_id, current.id)  # ownership check

    existing = await db.reports().find_one({"session_id": session_id})
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not generated yet"
        )
    if existing.get("confirmed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is confirmed and cannot be edited",
        )

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    # Nested models (medications, followup) need dict conversion for Mongo.
    for key in ("medications", "followup"):
        if key in updates:
            val = updates[key]
            updates[key] = (
                [m if isinstance(m, dict) else m.model_dump() for m in val]
                if key == "medications"
                else (val if isinstance(val, dict) else val.model_dump())
            )
    for key in ("chief_complaint", "symptoms", "diagnosis"):
        if key in updates:
            val = updates[key]
            if key == "chief_complaint" and not isinstance(val, dict):
                updates[key] = val.model_dump()
            elif key in ("symptoms", "diagnosis"):
                updates[key] = [f if isinstance(f, dict) else f.model_dump() for f in val]

    if updates:
        await db.reports().update_one(
            {"session_id": session_id},
            {"$set": updates},
        )

    updated = await db.reports().find_one({"session_id": session_id})
    return Report(**updated)

@router.post("/{session_id}/report/confirm", response_model=Report)
async def confirm_report(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Report:
    """Lock the report as confirmed. Irreversible — no unconfirm endpoint.

    This is the doctor's sign-off. Once confirmed, the report is immutable
    and the patient card becomes generatable.
    """
    await _owned_session(session_id, current.id)  # ownership check

    doc = await db.reports().find_one({"session_id": session_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not generated yet"
        )
    if doc.get("confirmed"):
        return Report(**doc)  # already confirmed — idempotent, not an error

    confirmed_at = datetime.now(timezone.utc)

    await db.reports().update_one(
        {"session_id": session_id},
        {"$set": {"confirmed": True, "confirmed_at": confirmed_at}},
    )

    await db.sessions().update_one(
        {"id": session_id},
        {"$set": {"status": "confirmed", "encounter_end": confirmed_at}},
    )

    updated = await db.reports().find_one({"session_id": session_id})
    return Report(**updated)


@router.post("/{session_id}/card", response_model=PatientCard, status_code=201)
async def generate_card(
    session_id: str,
    language: Language,
    current: Doctor = Depends(get_current_doctor),
) -> PatientCard:
    """Generate the patient explanation card, in the given language.

    Only permitted once the report is confirmed — a patient must never see
    clinical content the doctor has not signed off on.
    """
    session = await _owned_session(session_id, current.id)

    report_doc = await db.reports().find_one({"session_id": session_id})
    if report_doc is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Generate the report before the patient card",
        )
    report = Report(**report_doc)

    if not report.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm the report before generating the patient card",
        )

    patient = await _owned_patient(session.patient_id, current.id)

    card = await card_service.generate_card(report, language, patient.full_name)

    await db.patient_cards().update_one(
        {"session_id": session_id, "language": language.value},
        {"$set": card.model_dump()},
        upsert=True,
    )
    return card


@router.get("/{session_id}/card", response_model=PatientCard)
async def get_card(
    session_id: str,
    language: Language,
    current: Doctor = Depends(get_current_doctor),
) -> PatientCard:
    await _owned_session(session_id, current.id)

    doc = await db.patient_cards().find_one(
        {"session_id": session_id, "language": language.value}
    )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not generated yet"
        )
    return PatientCard(**doc)

@router.get("/{session_id}/fhir")
async def export_fhir(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> dict:
    """Export the confirmed report as a FHIR R4 Bundle.

    Schema-conformant export only — not live ABDM Health Stack submission.
    """
    session = await _owned_session(session_id, current.id)

    report_doc = await db.reports().find_one({"session_id": session_id})
    if report_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not generated yet"
        )
    report = Report(**report_doc)

    if not report.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report must be confirmed before FHIR export",
        )

    patient = await _owned_patient(session.patient_id, current.id)

    return fhir.build_fhir_bundle(report, session, patient)

@router.get("/{session_id}/pdf")
async def export_pdf(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Response:
    """Download the confirmed report as a PDF."""
    session = await _owned_session(session_id, current.id)

    report_doc = await db.reports().find_one({"session_id": session_id})
    if report_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not generated yet"
        )
    report = Report(**report_doc)

    if not report.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report must be confirmed before PDF export",
        )

    patient = await _owned_patient(session.patient_id, current.id)

    pdf_bytes = pdf_service.build_report_pdf(report, patient, current)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="report-{patient.short_id}.pdf"'
        },
    )