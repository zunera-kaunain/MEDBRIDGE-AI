"""Mock fixtures for development without a GPU or API key.

Active when USE_MOCK=true. Everything here mirrors exactly what the real
services return, so swapping USE_MOCK to false must change nothing about
the shapes the frontend receives.

The fixtures are deliberately realistic: a genuine Kannada-English
code-switched consultation, and a report containing BOTH high and low
confidence fields so the badge colours can be tested properly.
"""

import asyncio
from typing import AsyncIterator

from models.common import ExtractedField, Language
from models.report import FollowUp, Medication, PatientCard, Report
from models.session import (
    FinalEvent,
    PartialEvent,
    TranscriptEvent,
    TranscriptSegment,
)

# ---------------------------------------------------------------------------
# Transcript
#
# Romanised Kannada mixed with English clinical vocabulary — the exact
# pattern the system exists to handle.
# ---------------------------------------------------------------------------

MOCK_SEGMENT_TEXTS = [
    "Namaskara, hegidira? Yenu problem?",
    "Doctor, nange fever ide, thumba weakness anisutte.",
    "Yeshtu divasa inda fever ide?",
    "Moru divasa inda. Jothege headache kooda ide.",
    "Sari, throat pain ideya? Cough?",
    "Swalpa throat pain ide, cough illa.",
    "Idu viral fever irbahudu. Paracetamol five hundred mg tagolli, "
    "dinakke mooru sala, oota nantara.",
    "Five days tagolli. Jaasti water kudiyiri, rest madi.",
    "Moru divasa nantara banni, check madona. "
    "Fever jaasti aadre bega banni.",
]


def _build_transcript() -> tuple[str, list[TranscriptSegment]]:
    """Assemble the transcript and compute character offsets for each segment.

    The offsets are what let the UI highlight the source text when a report
    field is focused. The real ASR service must produce these identically.
    """
    segments: list[TranscriptSegment] = []
    parts: list[str] = []
    cursor = 0
    t = 0.0

    for text in MOCK_SEGMENT_TEXTS:
        duration = max(1.5, len(text) * 0.055)
        start_char = cursor
        end_char = cursor + len(text)

        segments.append(
            TranscriptSegment(
                text=text,
                start_sec=round(t, 2),
                end_sec=round(t + duration, 2),
                char_offset=(start_char, end_char),
            )
        )

        parts.append(text)
        cursor = end_char + 1  # the joining space
        t += duration + 0.4    # inter-segment pause

    return " ".join(parts), segments


MOCK_TRANSCRIPT, MOCK_SEGMENTS = _build_transcript()
MOCK_DURATION_SEC = MOCK_SEGMENTS[-1].end_sec


def _find(needle: str) -> tuple[int, int] | None:
    i = MOCK_TRANSCRIPT.find(needle)
    return (i, i + len(needle)) if i >= 0 else None


# ---------------------------------------------------------------------------
# Report
#
# Confidence values span all three badge colours on purpose:
#   >= 0.85 green · 0.60-0.85 amber · < 0.60 red
# ---------------------------------------------------------------------------

MOCK_REPORT_PAYLOAD = {
    "chief_complaint": ExtractedField(
        text="Fever with weakness for 3 days",
        confidence=0.91,
        transcript_offset=_find("nange fever ide"),
    ),
    "symptoms": [
        ExtractedField(text="Fever", confidence=0.96,
                       transcript_offset=_find("fever ide")),
        ExtractedField(text="Weakness", confidence=0.88,
                       transcript_offset=_find("weakness anisutte")),
        ExtractedField(text="Headache", confidence=0.84,
                       transcript_offset=_find("headache kooda ide")),
        # Low confidence on purpose — exercises the red badge and the
        # doctor-review workflow.
        ExtractedField(text="Mild sore throat", confidence=0.54,
                       transcript_offset=_find("Swalpa throat pain ide")),
    ],
    "diagnosis": [
        ExtractedField(text="Viral fever", confidence=0.89,
                       transcript_offset=_find("viral fever irbahudu")),
    ],
    "medications": [
        Medication(
            name=ExtractedField(text="Paracetamol", confidence=0.97,
                                transcript_offset=_find("Paracetamol")),
            dosage=ExtractedField(text="500 mg", confidence=0.72,
                                  transcript_offset=_find("five hundred mg")),
            frequency=ExtractedField(text="Three times daily", confidence=0.90,
                                     transcript_offset=_find("dinakke mooru sala")),
            duration=ExtractedField(text="5 days", confidence=0.86,
                                    transcript_offset=_find("Five days tagolli")),
            instructions=ExtractedField(text="After food", confidence=0.93,
                                        transcript_offset=_find("oota nantara")),
        )
    ],
    "followup": FollowUp(
        duration=ExtractedField(text="After 3 days", confidence=0.92,
                                transcript_offset=_find("Moru divasa nantara banni")),
        instructions=ExtractedField(text="Increase fluid intake, adequate rest",
                                    confidence=0.87,
                                    transcript_offset=_find("Jaasti water kudiyiri")),
        referral=None,
    ),
}


def mock_report(session_id: str, doctor_id: str, patient_id: str) -> Report:
    return Report(
        session_id=session_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        **MOCK_REPORT_PAYLOAD,
    )


