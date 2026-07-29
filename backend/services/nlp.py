"""Medical entity extraction.

Turns a raw transcript into a structured Report with per-field confidence
and transcript offsets.

Week 1: mock path only.
Week 4: Claude Haiku implementation lands behind the same signature.

Cost note: this runs once per consultation, on Haiku. Never Sonnet, never
in a loop, and always through the dev cache while prompt-tuning.
"""

from config import settings
from models.report import Report

from . import mocks


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

    raise NotImplementedError(
        "Claude extraction lands in week 4. Set USE_MOCK=true for now."
    )