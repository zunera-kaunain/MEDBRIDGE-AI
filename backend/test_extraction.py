"""Standalone test: feed a known transcript straight into extraction,
bypassing ASR entirely, to verify Haiku extraction works in isolation.

Run from inside backend/, with USE_MOCK=false in .env:
    python test_extraction.py
"""

import asyncio
import json

from services.nlp import extract_report

# Same content as your kn_en_02 recording script.
SAMPLE_TRANSCRIPT = (
    "Good morning, banni kootkoli. What's the problem? Doctor, eradu divasa "
    "inda jvara ide. Thumba sustu aagide. Two days of fever with weakness. "
    "Any body pain? Mai kai novu ideya? Haudu doctor. Thale novu kooda ide. "
    "Headache as well. Let me check the temperature, ninety nine point "
    "eight, that's a mild fever. Baayi tegiri, throat nodona. The throat is "
    "slightly red, but the tonsils are not enlarged. No exudate. This is a "
    "viral fever, not bacterial, so antibiotics are not indicated. Nimage "
    "sadharana jvara ide. Antibiotic beda. Ee maathre tagoli. I'm "
    "prescribing paracetamol five hundred milligram, three times a day "
    "after food, for five days. Advise plenty of oral fluids and rest. "
    "Sari doctor. Neeru jaasti kudiyiri, vishranti tagoli. Mooru divasa "
    "nantara banni. If the fever crosses one oh two, or there's any "
    "breathing difficulty, or the headache becomes severe, she should come "
    "back immediately."
)


async def main():
    report = await extract_report(
        transcript=SAMPLE_TRANSCRIPT,
        session_id="test-session",
        doctor_id="test-doctor",
        patient_id="test-patient",
    )
    print(json.dumps(report.model_dump(), indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())