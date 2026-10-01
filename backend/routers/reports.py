"""Report generation and retrieval.

A report is generated once per session, from that session's transcript.
Generation is triggered explicitly by the doctor (not automatic), since
extraction costs an API call once real NLP lands.

Reports are immutable once confirmed. The patient card may only be
generated from a confirmed report — a patient must never see clinical
content the doctor has not signed off on.
"""
from services import pdf as pdf_service
from services import email as email_service
from fastapi.responses import Response
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

import database as db
from middleware.auth import get_current_doctor
from models.common import Language
from models.doctor import Doctor
from models.patient import Patient
from models.report import PatientCard, Report
from models.session import Session
from models.report import PatientCard, ReferralCreate, ReferralSummary, Report, ReportUpdate
from services import auto_send
from services import card as card_service
from services import nlp
from services import fhir
from services import icd as icd_service
from services import drug_interactions as interaction_service
from services import reminders as reminder_service

router = APIRouter(prefix="/api/sessions", tags=["reports"])


class EmailCardRequest(BaseModel):
    to_email: str


class EmailReferralRequest(BaseModel):
    to_email: str


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
    for key in ("chief_complaint", "symptoms", "diagnosis", "family_history"):
        if key in updates:
            val = updates[key]
            if key == "chief_complaint" and not isinstance(val, dict):
                updates[key] = val.model_dump()
            elif key in ("symptoms", "diagnosis", "family_history"):
                updates[key] = [f if isinstance(f, dict) else f.model_dump() for f in val]

    if updates:
        await db.reports().update_one(
            {"session_id": session_id},
            {"$set": updates},
        )

    updated = await db.reports().find_one({"session_id": session_id})
    return Report(**updated)


