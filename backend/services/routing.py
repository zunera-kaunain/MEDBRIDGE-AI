"""Receptionist patient-to-doctor routing suggestion.

Deliberately simple keyword/age heuristic, not a model call — there's no
training data for "which of our handful of doctors should see this
complaint", and a wrong AI guess here is harder to notice than a wrong
rule. The receptionist always has final say (see require UI), so this
only needs to be a reasonable default, not infallible.
"""

from models.doctor import DoctorForRouting

PEDIATRIC_KEYWORDS = ("paediatric", "pediatric", "child")

# complaint keyword -> specialization keywords to look for, checked in
# order; first match wins. Extend this list as the clinic's doctor roster
# grows more specialties.
COMPLAINT_SPECIALTY_MAP: list[tuple[tuple[str, ...], tuple[str, ...]]] = [
    (("skin", "rash", "itch", "acne"), ("dermatolog",)),
    (("heart", "chest pain", "palpitation", "blood pressure"), ("cardiolog",)),
    (("bone", "fracture", "joint", "back pain", "knee", "shoulder"), ("orthopaed", "orthoped")),
    (("eye", "vision", "blurry"), ("ophthalmolog", "eye")),
    (("ear", "throat", "nose", "sinus", "hearing"), ("ent", "otolaryngolog")),
    (("anxiety", "depression", "stress", "sleep"), ("psychiatr", "mental health")),
    (("pregnan", "period", "menstru"), ("gynaecolog", "gynecolog", "obstetric")),
    (("skin burn", "wound", "cut", "injury", "accident"), ("surg", "emergency")),
]


def suggest_doctor(
    chief_complaint: str, age: int, doctors: list[DoctorForRouting]
) -> str | None:
    """Return the suggested doctor's id, or None if no doctors exist.

    The receptionist still picks from the full dropdown and can always
    override this — it's a starting point, not a decision.
    """
    if not doctors:
        return None

    complaint = chief_complaint.lower()

    # Children go to a paediatrician first, regardless of complaint — a
    # general clinic convention, not a complaint-specific rule.
    if age < 18:
        for doc in doctors:
            spec = (doc.specialization or "").lower()
            if any(kw in spec for kw in PEDIATRIC_KEYWORDS):
                return doc.id

    for triggers, specialty_keywords in COMPLAINT_SPECIALTY_MAP:
        if any(trigger in complaint for trigger in triggers):
            for doc in doctors:
                spec = (doc.specialization or "").lower()
                if any(kw in spec for kw in specialty_keywords):
                    return doc.id

    # No specific match — prefer a General Medicine doctor if one exists,
    # otherwise just the first doctor in the list.
    for doc in doctors:
        spec = (doc.specialization or "").lower()
        if "general" in spec:
            return doc.id

    return doctors[0].id
