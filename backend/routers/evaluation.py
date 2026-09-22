"""Serves pre-computed evaluation results (extraction P/R/F1, WER/CER)
for display in the app, and lets a doctor trigger a fresh evaluation run
on demand rather than automatically — extraction re-runs cost real API
calls, and WER re-runs re-transcribe audio on CPU, so neither should
happen silently on every page load.
"""

import asyncio
import json
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from middleware.auth import get_current_doctor
from models.doctor import Doctor

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])

BACKEND_DIR = Path(__file__).parent.parent          # .../medbridge-ai/backend
PROJECT_ROOT = BACKEND_DIR.parent                     # .../medbridge-ai
RESULTS_DIR = PROJECT_ROOT / "eval" / "results"


def _load(filename: str) -> dict:
    path = RESULTS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found — run the eval script first")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def _run_script(script_name: str) -> None:
    """Run an evaluation script as a subprocess and wait for it to finish.

    Requires the Proactor event loop (set in run.py) — the default
    Windows event loop cannot launch subprocesses.
    """
    proc = await asyncio.create_subprocess_exec(
        sys.executable, script_name,
        cwd=str(BACKEND_DIR),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=f"{script_name} failed: {stderr.decode(errors='replace')[-2000:]}",
        )


@router.get("/extraction")
async def get_extraction_eval(current: Doctor = Depends(get_current_doctor)) -> dict:
    return _load("extraction_eval.json")


@router.get("/wer")
async def get_wer_eval(current: Doctor = Depends(get_current_doctor)) -> dict:
    return _load("wer_eval.json")


@router.post("/extraction/run")
async def rerun_extraction_eval(current: Doctor = Depends(get_current_doctor)) -> dict:
    """Re-run entity extraction evaluation. Makes real Claude API calls —
    takes roughly 20-40 seconds for the 6-clip evaluation set.
    """
    await _run_script("eval_extraction.py")
    return _load("extraction_eval.json")


@router.post("/wer/run")
async def rerun_wer_eval(current: Doctor = Depends(get_current_doctor)) -> dict:
    """Re-run ASR WER/CER evaluation. Re-transcribes each clip with
    Whisper on CPU — can take several minutes.
    """
    await _run_script("eval_wer.py")
    return _load("wer_eval.json")