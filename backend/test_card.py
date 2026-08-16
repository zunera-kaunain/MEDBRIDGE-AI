"""Standalone test: feed a known report straight into card generation,
bypassing the API layer, to verify Sonnet card generation in isolation.

Run from inside backend/, with USE_MOCK=false in .env:
    python test_card.py
"""

import asyncio

from models.common import ExtractedField, Language
from models.report import FollowUp, Medication, Report
from services.card import generate_card

SAMPLE_REPORT = Report(
    session_id="test-session",
    doctor_id="test-doctor",
    patient_id="test-patient",
    chief_complaint=ExtractedField(text="Fever with weakness for 2 days", confidence=0.95),
    symptoms=[
        ExtractedField(text="Fever", confidence=0.95),
        ExtractedField(text="Weakness", confidence=0.9),
        ExtractedField(text="Headache", confidence=0.9),
    ],
    diagnosis=[ExtractedField(text="Viral fever", confidence=0.92)],
    medications=[
        Medication(
            name=ExtractedField(text="Paracetamol", confidence=0.95),
            dosage=ExtractedField(text="500 mg", confidence=0.95),
            frequency=ExtractedField(text="Three times daily", confidence=0.95),
            duration=ExtractedField(text="5 days", confidence=0.92),
            instructions=ExtractedField(text="After food", confidence=0.9),
        )
    ],
    followup=FollowUp(
        duration=ExtractedField(text="3 days", confidence=0.88),
        instructions=ExtractedField(
            text="Return immediately if fever crosses 102F, breathing "
            "difficulty, or severe headache. Plenty of fluids and rest.",
            confidence=0.9,
        ),
    ),
)


async def main():
    for lang in [Language.ENGLISH, Language.KANNADA, Language.HINDI]:
        print(f"\n{'=' * 20} {lang.value} {'=' * 20}")
        card = await generate_card(SAMPLE_REPORT, lang, "Test Patient")
        print(f"Greeting: {card.greeting}")
        print(f"Condition: {card.condition_explanation}")
        print(f"Medications: {card.medication_instructions}")
        print(f"Follow-up: {card.followup_instructions}")
        print(f"Warning signs: {card.warning_signs}")


if __name__ == "__main__":
    asyncio.run(main())