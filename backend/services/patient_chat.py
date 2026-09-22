"""Grounded Q&A over a single patient's confirmed visit history.

Only reads CONFIRMED reports — same rule as the patient card and FHIR
export: a doctor should never get an answer built on unreviewed AI output.
"""

from anthropic import Anthropic

from config import settings
from models.patient import Patient
from models.report import Report

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def _report_to_text(report: Report, visit_date: str) -> str:
    lines = [f"--- Visit on {visit_date} ---"]
    if report.chief_complaint:
        lines.append(f"Chief complaint: {report.chief_complaint.text}")
    if report.symptoms:
        lines.append("Symptoms: " + ", ".join(s.text for s in report.symptoms))
    if report.diagnosis:
        lines.append("Diagnosis: " + ", ".join(d.text for d in report.diagnosis))
    for m in report.medications:
        parts = [m.name.text]
        if m.dosage:
            parts.append(m.dosage.text)
        if m.frequency:
            parts.append(m.frequency.text)
        if m.duration:
            parts.append(m.duration.text)
        lines.append("Medication: " + ", ".join(parts))
    if report.followup.instructions:
        lines.append(f"Follow-up: {report.followup.instructions.text}")
    return "\n".join(lines)


_SYSTEM_PROMPT = """You answer a doctor's questions about ONE specific \
patient, using ONLY the confirmed visit history provided below. Never use \
outside medical knowledge to fill gaps, and never invent a visit, symptom, \
diagnosis, or medication that isn't explicitly in the provided history.

If the history doesn't contain the answer, say so plainly — do not guess. \
Keep answers concise and clinical, written for a doctor, not a patient. \
When relevant, mention which visit date the information comes from."""


async def ask_about_patient(
    patient: Patient,
    confirmed_reports: list[tuple[Report, str]],  # (report, visit_date)
    question: str,
) -> str:
    if not confirmed_reports:
        return "This patient has no confirmed visit records yet — nothing to answer from."

    history_text = "\n\n".join(
        _report_to_text(report, date) for report, date in confirmed_reports
    )

    client = _get_client()
    response = client.messages.create(
        model=settings.nlp_model,
        max_tokens=500,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Patient: {patient.full_name}, {patient.age} yrs, {patient.gender.value}\n\n"
                    f"Confirmed visit history:\n{history_text}\n\n"
                    f"Doctor's question: {question}"
                ),
            }
        ],
    )
    return next(b.text for b in response.content if hasattr(b, "text")).strip()