"""FHIR R4-shaped export.

Produces a FHIR Bundle for a confirmed consultation — Patient, Encounter,
Condition, Observation, and MedicationRequest resources.

Scope note: this is schema conformance only, not live ABDM Health Stack
integration. That needs sandbox credentials this project does not have.
Declared out of scope in the project brief.
"""

from models.patient import Patient
from models.report import Report
from models.session import Session


def _patient_resource(patient: Patient) -> dict:
    return {
        "resourceType": "Patient",
        "id": patient.id,
        "identifier": [{"system": "medbridge-short-id", "value": patient.short_id}],
        "name": [{"text": patient.full_name}],
        "gender": patient.gender.value,
        # FHIR wants a birthDate, not age — we only collect age, so this
        # is intentionally omitted rather than fabricating a date.
        "telecom": (
            [{"system": "phone", "value": patient.phone}] if patient.phone else []
        ),
    }


def _encounter_resource(session: Session, patient_id: str) -> dict:
    period: dict = {"start": session.encounter_start.isoformat()}
    if session.encounter_end:
        period["end"] = session.encounter_end.isoformat()

    return {
        "resourceType": "Encounter",
        "id": session.id,
        "status": "finished" if session.status == "confirmed" else "in-progress",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB",
            "display": "ambulatory",
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "period": period,
    }


def _condition_resources(report: Report, patient_id: str, encounter_id: str) -> list[dict]:
    icd_by_text = {c.diagnosis_text: c for c in report.icd_codes}

    resources = []
    for i, d in enumerate(report.diagnosis):
        icd = icd_by_text.get(d.text)
        code_field = (
            {
                "coding": [{"system": "http://hl7.org/fhir/sid/icd-10-cm", "code": icd.code, "display": icd.display}],
                "text": d.text,
            }
            if icd
            else {"text": d.text}
        )
        resources.append({
            "resourceType": "Condition",
            "id": f"{report.id}-condition-{i}",
            "code": code_field,
            "subject": {"reference": f"Patient/{patient_id}"},
            "encounter": {"reference": f"Encounter/{encounter_id}"},
            "extension": [
                {
                    "url": "http://medbridge.local/fhir/StructureDefinition/confidence",
                    "valueDecimal": d.confidence,
                }
            ],
        })
    return resources


def _observation_resources(report: Report, patient_id: str, encounter_id: str) -> list[dict]:
    resources = []
    for i, s in enumerate(report.symptoms):
        resources.append(
            {
                "resourceType": "Observation",
                "id": f"{report.id}-obs-{i}",
                "status": "final",
                "code": {"text": s.text},
                "subject": {"reference": f"Patient/{patient_id}"},
                "encounter": {"reference": f"Encounter/{encounter_id}"},
                "extension": [
                    {
                        "url": "http://medbridge.local/fhir/StructureDefinition/confidence",
                        "valueDecimal": s.confidence,
                    }
                ],
            }
        )
    return resources


def _medication_request_resources(
    report: Report, patient_id: str, encounter_id: str
) -> list[dict]:
    resources = []
    for i, m in enumerate(report.medications):
        dosage_instruction = []
        text_parts = [p.text for p in (m.dosage, m.frequency, m.instructions) if p]
        if text_parts:
            dosage_instruction.append({"text": ", ".join(text_parts)})

        resources.append(
            {
                "resourceType": "MedicationRequest",
                "id": f"{report.id}-med-{i}",
                "status": "active",
                "intent": "order",
                "medicationCodeableConcept": {"text": m.name.text},
                "subject": {"reference": f"Patient/{patient_id}"},
                "encounter": {"reference": f"Encounter/{encounter_id}"},
                "dosageInstruction": dosage_instruction,
                **(
                    {"dispenseRequest": {"expectedSupplyDuration": {"text": m.duration.text}}}
                    if m.duration
                    else {}
                ),
            }
        )
    return resources


def build_fhir_bundle(report: Report, session: Session, patient: Patient) -> dict:
    """Assemble a FHIR Bundle for a CONFIRMED report.

    Callers must reject unconfirmed reports before reaching this function —
    an export is a clinical document and should not be produced from
    unreviewed AI output, same rule as the patient card.
    """
    patient_res = _patient_resource(patient)
    encounter_res = _encounter_resource(session, patient.id)

    entries = [patient_res, encounter_res]
    entries += _condition_resources(report, patient.id, session.id)
    entries += _observation_resources(report, patient.id, session.id)
    entries += _medication_request_resources(report, patient.id, session.id)

    return {
        "resourceType": "Bundle",
        "type": "document",
        "timestamp": report.confirmed_at.isoformat() if report.confirmed_at else None,
        "entry": [{"resource": r} for r in entries],
    }