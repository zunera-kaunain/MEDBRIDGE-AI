"""Medical entity extraction.

Turns a raw transcript into a structured Report with per-field confidence
and transcript offsets.

Week 1: mock path only.
Week 4: Claude Haiku implementation lands behind the same signature.

Cost note: this runs once per consultation, on Haiku. Never Sonnet, never
in a loop, and always through the dev cache while prompt-tuning.
"""

import json

from anthropic import Anthropic

from config import settings
from models.common import ExtractedField
from models.report import FollowUp, Medication, Report

from . import mocks

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


_SYSTEM_PROMPT = """You are a medical scribe assistant extracting structured \
data from a doctor-patient consultation transcript. The transcript may mix \
English with Kannada, Hindi, or other Indian languages (code-switched \
speech), and may contain speech-recognition errors.

Extract ONLY what is explicitly stated in the transcript. Never invent \
information. If a field is not mentioned, omit it or use null / empty list \
as appropriate — never guess.

Pay close attention to NEGATION. If the doctor asks about a symptom and the \
patient denies it (says no, "illa", "nahi", or similar), that symptom is \
ABSENT. Do NOT add an entry for it in "symptoms" at all — not even phrased \
as "no X" or "denies X". Absent means the symptom is left out of the list \
entirely, exactly as if it had never been mentioned. Only symptoms the \
patient reports as present or experienced belong in the list.

For every extracted value, also give a confidence score from 0.0 to 1.0 \
reflecting how clearly and unambiguously the transcript supports that \
value (not your certainty about the underlying medical fact).

Return ONLY valid JSON, no markdown fences, no commentary, matching \
exactly this shape:

{
  "chief_complaint": {"text": "...", "confidence": 0.0},
  "symptoms": [{"text": "...", "confidence": 0.0}],
  "diagnosis": [{"text": "...", "confidence": 0.0}],
  "medications": [
    {
      "name": {"text": "...", "confidence": 0.0},
      "dosage": {"text": "...", "confidence": 0.0},
      "frequency": {"text": "...", "confidence": 0.0},
      "duration": {"text": "...", "confidence": 0.0},
      "instructions": {"text": "...", "confidence": 0.0}
    }
  ],
  "followup": {
    "duration": {"text": "...", "confidence": 0.0},
    "instructions": {"text": "...", "confidence": 0.0},
    "referral": null
  }
}

Any field with no supporting evidence in the transcript should be null \
(for single fields) or an empty list (for symptoms/diagnosis/medications). \
Never fabricate a plausible-sounding value to fill a gap."""


def _find_offset(transcript: str, text: str) -> tuple[int, int] | None:
    """Locate the extracted text's approximate span in the transcript.

    Case-insensitive, since Claude may normalise capitalisation. Returns
    None if the exact phrase can't be located — better to show no
    highlight than a wrong one.
    """
    if not text:
        return None
    idx = transcript.lower().find(text.lower())
    if idx == -1:
        return None
    return (idx, idx + len(text))


def _field(transcript: str, raw: dict | None) -> ExtractedField | None:
    if not raw or not raw.get("text"):
        return None
    return ExtractedField(
        text=raw["text"],
        confidence=float(raw.get("confidence", 0.5)),
        transcript_offset=_find_offset(transcript, raw["text"]),
    )


async def extract_report(
    transcript: str,
    session_id: str,
    doctor_id: str,
    patient_id: str,
) -> Report:
    """Extract symptoms, diagnosis, medications and follow-up.

    Every returned ExtractedField must carry:
      - confidence in [0.0, 1.0]
      - transcript_offset pointing at the span that produced it

    The offsets are not optional. The UI highlights source text when a
    field is focused, and a doctor cannot verify a value they cannot trace.
    """
    if settings.use_mock:
        return mocks.mock_report(session_id, doctor_id, patient_id)

    client = _get_client()

    response = client.messages.create(
        model=settings.nlp_model,
        max_tokens=2000,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Transcript:\n\n{transcript}",
            }
        ],
    )

    raw_text = next(
    block.text for block in response.content if hasattr(block, "text")
).strip()
    # Defensive: strip markdown fences if the model adds them despite
    # instructions not to.
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
    data = json.loads(raw_text)

    symptoms = [
        f for f in (_field(transcript, s) for s in data.get("symptoms", [])) if f
    ]
    diagnosis = [
        f for f in (_field(transcript, d) for d in data.get("diagnosis", [])) if f
    ]

    medications = []
    for m in data.get("medications", []):
        name = _field(transcript, m.get("name"))
        if name is None:
            continue  # a medication without a name isn't usable
        medications.append(
            Medication(
                name=name,
                dosage=_field(transcript, m.get("dosage")),
                frequency=_field(transcript, m.get("frequency")),
                duration=_field(transcript, m.get("duration")),
                instructions=_field(transcript, m.get("instructions")),
            )
        )

    followup_raw = data.get("followup", {}) or {}
    followup = FollowUp(
        duration=_field(transcript, followup_raw.get("duration")),
        instructions=_field(transcript, followup_raw.get("instructions")),
        referral=_field(transcript, followup_raw.get("referral")),
    )

    return Report(
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        chief_complaint=_field(transcript, data.get("chief_complaint")),
        symptoms=symptoms,
        diagnosis=diagnosis,
        medications=medications,
        followup=followup,
    )