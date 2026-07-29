"""Patient explanation card.

Simplifies a CONFIRMED report into plain language and renders it in the
patient's own language.

Week 1: mock path only.
Week 4: Claude Sonnet implementation lands behind the same signature.

Sonnet rather than Haiku here: this text is read by a worried patient in
their own language, and phrasing quality is directly visible.
"""

from config import settings
from models.common import Language
from models.report import PatientCard, Report

from . import mocks


async def generate_card(
    report: Report,
    language: Language,
    patient_name: str,
) -> PatientCard:
    """Produce a plain-language card from a confirmed report.

    Callers MUST reject unconfirmed reports before reaching this function.
    A patient should never be shown clinical content the doctor has not
    signed off on.

    Content rules for the real implementation:
      - no medical jargon; explain, do not transliterate
      - never introduce clinical claims absent from the report
      - dosage instructions must match the report exactly
      - always include warning signs prompting an urgent return
    """
    if settings.use_mock:
        return mocks.mock_patient_card(report.session_id, language)

    raise NotImplementedError(
        "Claude card generation lands in week 4. Set USE_MOCK=true for now."
    )