"""Extraction evaluation: real Claude Haiku output vs ground truth.

Reads eval/data/ground_truth.jsonl, runs each transcript through the real
extract_report(), and computes precision/recall/F1 for symptoms, diagnosis,
and medications, plus per-call latency.

Run from inside backend/, with USE_MOCK=false in .env:
    python eval_extraction.py

Uses real API calls — 6 clips on Haiku is well within the $5 budget, but
this is not something to run in a loop.
"""

import asyncio
import json
import time
from pathlib import Path

from services.nlp import extract_report

GROUND_TRUTH_PATH = Path(__file__).parent.parent / "eval" / "data" / "ground_truth.jsonl"


def _normalize(text: str) -> set[str]:
    cleaned = "".join(c.lower() if c.isalnum() or c.isspace() else " " for c in text)
    return set(cleaned.split())


def _fuzzy_match(a: str, b: str) -> bool:
    """True if a and b likely refer to the same thing.

    Ground truth phrases ("fever 99.8F") and model output ("Fever") rarely
    match exactly, so this uses word-overlap plus substring checks rather
    than requiring identical strings.
    """
    ta, tb = _normalize(a), _normalize(b)
    if not ta or not tb:
        return False
    jaccard = len(ta & tb) / len(ta | tb)
    if jaccard >= 0.34:
        return True
    al, bl = a.lower(), b.lower()
    return al in bl or bl in al


def _score_list(predicted: list[str], expected: list[str]) -> dict:
    """Greedy matching: each predicted item matches at most one expected
    item. Returns tp/fp/fn counts for this single clip's field.
    """
    matched_expected: set[int] = set()
    tp = 0
    for p in predicted:
        for i, e in enumerate(expected):
            if i in matched_expected:
                continue
            if _fuzzy_match(p, e):
                matched_expected.add(i)
                tp += 1
                break
    fp = len(predicted) - tp
    fn = len(expected) - len(matched_expected)
    return {"tp": tp, "fp": fp, "fn": fn}


def _prf1(tp: int, fp: int, fn: int) -> dict:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {"precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3)}


async def main():
    if not GROUND_TRUTH_PATH.exists():
        print(f"Ground truth file not found at {GROUND_TRUTH_PATH}")
        return

    totals = {
        "symptoms": {"tp": 0, "fp": 0, "fn": 0},
        "diagnosis": {"tp": 0, "fp": 0, "fn": 0},
        "medications": {"tp": 0, "fp": 0, "fn": 0},
    }
    latencies: list[float] = []
    per_clip_results = []

    with open(GROUND_TRUTH_PATH, "r", encoding="utf-8") as f:
        lines = [json.loads(line) for line in f if line.strip()]

    for entry in lines:
        clip_id = entry["id"]
        transcript = entry["transcript"]
        expected = entry["entities"]

        start = time.perf_counter()
        report = await extract_report(
            transcript=transcript,
            session_id=f"eval-{clip_id}",
            doctor_id="eval-doctor",
            patient_id="eval-patient",
        )
        elapsed = time.perf_counter() - start
        latencies.append(elapsed)

        predicted_symptoms = [s.text for s in report.symptoms]
        predicted_diagnosis = [d.text for d in report.diagnosis]
        predicted_meds = [m.name.text for m in report.medications]

        expected_meds = [m["name"] for m in expected.get("medications", [])]

        sym_score = _score_list(predicted_symptoms, expected.get("symptoms", []))
        dx_score = _score_list(predicted_diagnosis, expected.get("diagnosis", []))
        med_score = _score_list(predicted_meds, expected_meds)

        for key, score in [("symptoms", sym_score), ("diagnosis", dx_score), ("medications", med_score)]:
            totals[key]["tp"] += score["tp"]
            totals[key]["fp"] += score["fp"]
            totals[key]["fn"] += score["fn"]

        per_clip_results.append({
            "clip_id": clip_id,
            "latency_sec": round(elapsed, 2),
            "symptoms": {**sym_score, "predicted": predicted_symptoms, "expected": expected.get("symptoms", [])},
            "diagnosis": {**dx_score, "predicted": predicted_diagnosis, "expected": expected.get("diagnosis", [])},
            "medications": {**med_score, "predicted": predicted_meds, "expected": expected_meds},
        })

        print(f"[{clip_id}] {elapsed:.2f}s — "
              f"symptoms tp={sym_score['tp']} fp={sym_score['fp']} fn={sym_score['fn']} | "
              f"diagnosis tp={dx_score['tp']} fp={dx_score['fp']} fn={dx_score['fn']} | "
              f"medications tp={med_score['tp']} fp={med_score['fp']} fn={med_score['fn']}")

    print("\n" + "=" * 60)
    print("OVERALL RESULTS")
    print("=" * 60)
    for field, counts in totals.items():
        scores = _prf1(counts["tp"], counts["fp"], counts["fn"])
        print(f"{field:12s}  P={scores['precision']:.3f}  R={scores['recall']:.3f}  F1={scores['f1']:.3f}"
              f"  (tp={counts['tp']} fp={counts['fp']} fn={counts['fn']})")

    avg_latency = sum(latencies) / len(latencies)
    print(f"\nLatency — mean: {avg_latency:.2f}s, min: {min(latencies):.2f}s, max: {max(latencies):.2f}s")

    output_path = Path(__file__).parent.parent / "eval" / "results"
    output_path.mkdir(parents=True, exist_ok=True)
    with open(output_path / "extraction_eval.json", "w", encoding="utf-8") as f:
        json.dump({
            "totals": {k: {**v, **_prf1(v["tp"], v["fp"], v["fn"])} for k, v in totals.items()},
            "latency": {"mean": avg_latency, "min": min(latencies), "max": max(latencies)},
            "per_clip": per_clip_results,
        }, f, indent=2)
    print(f"\nSaved detailed results to {output_path / 'extraction_eval.json'}")


if __name__ == "__main__":
    asyncio.run(main())