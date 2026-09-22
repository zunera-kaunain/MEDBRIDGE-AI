"""ICD-10-CM coding for extracted diagnoses.

Lookup order:
  1. A small curated table for common diagnoses this project's own
     evaluation set produces — instant, exact, verified.
  2. A live search against the NLM's Clinical Table Search Service — a
     free, public API backed by the official U.S. ICD-10-CM database.
     No API key needed. Verified, since it's a real terminology match,
     not a guess.
  3. A Claude Haiku suggestion, only if both above find nothing —
     explicitly marked unverified, since an LLM guess at a code is not
     the same as a checked database lookup.
"""

import json

import httpx
from anthropic import Anthropic

from config import settings
from models.report import IcdCode

_client: Anthropic | None = None

_NLM_API_URL = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


# Verified ICD-10-CM codes for diagnoses this project's evaluation set
# actually produces. Keys are lowercased for matching. Checked first
# since it's instant and needs no network call.
_LOOKUP: dict[str, tuple[str, str]] = {
    "viral fever": ("B34.9", "Viral infection, unspecified"),
    "hypertension": ("I10", "Essential (primary) hypertension"),
    "hypertension, suboptimal control": ("I10", "Essential (primary) hypertension"),
    "type 2 diabetes mellitus": ("E11.9", "Type 2 diabetes mellitus without complications"),
    "type 2 diabetes mellitus, suboptimal control": ("E11.9", "Type 2 diabetes mellitus without complications"),
    "type 2 diabetes": ("E11.9", "Type 2 diabetes mellitus without complications"),
    "diabetes mellitus": ("E11.9", "Type 2 diabetes mellitus without complications"),
    "diabetes": ("E11.9", "Type 2 diabetes mellitus without complications"),
    "gastritis": ("K29.70", "Gastritis, unspecified, without bleeding"),
    "acute pharyngitis": ("J02.9", "Acute pharyngitis, unspecified"),
    "acute pharyngitis, likely bacterial": ("J02.9", "Acute pharyngitis, unspecified"),
    "lower respiratory tract infection": ("J22", "Unspecified acute lower respiratory infection"),
}


def _lookup(diagnosis_text: str) -> tuple[str, str] | None:
    return _LOOKUP.get(diagnosis_text.strip().lower())


async def _lookup_via_nlm(diagnosis_text: str) -> tuple[str, str] | None:
    """Query the NLM Clinical Table Search Service.

    Response shape: [total_count, code_list, extra_data, display_strings]
    where display_strings is [[code, name], ...] since sf=code,name.
    Returns None on any network/parse failure rather than raising — a
    slow or unreachable external API should never block card generation.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                _NLM_API_URL,
                params={"sf": "code,name", "terms": diagnosis_text, "maxList": 1},
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError, IndexError):
        return None

    display_strings = data[3] if len(data) > 3 else []
    if not display_strings:
        return None

    code, name = display_strings[0]
    return code, name


async def _suggest_via_llm(diagnosis_text: str) -> tuple[str, str]:
    client = _get_client()
    response = client.messages.create(
        model=settings.nlp_model,
        max_tokens=200,
        system=(
            "You suggest the single most likely ICD-10-CM code for a given "
            "clinical diagnosis phrase. Return ONLY valid JSON, no markdown "
            'fences, in this exact shape: {"code": "...", "display": "..."}. '
            "If genuinely uncertain, give your best single guess rather than "
            "a list — the caller will mark this as unverified regardless."
        ),
        messages=[{"role": "user", "content": f"Diagnosis: {diagnosis_text}"}],
    )
    raw = next(b.text for b in response.content if hasattr(b, "text")).strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
    data = json.loads(raw)
    return data["code"], data["display"]


async def code_diagnosis(diagnosis_text: str) -> IcdCode:
    """Map a single diagnosis string to an ICD-10-CM code."""
    hit = _lookup(diagnosis_text)
    if hit:
        code, display = hit
        return IcdCode(diagnosis_text=diagnosis_text, code=code, display=display, verified=True)

    nlm_hit = await _lookup_via_nlm(diagnosis_text)
    if nlm_hit:
        code, display = nlm_hit
        return IcdCode(diagnosis_text=diagnosis_text, code=code, display=display, verified=True)

    code, display = await _suggest_via_llm(diagnosis_text)
    return IcdCode(diagnosis_text=diagnosis_text, code=code, display=display, verified=False)


async def code_report_diagnoses(diagnosis_texts: list[str]) -> list[IcdCode]:
    return [await code_diagnosis(text) for text in diagnosis_texts]