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


class Report(BaseModel):
    id: str = Field(default_factory=new_id)
    session_id: str
    doctor_id: str
    patient_id: str

    chief_complaint: ExtractedField | None = None
    symptoms: list[ExtractedField] = []
    diagnosis: list[ExtractedField] = []
    medications: list[Medication] = []
    followup: FollowUp = Field(default_factory=FollowUp)
    notes: str = ""

    generated_at: datetime = Field(default_factory=utcnow)
    confirmed: bool = False
    confirmed_at: datetime | None = None


class ReportUpdate(BaseModel):
    """Doctor edits. Every field optional — this is a PATCH.

    Rejected once the report is confirmed. Medical records are append-only
    after sign-off.
    """

    chief_complaint: ExtractedField | None = None
    symptoms: list[ExtractedField] | None = None
    diagnosis: list[ExtractedField] | None = None
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