"""OPD report and patient explanation card.

Report field names deliberately mirror the FHIR R4 resources they map to:
    symptoms     -> Observation
    diagnosis    -> Condition
    medications  -> MedicationRequest
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .common import ExtractedField, Language, new_id, utcnow


class Medication(BaseModel):
    """Each component is separately extracted so each carries its own
    confidence. Dosage errors are the highest-risk failure in this system,
    so the doctor must be able to see exactly which part is uncertain.
    """

    name: ExtractedField
    dosage: ExtractedField | None = None        # "500mg"
    frequency: ExtractedField | None = None     # "TID", "twice daily"
    duration: ExtractedField | None = None      # "5 days"
    instructions: ExtractedField | None = None  # "after food"


class FollowUp(BaseModel):
    duration: ExtractedField | None = None      # "after 3 days"
    instructions: ExtractedField | None = None
    referral: ExtractedField | None = None


class IcdCode(BaseModel):
    """A diagnosis mapped to a standardized code.

    verified=True means it came from the curated lookup table (a real,
    checked ICD-10-CM code). verified=False means Claude suggested it and
    it has NOT been checked against a live terminology server — shown to
    the doctor as such, never silently presented as authoritative.
    """

    diagnosis_text: str
    code: str
    system: str = "ICD-10-CM"
    display: str
    verified: bool


class InteractionWarning(BaseModel):
    """A flagged drug-drug interaction between two of this report's
    medications. Only ever produced from the curated table in
    services/drug_interactions.py — a pair not appearing here was simply
    not checked, never confirmed safe.
    """

    drug_a: str
    drug_b: str
    severity: str          # "high" or "moderate"
    description: str


class Report(BaseModel):
    id: str = Field(default_factory=new_id)
    session_id: str
    doctor_id: str
    patient_id: str

    chief_complaint: ExtractedField | None = None
    symptoms: list[ExtractedField] = []
    diagnosis: list[ExtractedField] = []
    family_history: list[ExtractedField] = []
    icd_codes: list[IcdCode] = []
    interaction_warnings: list[InteractionWarning] = []
    medications: list[Medication] = []
    followup: FollowUp = Field(default_factory=FollowUp)
    notes: str = ""

    generated_at: datetime = Field(default_factory=utcnow)
    confirmed: bool = False
    confirmed_at: datetime | None = None


class ReferralCreate(BaseModel):
    """What the doctor submits to generate a referral letter.

    All fields optional on the way in — the router pre-fills reason from
    report.followup.referral (extracted from the transcript) when the
    doctor leaves it blank, but the doctor can override any of it before
    the letter is generated.
    """

    specialist_name: str | None = None
    department: str | None = None       # e.g. "Cardiology"
    reason: str | None = None


class ReferralSummary(BaseModel):
    """Stored referral letter record.

    Generated from the CONFIRMED report only, same rule as PatientCard —
    a referral is a clinical handoff document and must reflect signed-off
    content. Snapshots the clinical fields at generation time so the
    letter stays self-contained for re-download without recomputing from
    the report each time.
    """

    id: str = Field(default_factory=new_id)
    session_id: str

    specialist_name: str | None = None
    department: str | None = None
    reason: str

    chief_complaint: str | None = None
    diagnosis: list[str] = []
    icd_codes: list[str] = []            # "E11.9 — Type 2 diabetes mellitus"
    medications: list[str] = []          # "Metformin 500mg — BD — after food"

    generated_at: datetime = Field(default_factory=utcnow)


class ReportUpdate(BaseModel):
    """Doctor edits. Every field optional — this is a PATCH.

    Rejected once the report is confirmed. Medical records are append-only
    after sign-off.
    """

    chief_complaint: ExtractedField | None = None
    symptoms: list[ExtractedField] | None = None
    diagnosis: list[ExtractedField] | None = None
    family_history: list[ExtractedField] | None = None
    medications: list[Medication] | None = None
    followup: FollowUp | None = None
    notes: str | None = None


class PatientCard(BaseModel):
    """Plain-language explanation for the patient, in their own language.

    Generated from the CONFIRMED report only — never from raw extraction.
    The doctor must approve clinical content before a patient sees it.
    """

    id: str = Field(default_factory=new_id)
    session_id: str
    language: Language

    greeting: str
    condition_explanation: str
    medication_instructions: list[str]
    followup_instructions: str
    warning_signs: list[str] = []       # when to come back urgently

    generated_at: datetime = Field(default_factory=utcnow)