@router.post("/{session_id}/report/icd-codes", response_model=Report)
async def generate_icd_codes(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Report:
    """Map this report's diagnoses to ICD-10-CM codes and attach them."""
    await _owned_session(session_id, current.id)  # ownership check

    doc = await db.reports().find_one({"session_id": session_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not generated yet"
        )
    report = Report(**doc)

    diagnosis_texts = [d.text for d in report.diagnosis]
    codes = await icd_service.code_report_diagnoses(diagnosis_texts)

    await db.reports().update_one(
        {"session_id": session_id},
        {"$set": {"icd_codes": [c.model_dump() for c in codes]}},
    )

    updated = await db.reports().find_one({"session_id": session_id})
    return Report(**updated)


@router.post("/{session_id}/report/interactions", response_model=Report)
async def check_drug_interactions(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Report:
    """Check this report's medications against the curated interaction
    table and attach any flagged pairs."""
    await _owned_session(session_id, current.id)  # ownership check

    doc = await db.reports().find_one({"session_id": session_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not generated yet"
        )
    report = Report(**doc)

    medication_names = [m.name.text for m in report.medications]
    warnings = interaction_service.check_interactions(medication_names)

    await db.reports().update_one(
        {"session_id": session_id},
        {"$set": {"interaction_warnings": [w.model_dump() for w in warnings]}},
    )

    updated = await db.reports().find_one({"session_id": session_id})
    return Report(**updated)


@router.post("/{session_id}/report/confirm", response_model=Report)
async def confirm_report(
    session_id: str,
    background_tasks: BackgroundTasks,
    current: Doctor = Depends(get_current_doctor),
) -> Report:
    """Lock the report as confirmed. Irreversible — no unconfirm endpoint.

    This is the doctor's sign-off. Once confirmed, the report is immutable,
    the patient card becomes generatable, and a follow-up reminder is
    scheduled if the report has a parseable follow-up duration and the
    patient has an email on file. The confirmed report PDF is also
    auto-sent to the patient (email + a WhatsApp heads-up), in the
    background — see services/auto_send.py.
    """
    session = await _owned_session(session_id, current.id)  # ownership check

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
    confirmed_report = Report(**updated)

    patient = await _owned_patient(session.patient_id, current.id)
    await reminder_service.schedule_followup_reminder(confirmed_report, patient)

    background_tasks.add_task(
        auto_send.send_report_to_patient, confirmed_report, patient, current
    )

    return confirmed_report


@router.post("/{session_id}/referral", response_model=ReferralSummary, status_code=201)
async def create_referral(
    session_id: str,
    payload: ReferralCreate,
    background_tasks: BackgroundTasks,
    current: Doctor = Depends(get_current_doctor),
) -> ReferralSummary:
    """Generate (or regenerate) the referral summary for a session.

    Only permitted once the report is confirmed — same rule as the patient
    card, since this is a clinical handoff document. Any field left blank
    in the payload is pre-filled from the report where possible: `reason`
    from the extracted followup.referral text, the rest snapshotted from
    the confirmed report's diagnosis/ICD codes/medications.

    Auto-sends the full referral PDF to the patient in the background. The
    receptionist does NOT get this call's output — she sees a trimmed,
    logistics-only view via GET /api/receptionist/referrals (no diagnosis,
    ICD codes, or medications), since this document carries full clinical
    content and her access is deliberately scoped below that.
    """
    session = await _owned_session(session_id, current.id)  # ownership check

    report_doc = await db.reports().find_one({"session_id": session_id})
    if report_doc is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Generate the report before the referral summary",
        )
    report = Report(**report_doc)

    if not report.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm the report before generating the referral summary",
        )

    reason = payload.reason
    if not reason and report.followup.referral:
        reason = report.followup.referral.text
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No referral reason was extracted from the transcript — "
            "provide one in the request",
        )

    referral = ReferralSummary(
        session_id=session_id,
        specialist_name=payload.specialist_name,
        department=payload.department,
        reason=reason,
        chief_complaint=report.chief_complaint.text if report.chief_complaint else None,
        diagnosis=[d.text for d in report.diagnosis],
        icd_codes=[f"{c.code} — {c.display}" for c in report.icd_codes],
        medications=[
            " — ".join(
                part
                for part in (
                    m.name.text,
                    m.dosage.text if m.dosage else None,
                    m.frequency.text if m.frequency else None,
                )
                if part
            )
            for m in report.medications
        ],
    )

    await db.referral_summaries().update_one(
        {"session_id": session_id},
        {"$set": referral.model_dump()},
        upsert=True,
    )

    patient = await _owned_patient(session.patient_id, current.id)
    background_tasks.add_task(
        auto_send.send_referral_to_patient, referral, patient, current
    )

    return referral


@router.get("/{session_id}/referral", response_model=ReferralSummary)
async def get_referral(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> ReferralSummary:
    await _owned_session(session_id, current.id)  # ownership check

    doc = await db.referral_summaries().find_one({"session_id": session_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Referral summary not generated yet"
        )
    return ReferralSummary(**doc)


@router.post("/{session_id}/referral/email")
async def email_referral(
    session_id: str,
    payload: EmailReferralRequest,
    current: Doctor = Depends(get_current_doctor),
) -> dict:
    """Send the referral letter directly to the specialist by email —
    same pattern as email_card: real SMTP send, no mail-client popup.
    """
    session = await _owned_session(session_id, current.id)

    referral_doc = await db.referral_summaries().find_one({"session_id": session_id})
    if referral_doc is None:
        raise HTTPException(status_code=404, detail="Referral summary not generated yet")
    referral = ReferralSummary(**referral_doc)

    patient = await _owned_patient(session.patient_id, current.id)

    to_line = referral.specialist_name or "Colleague"
    if referral.department:
        to_line += f", {referral.department}"

    body_lines = [
        f"To: {to_line}",
        "",
        f"Re: {patient.full_name} "
        f"({patient.age} / {patient.gender.value.title()}, ID {patient.short_id})",
        "",
        "Reason for referral:",
        referral.reason,
    ]
    if referral.chief_complaint:
        body_lines += ["", "Chief complaint:", referral.chief_complaint]
    if referral.diagnosis:
        body_lines += ["", "Diagnosis:", *[f"- {d}" for d in referral.diagnosis]]
    if referral.icd_codes:
        body_lines += ["", "ICD-10-CM codes:", *[f"- {c}" for c in referral.icd_codes]]
    if referral.medications:
        body_lines += ["", "Current medications:", *[f"- {m}" for m in referral.medications]]

    body_lines += ["", "Regards,", current.full_name]
    if current.registration_number:
        signoff = f"Reg. No. {current.registration_number}"
        if current.state_medical_council:
            signoff += f" ({current.state_medical_council})"
        body_lines.append(signoff)

    email_service.send_email(
        to_address=payload.to_email,
        subject=f"Referral: {patient.full_name}",
        body="\n".join(body_lines),
    )
    return {"sent": True}


@router.get("/{session_id}/referral/pdf")
async def export_referral_pdf(
    session_id: str,
    current: Doctor = Depends(get_current_doctor),
) -> Response:
    """Download the referral summary as a PDF letter."""
    session = await _owned_session(session_id, current.id)

    referral_doc = await db.referral_summaries().find_one({"session_id": session_id})
    if referral_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Referral summary not generated yet"
        )
    referral = ReferralSummary(**referral_doc)

    patient = await _owned_patient(session.patient_id, current.id)

    pdf_bytes = pdf_service.build_referral_pdf(referral, patient, current)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="referral-{patient.short_id}.pdf"'
        },
    )