# ---------------------------------------------------------------------------
# Patient cards
# ---------------------------------------------------------------------------

_CARDS: dict[Language, dict] = {
    Language.ENGLISH: {
        "greeting": "Here is a summary of your visit today.",
        "condition_explanation": (
            "You have a viral fever. This is a common infection caused by a "
            "virus. It usually gets better on its own within a few days with "
            "rest and plenty of fluids."
        ),
        "medication_instructions": [
            "Paracetamol 500 mg — one tablet three times a day, after food, for 5 days.",
            "Do not take more than the prescribed amount.",
        ],
        "followup_instructions": (
            "Please come back for a check-up after 3 days. Drink plenty of "
            "water and get enough rest until then."
        ),
        "warning_signs": [
            "Fever above 103°F that does not come down",
            "Difficulty breathing",
            "Severe or continuous vomiting",
            "Fever lasting more than 5 days",
        ],
    },
    Language.KANNADA: {
        "greeting": "ಇಂದಿನ ನಿಮ್ಮ ಭೇಟಿಯ ಸಾರಾಂಶ ಇಲ್ಲಿದೆ.",
        "condition_explanation": (
            "ನಿಮಗೆ ವೈರಲ್ ಜ್ವರ ಇದೆ. ಇದು ವೈರಸ್‌ನಿಂದ ಬರುವ ಸಾಮಾನ್ಯ ಸೋಂಕು. "
            "ವಿಶ್ರಾಂತಿ ಮತ್ತು ಸಾಕಷ್ಟು ನೀರು ಕುಡಿದರೆ ಕೆಲವೇ ದಿನಗಳಲ್ಲಿ ವಾಸಿಯಾಗುತ್ತದೆ."
        ),
        "medication_instructions": [
            "ಪ್ಯಾರಸಿಟಮಾಲ್ 500 ಮಿಗ್ರಾ — ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ, ಊಟದ ನಂತರ, 5 ದಿನಗಳವರೆಗೆ.",
            "ಸೂಚಿಸಿದ ಪ್ರಮಾಣಕ್ಕಿಂತ ಹೆಚ್ಚು ತೆಗೆದುಕೊಳ್ಳಬೇಡಿ.",
        ],
        "followup_instructions": (
            "3 ದಿನಗಳ ನಂತರ ಪರೀಕ್ಷೆಗೆ ಬನ್ನಿ. ಅಲ್ಲಿಯವರೆಗೆ ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ "
            "ಮತ್ತು ವಿಶ್ರಾಂತಿ ತೆಗೆದುಕೊಳ್ಳಿ."
        ),
        "warning_signs": [
            "103°F ಗಿಂತ ಹೆಚ್ಚಿನ ಜ್ವರ ಇಳಿಯದಿದ್ದರೆ",
            "ಉಸಿರಾಟದ ತೊಂದರೆ",
            "ತೀವ್ರ ಅಥವಾ ನಿರಂತರ ವಾಂತಿ",
            "5 ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಜ್ವರ",
        ],
    },
    Language.HINDI: {
        "greeting": "आज की आपकी जाँच का सारांश यहाँ है।",
        "condition_explanation": (
            "आपको वायरल बुखार है। यह वायरस से होने वाला एक सामान्य संक्रमण है। "
            "आराम और पर्याप्त पानी पीने से यह कुछ ही दिनों में ठीक हो जाता है।"
        ),
        "medication_instructions": [
            "पैरासिटामोल 500 मिग्रा — दिन में तीन बार, खाने के बाद, 5 दिन तक।",
            "बताई गई मात्रा से अधिक न लें।",
        ],
        "followup_instructions": (
            "3 दिन बाद जाँच के लिए आइए। तब तक खूब पानी पिएँ और आराम करें।"
        ),
        "warning_signs": [
            "103°F से अधिक बुखार जो कम न हो",
            "साँस लेने में कठिनाई",
            "तेज़ या लगातार उल्टी",
            "5 दिन से अधिक बुखार रहना",
        ],
    },
}


def mock_patient_card(session_id: str, language: Language) -> PatientCard:
    data = _CARDS.get(language, _CARDS[Language.ENGLISH])
    return PatientCard(session_id=session_id, language=language, **data)


# ---------------------------------------------------------------------------
# Simulated streaming
#
# Reproduces the real WebSocket behaviour: partials that grow and rewrite
# themselves, then a final event when VAD detects a silence boundary.
# ---------------------------------------------------------------------------

async def mock_transcript_stream(
    speed: float = 1.0,
) -> AsyncIterator[TranscriptEvent]:
    """Yield partial/final events at roughly conversational pace.

    speed > 1.0 runs faster (useful for tests). The frontend must not be
    able to tell this apart from the real stream.
    """
    for segment in MOCK_SEGMENTS:
        words = segment.text.split()
        built = ""

        for word in words:
            built = f"{built} {word}".strip()
            yield PartialEvent(text=built)
            await asyncio.sleep(0.18 / speed)

        # VAD silence boundary reached — segment settles.
        await asyncio.sleep(0.35 / speed)
        yield FinalEvent(segment=segment)