"""Patient card generation latency: text generation vs PDF render, per
language.

Uses the existing mock report as input (deterministic, no NLP API call)
and times the two stages of card generation separately for each of the
six patient card languages:
  - generate_card()  — the Claude Sonnet call that translates and
                        simplifies the report into plain language
  - build_card_pdf() — the Playwright render to PDF (needed for correct
                        Indic script shaping)

Run from inside backend/, with USE_MOCK=false in .env (generate_card
checks this flag itself and calls the real API when false):
    python eval_card_latency.py

Uses real API calls (Claude Sonnet, 6 languages) — small cost, same
budget note as eval_extraction.py.
"""

import asyncio
import json
import time
from pathlib import Path

from services import card as card_service
from services import mocks
from services import pdf as pdf_service
from models.common import Language

PATIENT_NAME = "Test Patient"

LANGUAGES = [
    Language.ENGLISH,
    Language.HINDI,
    Language.KANNADA,
    Language.TAMIL,
    Language.TELUGU,
    Language.MALAYALAM,
]


async def main():
    report = mocks.mock_report(
        session_id="eval-card-latency",
        doctor_id="eval-doctor",
        patient_id="eval-patient",
    )

    results = []

    for language in LANGUAGES:
        print(f"\n[{language.value}] generating card...")

        start = time.perf_counter()
        card = await card_service.generate_card(report, language, PATIENT_NAME)
        generate_elapsed = time.perf_counter() - start

        start = time.perf_counter()
        await pdf_service.build_card_pdf(card, PATIENT_NAME)
        pdf_elapsed = time.perf_counter() - start

        total = generate_elapsed + pdf_elapsed
        results.append({
            "language": language.value,
            "generate_sec": round(generate_elapsed, 2),
            "pdf_render_sec": round(pdf_elapsed, 2),
            "total_sec": round(total, 2),
        })
        print(f"  generate={generate_elapsed:.2f}s  pdf_render={pdf_elapsed:.2f}s  total={total:.2f}s")

    print("\n" + "=" * 60)
    print("CARD GENERATION LATENCY")
    print("=" * 60)
    for r in results:
        print(f"{r['language']:4s}  generate={r['generate_sec']:.2f}s  "
              f"pdf_render={r['pdf_render_sec']:.2f}s  total={r['total_sec']:.2f}s")

    mean_generate = sum(r["generate_sec"] for r in results) / len(results)
    mean_pdf = sum(r["pdf_render_sec"] for r in results) / len(results)
    mean_total = sum(r["total_sec"] for r in results) / len(results)
    print(f"\nMEAN — generate={mean_generate:.2f}s  pdf_render={mean_pdf:.2f}s  total={mean_total:.2f}s")

    output_path = Path(__file__).parent.parent / "eval" / "results"
    output_path.mkdir(parents=True, exist_ok=True)
    with open(output_path / "card_latency.json", "w", encoding="utf-8") as f:
        json.dump({
            "per_language": results,
            "mean_generate_sec": round(mean_generate, 2),
            "mean_pdf_render_sec": round(mean_pdf, 2),
            "mean_total_sec": round(mean_total, 2),
        }, f, indent=2)
    print(f"\nSaved to {output_path / 'card_latency.json'}")


if __name__ == "__main__":
    asyncio.run(main())
