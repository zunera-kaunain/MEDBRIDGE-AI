# backend/check_mocks.py
import asyncio
from services import nlp, card, mocks
from models.common import Language

async def main():
    r = await nlp.extract_report(mocks.MOCK_TRANSCRIPT, "s1", "d1", "p1")
    print("Diagnosis:", r.diagnosis[0].text, r.diagnosis[0].confidence)
    print("Lowest confidence:", min(s.confidence for s in r.symptoms))

    c = await card.generate_card(r, Language.KANNADA, "Ramesh")
    print("Kannada card:", c.condition_explanation[:40], "...")

    n = 0
    async for _ in mocks.mock_transcript_stream(speed=20):
        n += 1
    print("Stream events:", n)

asyncio.run(main())