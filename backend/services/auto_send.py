"""Best-effort auto-send: fires after the doctor confirms a report,
generates a patient card, or generates a referral. Every function here
swallows its own exceptions and logs instead of raising — a failed email
or WhatsApp send must never break report confirmation or document
generation, and the route that calls these should always run them via
BackgroundTasks so the doctor isn't kept waiting on SMTP/Twilio latency.

Silently skips whichever channel the patient has no contact info for
(phone and email are both optional on Patient — see models/patient.py).
"""

import asyncio
import logging

from models.doctor import Doctor
from models.patient import Patient
from models.report import PatientCard, ReferralSummary, Report
from services import email as email_service
from services import pdf as pdf_service
from services import whatsapp as whatsapp_service

logger = logging.getLogger(__name__)


async def send_report_to_patient(report: Report, patient: Patient, doctor: Doctor) -> None:
    """Auto-send on report confirmation: the full clinical report, as a
    PDF, straight to the patient's email. WhatsApp just gets a short
    heads-up text, not the document itself (see services/whatsapp.py).
    """
    if patient.email:
        try:
            pdf_bytes = await asyncio.to_thread(
                pdf_service.build_report_pdf, report, patient, doctor
            )
            await asyncio.to_thread(
                email_service.send_email_with_attachments,
                to_address=patient.email,
                subject=f"Your visit case sheet — {patient.full_name}",
                body=(
                    f"Dear {patient.full_name},\n\n"
                    f"Your visit case sheet from Dr. {doctor.full_name} is attached.\n\n"
                    "Regards,\nMedBridge AI"
                ),
                attachments=[
                    email_service.EmailAttachment(
                        filename=f"case-sheet-{patient.short_id}.pdf", content=pdf_bytes
                    )
                ],
            )
        except Exception:
            logger.exception("Auto-send: report email failed for patient %s", patient.id)

    if patient.phone:
        try:
            await whatsapp_service.send_whatsapp_message(
                patient.phone,
                f"Hi {patient.full_name}, your visit case sheet from Dr. {doctor.full_name} "
                "has been emailed to you. — MedBridge AI",
            )
        except Exception:
            logger.exception("Auto-send: report WhatsApp failed for patient %s", patient.id)


async def send_card_to_patient(card: PatientCard, patient: Patient) -> None:
    """Auto-send on patient-card generation: the plain-language card, as a
    PDF, to the patient's email + a WhatsApp heads-up.
    """
    if patient.email:
        try:
            pdf_bytes = await pdf_service.build_card_pdf(card, patient.full_name)
            await asyncio.to_thread(
                email_service.send_email_with_attachments,
                to_address=patient.email,
                subject=f"Visit summary for {patient.full_name}",
                body=(
                    f"Dear {patient.full_name},\n\n"
                    "Your visit summary is attached.\n\n"
                    "Regards,\nMedBridge AI"
                ),
                attachments=[
                    email_service.EmailAttachment(
                        filename=f"card-{patient.short_id}-{card.language.value}.pdf",
                        content=pdf_bytes,
                    )
                ],
            )
        except Exception:
            logger.exception("Auto-send: card email failed for patient %s", patient.id)

    if patient.phone:
        try:
            await whatsapp_service.send_whatsapp_message(
                patient.phone,
                f"Hi {patient.full_name}, your visit summary has been emailed to you. "
                "— MedBridge AI",
            )
        except Exception:
            logger.exception("Auto-send: card WhatsApp failed for patient %s", patient.id)


async def send_referral_to_patient(
    referral: ReferralSummary, patient: Patient, doctor: Doctor
) -> None:
    """Auto-send on referral generation: the full referral letter (PDF,
    with diagnosis/ICD/medications) to the patient's email + a WhatsApp
    heads-up.

    The receptionist does NOT get this — she sees a logistics-only view
    (specialist/department/reason, no clinical detail) via
    GET /api/receptionist/referrals instead. See the privacy-boundary
    discussion in routers/receptionist.py.
    """
    if patient.email:
        try:
            pdf_bytes = await asyncio.to_thread(
                pdf_service.build_referral_pdf, referral, patient, doctor
            )
            await asyncio.to_thread(
                email_service.send_email_with_attachments,
                to_address=patient.email,
                subject=f"Your referral — {patient.full_name}",
                body=(
                    f"Dear {patient.full_name},\n\n"
                    f"Dr. {doctor.full_name} has referred you"
                    + (f" to {referral.specialist_name}" if referral.specialist_name else "")
                    + (f", {referral.department}" if referral.department else "")
                    + ". Details are attached.\n\n"
                    "Regards,\nMedBridge AI"
                ),
                attachments=[
                    email_service.EmailAttachment(
                        filename=f"referral-{patient.short_id}.pdf", content=pdf_bytes
                    )
                ],
            )
        except Exception:
            logger.exception("Auto-send: referral email failed for patient %s", patient.id)

    if patient.phone:
        try:
            where = referral.specialist_name or "a specialist"
            await whatsapp_service.send_whatsapp_message(
                patient.phone,
                f"Hi {patient.full_name}, Dr. {doctor.full_name} has referred you to "
                f"{where}. Details have been emailed to you. — MedBridge AI",
            )
        except Exception:
            logger.exception("Auto-send: referral WhatsApp failed for patient %s", patient.id)
