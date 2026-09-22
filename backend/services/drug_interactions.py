"""Drug-drug interaction checking.

Same honesty pattern as services/icd.py: a curated table of well-known,
textbook drug interactions, checked pairwise. This is intentionally NOT
exhaustive — it only catches interactions we've explicitly listed. Anything
involving a medication not in the table is not silently treated as safe;
the caller is expected to show "not checked against known interactions"
for those, not a false-negative "no interactions found".

Matching is exact (lowercased, stripped) generic-name matching only, same
limitation as the ICD curated lookup — no brand-name resolution, no fuzzy
matching. Worth mentioning if asked: "the interaction table matches exact
generic names; a brand name or misspelling won't be caught."
"""

from itertools import combinations

from models.report import InteractionWarning

# Keys are frozensets of two lowercased generic drug names — order doesn't
# matter for a pairwise interaction. Values are (severity, description).
# Severity is "high" or "moderate", used by the frontend to choose the
# warning's visual weight.
_INTERACTIONS: dict[frozenset[str], tuple[str, str]] = {
    frozenset({"warfarin", "aspirin"}): (
        "high",
        "Combined anticoagulant/antiplatelet effect significantly increases bleeding risk.",
    ),
    frozenset({"warfarin", "ibuprofen"}): (
        "high",
        "NSAID use with warfarin increases GI bleeding and displaces warfarin from protein binding.",
    ),
    frozenset({"warfarin", "diclofenac"}): (
        "high",
        "NSAID use with warfarin increases GI bleeding risk.",
    ),
    frozenset({"aspirin", "ibuprofen"}): (
        "moderate",
        "Ibuprofen can blunt aspirin's antiplatelet effect if taken together regularly.",
    ),
    frozenset({"enalapril", "spironolactone"}): (
        "moderate",
        "ACE inhibitor with a potassium-sparing diuretic raises hyperkalemia risk.",
    ),
    frozenset({"lisinopril", "spironolactone"}): (
        "moderate",
        "ACE inhibitor with a potassium-sparing diuretic raises hyperkalemia risk.",
    ),
    frozenset({"ramipril", "spironolactone"}): (
        "moderate",
        "ACE inhibitor with a potassium-sparing diuretic raises hyperkalemia risk.",
    ),
    frozenset({"enalapril", "ibuprofen"}): (
        "moderate",
        "NSAIDs can reduce the antihypertensive effect of ACE inhibitors and stress renal function.",
    ),
    frozenset({"lisinopril", "ibuprofen"}): (
        "moderate",
        "NSAIDs can reduce the antihypertensive effect of ACE inhibitors and stress renal function.",
    ),
    frozenset({"amlodipine", "simvastatin"}): (
        "moderate",
        "Amlodipine raises simvastatin plasma levels, increasing myopathy risk at higher statin doses.",
    ),
    frozenset({"glimepiride", "propranolol"}): (
        "moderate",
        "Beta-blockers can mask the warning signs of sulfonylurea-induced hypoglycemia.",
    ),
    frozenset({"glipizide", "propranolol"}): (
        "moderate",
        "Beta-blockers can mask the warning signs of sulfonylurea-induced hypoglycemia.",
    ),
    frozenset({"metformin", "furosemide"}): (
        "moderate",
        "Furosemide can affect renal clearance of metformin; monitor renal function.",
    ),
    frozenset({"ciprofloxacin", "calcium carbonate"}): (
        "moderate",
        "Calcium significantly reduces ciprofloxacin absorption if taken together — separate dosing by 2+ hours.",
    ),
    frozenset({"doxycycline", "calcium carbonate"}): (
        "moderate",
        "Calcium significantly reduces doxycycline absorption if taken together — separate dosing by 2+ hours.",
    ),
    frozenset({"azithromycin", "domperidone"}): (
        "moderate",
        "Both can prolong the QT interval; combined use raises arrhythmia risk.",
    ),
    frozenset({"ondansetron", "azithromycin"}): (
        "moderate",
        "Both can prolong the QT interval; combined use raises arrhythmia risk.",
    ),
}


def check_interactions(medication_names: list[str]) -> list[InteractionWarning]:
    """Check every pair of medication names against the curated table.

    Names are matched case-insensitively, exact-match only. Returns only
    the pairs that actually matched — callers should treat every other
    pair as "not checked", never as "confirmed safe".
    """
    normalized = [(raw, raw.strip().lower()) for raw in medication_names]
    warnings: list[InteractionWarning] = []

    for (raw_a, norm_a), (raw_b, norm_b) in combinations(normalized, 2):
        if norm_a == norm_b:
            continue
        hit = _INTERACTIONS.get(frozenset({norm_a, norm_b}))
        if hit is None:
            continue
        severity, description = hit
        warnings.append(
            InteractionWarning(
                drug_a=raw_a,
                drug_b=raw_b,
                severity=severity,
                description=description,
            )
        )

    return warnings