@router.post("/{session_id}/card", response_model=PatientCard, status_code=201)
async def generate_card(
    session_id: str,
    language: Language,
    background_tasks: BackgroundTasks,
    current: Doctor = Depends(get_current_doctor),
) -> PatientCard:
    """Generate the patient explanation card, in the given language.

    Only permitted once the report is confirmed — a patient must never see
    clinical content the doctor has not signed off on. Auto-sends the card
    PDF to the patient (email + WhatsApp heads-up) in the background.
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

    background_tasks.add_task(auto_send.send_card_to_patient, card, patient)

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


@router.post("/{session_id}/card/email")
async def email_card(
    session_id: str,
    language: Language,
    payload: EmailCardRequest,
    current: Doctor = Depends(get_current_doctor),
) -> dict:
    """Actually send the patient card by email via SMTP — no browser
    mail-client popup, this really sends.
    """
    session = await _owned_session(session_id, current.id)

    card_doc = await db.patient_cards().find_one(
        {"session_id": session_id, "language": language.value}
    )
    if card_doc is None:
        raise HTTPException(status_code=404, detail="Card not generated yet")
    card = PatientCard(**card_doc)

    patient = await _owned_patient(session.patient_id, current.id)

    body_lines = [
        card.greeting, "", card.condition_explanation, "",
        "Medicines:", *[f"- {m}" for m in card.medication_instructions], "",
        card.followup_instructions,
    ]
    if card.warning_signs:
        body_lines += ["", "Return immediately if:", *[f"- {w}" for w in card.warning_signs]]

    email_service.send_email(
        to_address=payload.to_email,
        subject=f"Visit summary for {patient.full_name}",
        body="\n".join(body_lines),
    )
    return {"sent": True}


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

@router.get("/{session_id}/card/pdf")
async def export_card_pdf(
    session_id: str,
    language: Language,
    current: Doctor = Depends(get_current_doctor),
) -> Response:
    """Download the patient card as a PDF, in its own script."""
    session = await _owned_session(session_id, current.id)

    card_doc = await db.patient_cards().find_one(
        {"session_id": session_id, "language": language.value}
    )
    if card_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Card not generated yet"
        )
    card = PatientCard(**card_doc)

    patient = await _owned_patient(session.patient_id, current.id)

    pdf_bytes = await pdf_service.build_card_pdf(card, patient.full_name)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="card-{patient.short_id}-{language.value}.pdf"'
        },
    )