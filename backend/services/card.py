"""Patient explanation card.

Simplifies a CONFIRMED report into plain language and renders it in the
patient's own language.

Week 1: mock path only.
Week 4: Claude Sonnet implementation lands behind the same signature.

Sonnet rather than Haiku here: this text is read by a worried patient in
their own language, and phrasing quality is directly visible.
"""

import json

from anthropic import Anthropic

from config import settings
from models.common import Language
from models.report import PatientCard, Report

from . import mocks

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


_LANGUAGE_NAMES: dict[Language, str] = {
    Language.ENGLISH: "English",
    Language.HINDI: "Hindi",
    Language.KANNADA: "Kannada",
    Language.TAMIL: "Tamil",
    Language.TELUGU: "Telugu",
    Language.MALAYALAM: "Malayalam",
}


_SYSTEM_PROMPT = """You are writing a plain-language visit summary for a \
patient, based on a confirmed doctor's report. The patient is not medically \
trained and may be anxious. Write ONLY in the target language given below \
— native script, not transliteration, and not mixed with English except \
for drug names or units where that is how patients ordinarily hear them \
(e.g. "500 mg", "Paracetamol").

Rules:
- No medical jargon. Explain simply, do not transliterate clinical terms.
- Never introduce a clinical claim, symptom, diagnosis, or instruction that \
is not present in the report you are given.
- Dosage, frequency, and duration in medication_instructions must exactly \
match the report — do not round, simplify, or omit numbers.
- Always include warning_signs prompting an urgent return, drawn only from \
what the report's follow-up section says. If the report gives no warning \
signs, still include general safety advice like "if symptoms get worse, \
contact the doctor immediately" written naturally in the target language.
- Tone: warm, respectful, reassuring where appropriate, but honest.

Return ONLY valid JSON, no markdown fences, no commentary, in exactly this \
shape (all string values written in the target language):

{
  "greeting": "...",
  "condition_explanation": "...",
  "medication_instructions": ["...", "..."],
  "followup_instructions": "...",
  "warning_signs": ["...", "..."]
}"""


def _report_summary(report: Report) -> str:
    """Flatten a Report into plain text for the prompt — Claude reads this,
    not raw Pydantic JSON, so field names like 'confidence' don't leak in
    as if they were clinical content.
    """
    lines: list[str] = []

    if report.chief_complaint:
        lines.append(f"Chief complaint: {report.chief_complaint.text}")

    if report.symptoms:
        lines.append("Symptoms: " + ", ".join(s.text for s in report.symptoms))

    if report.diagnosis:
        lines.append("Diagnosis: " + ", ".join(d.text for d in report.diagnosis))

    for med in report.medications:
        parts = [med.name.text]
        if med.dosage:
            parts.append(med.dosage.text)
        if med.frequency:
            parts.append(med.frequency.text)
        if med.duration:
            parts.append(med.duration.text)
        if med.instructions:
            parts.append(med.instructions.text)
        lines.append("Medication: " + ", ".join(parts))

    if report.followup.duration:
        lines.append(f"Follow-up in: {report.followup.duration.text}")
    if report.followup.instructions:
        lines.append(f"Follow-up instructions: {report.followup.instructions.text}")
    if report.followup.referral:
        lines.append(f"Referral: {report.followup.referral.text}")

    if report.notes:
        lines.append(f"Notes: {report.notes}")

    return "\n".join(lines)


async def generate_card(
    report: Report,
    language: Language,
    patient_name: str,
) -> PatientCard:
    """Produce a plain-language card from a confirmed report.

    Callers MUST reject unconfirmed reports before reaching this function.
    A patient should never be shown clinical content the doctor has not
    signed off on.
    """
    if settings.use_mock:
        return mocks.mock_patient_card(report.session_id, language)

    client = _get_client()
    language_name = _LANGUAGE_NAMES.get(language, "English")
    summary = _report_summary(report)

    response = client.messages.create(
        model=settings.card_model,
        max_tokens=1500,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Target language: {language_name}\n\n"
                    f"Confirmed report:\n{summary}"
                ),
            }
        ],
    )

    raw_text = next(
    block.text for block in response.content if hasattr(block, "text")
).strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    data = json.loads(raw_text)

    return PatientCard(
        session_id=report.session_id,
        language=language,
        greeting=data["greeting"],
        condition_explanation=data["condition_explanation"],
        medication_instructions=data["medication_instructions"],
        followup_instructions=data["followup_instructions"],
        warning_signs=data.get("warning_signs", []),
    )