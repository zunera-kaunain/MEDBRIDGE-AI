import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice, Chip } from '../../components/ui'
import { StampBurst } from '../../components/StampBurst'
import {
  confidenceLevel,
  type ExtractedField,
  type Medication,
  type Patient,
  type Report,
} from '../../types'

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-seal',
  medium: 'text-caution',
  low: 'text-flag',
}

function field(text: string): ExtractedField {
  return { text, confidence: 1, transcript_offset: null, edited_by_doctor: true }
}

function emptyMedication(): Medication {
  return {
    name: field(''),
    dosage: field(''),
    frequency: field(''),
    duration: field(''),
    instructions: field(''),
  }
}

function safeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]+/g, '_')
}

function ViewField({ label, field }: { label: string; field: ExtractedField | null }) {
  if (!field) return null
  const level = confidenceLevel(field.confidence)
  return (
    <div className="border-b border-rule py-3 last:border-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-[15px] text-ink">{field.text}</p>
        <span className={`font-mono text-[10px] uppercase ${CONFIDENCE_COLOR[level]}`}>
          {Math.round(field.confidence * 100)}%
        </span>
      </div>
    </div>
  )
}

function EditInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border-b border-rule bg-transparent py-1.5 text-[15px] outline-none placeholder:text-rule focus:border-seal"
    />
  )
}

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [patientId, setPatientId] = useState<string | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [stampTrigger, setStampTrigger] = useState(0)
  const [codingIcd, setCodingIcd] = useState(false)
  const [checkingInteractions, setCheckingInteractions] = useState(false)
  const [interactionsChecked, setInteractionsChecked] = useState(false)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Report | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      setReport(await api<Report>(`/api/sessions/${sessionId}/report`))
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!sessionId) return
    api<{ patient_id: string }>(`/api/sessions/${sessionId}`)
      .then((s) => setPatientId(s.patient_id))
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    if (!patientId) return
    api<Patient>(`/api/patients/${patientId}`)
      .then(setPatient)
      .catch(() => {})
  }, [patientId])

  async function handleGenerate() {
    if (!sessionId) return
    setGenerating(true)
    setError('')
    try {
      const r = await api<Report>(`/api/sessions/${sessionId}/report`, {
        method: 'POST',
      })
      setReport(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate case sheet')
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateIcd() {
    if (!sessionId) return
    setCodingIcd(true)
    setError('')
    try {
      const r = await api<Report>(`/api/sessions/${sessionId}/report/icd-codes`, {
        method: 'POST',
      })
      setReport(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate ICD codes')
    } finally {
      setCodingIcd(false)
    }
  }

  async function handleCheckInteractions() {
    if (!sessionId) return
    setCheckingInteractions(true)
    setError('')
    try {
      const r = await api<Report>(`/api/sessions/${sessionId}/report/interactions`, {
        method: 'POST',
      })
      setReport(r)
      setInteractionsChecked(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check interactions')
    } finally {
      setCheckingInteractions(false)
    }
  }

  async function handleConfirm() {
    if (!sessionId) return
    setConfirming(true)
    setError('')
    try {
      const r = await api<Report>(`/api/sessions/${sessionId}/report/confirm`, {
        method: 'POST',
      })
      setReport(r)
      setStampTrigger((n) => n + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm case sheet')
    } finally {
      setConfirming(false)
    }
  }

  async function handleExportFhir() {
    if (!sessionId) return
    try {
      const bundle = await api<object>(`/api/sessions/${sessionId}/fhir`)
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = patient
        ? `${safeFilename(patient.full_name)}_fhir_bundle.json`
        : `fhir-bundle-${sessionId}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export FHIR bundle')
    }
  }

  async function handleExportPdf() {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('medbridge_token')}` },
      })
      if (!res.ok) throw new Error('Could not export PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = patient
        ? `${safeFilename(patient.full_name)}_case-sheet.pdf`
        : `case-sheet-${sessionId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export PDF')
    }
  }

  function startEditing() {
    if (!report) return
    setDraft(JSON.parse(JSON.stringify(report)) as Report)
    setError('')
    setEditing(true)
  }

  function cancelEditing() {
    setDraft(null)
    setEditing(false)
    setError('')
  }

  async function saveEdits() {
    if (!sessionId || !draft) return
    setSaving(true)
    setError('')
    try {
      const r = await api<Report>(`/api/sessions/${sessionId}/report`, {
        method: 'PATCH',
        body: {
          chief_complaint: draft.chief_complaint,
          symptoms: draft.symptoms,
          diagnosis: draft.diagnosis,
          family_history: draft.family_history,
          medications: draft.medications,
          followup: draft.followup,
        },
      })
      setReport(r)
      setEditing(false)
      setDraft(null)
      setInteractionsChecked(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="px-6 py-14 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Loading
        </p>
      </AppLayout>
    )
  }

  return (
    <AppLayout back="none">
      <StampBurst trigger={stampTrigger} label="Confirmed" />

      {patientId && (
        <button
          onClick={() => navigate(`/app/patients/${patientId}`)}
          className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
        >
          ← Back to patient
        </button>
      )}

      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            Consultation Case Sheet
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-medium">
            {report ? 'Case Sheet' : 'Generate Case Sheet'}
          </h1>
        </div>
        {report && !report.confirmed && !editing && (
          <button
            onClick={startEditing}
            className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
          >
            Edit
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNotice message={error} />
        </div>
      )}

      {!report ? (
        <div className="mt-8 border border-dashed border-rule px-8 py-14 text-center">
          <p className="font-display text-lg">No case sheet yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-graphite">
            Generate a structured case sheet from this consultation's transcript.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <Button onClick={handleGenerate} loading={generating}>
              Generate Case Sheet
            </Button>
          </div>
        </div>
      ) : editing && draft ? (
        <div className="mt-8 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-7 py-7">
          <div className="border-b border-rule py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Chief Complaint
            </p>
            <div className="mt-1.5">
              <EditInput
                value={draft.chief_complaint?.text ?? ''}
                onChange={(v) =>
                  setDraft({ ...draft, chief_complaint: v ? field(v) : null })
                }
                placeholder="Chief complaint"
              />
            </div>
          </div>

          <div className="border-b border-rule py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Symptoms
            </p>
            <div className="mt-2 space-y-2">
              {draft.symptoms.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <EditInput
                    value={s.text}
                    onChange={(v) => {
                      const next = [...draft.symptoms]
                      next[i] = field(v)
                      setDraft({ ...draft, symptoms: next })
                    }}
                  />
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        symptoms: draft.symptoms.filter((_, idx) => idx !== i),
                      })
                    }
                    className="shrink-0 font-mono text-xs text-flag hover:opacity-70"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDraft({ ...draft, symptoms: [...draft.symptoms, field('')] })}
                className="font-mono text-xs text-seal hover:opacity-70"
              >
                + Add symptom
              </button>
            </div>
          </div>

          <div className="border-b border-rule py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Diagnosis
            </p>
            <div className="mt-2 space-y-2">
              {draft.diagnosis.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <EditInput
                    value={d.text}
                    onChange={(v) => {
                      const next = [...draft.diagnosis]
                      next[i] = field(v)
                      setDraft({ ...draft, diagnosis: next })
                    }}
                  />
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        diagnosis: draft.diagnosis.filter((_, idx) => idx !== i),
                      })
                    }
                    className="shrink-0 font-mono text-xs text-flag hover:opacity-70"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() => setDraft({ ...draft, diagnosis: [...draft.diagnosis, field('')] })}
                className="font-mono text-xs text-seal hover:opacity-70"
              >
                + Add diagnosis
              </button>
            </div>
          </div>

          <div className="border-b border-rule py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Family History
            </p>
            <div className="mt-2 space-y-2">
              {draft.family_history.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <EditInput
                    value={h.text}
                    onChange={(v) => {
                      const next = [...draft.family_history]
                      next[i] = field(v)
                      setDraft({ ...draft, family_history: next })
                    }}
                  />
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        family_history: draft.family_history.filter((_, idx) => idx !== i),
                      })
                    }
                    className="shrink-0 font-mono text-xs text-flag hover:opacity-70"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setDraft({ ...draft, family_history: [...draft.family_history, field('')] })
                }
                className="font-mono text-xs text-seal hover:opacity-70"
              >
                + Add family history
              </button>
            </div>
          </div>

          <div className="border-b border-rule py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Medications
            </p>
            <div className="mt-3 space-y-4">
              {draft.medications.map((m, i) => (
                <div key={i} className="border border-rule px-4 py-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <EditInput
                      value={m.name.text}
                      placeholder="Medicine name"
                      onChange={(v) => {
                        const next = [...draft.medications]
                        next[i] = { ...next[i], name: field(v) }
                        setDraft({ ...draft, medications: next })
                      }}
                    />
                    <EditInput
                      value={m.dosage?.text ?? ''}
                      placeholder="Dosage"
                      onChange={(v) => {
                        const next = [...draft.medications]
                        next[i] = { ...next[i], dosage: v ? field(v) : null }
                        setDraft({ ...draft, medications: next })
                      }}
                    />
                    <EditInput
                      value={m.frequency?.text ?? ''}
                      placeholder="Frequency"
                      onChange={(v) => {
                        const next = [...draft.medications]
                        next[i] = { ...next[i], frequency: v ? field(v) : null }
                        setDraft({ ...draft, medications: next })
                      }}
                    />
                    <EditInput
                      value={m.duration?.text ?? ''}
                      placeholder="Duration"
                      onChange={(v) => {
                        const next = [...draft.medications]
                        next[i] = { ...next[i], duration: v ? field(v) : null }
                        setDraft({ ...draft, medications: next })
                      }}
                    />
                    <EditInput
                      value={m.instructions?.text ?? ''}
                      placeholder="Instructions"
                      onChange={(v) => {
                        const next = [...draft.medications]
                        next[i] = { ...next[i], instructions: v ? field(v) : null }
                        setDraft({ ...draft, medications: next })
                      }}
                    />
                  </div>
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        medications: draft.medications.filter((_, idx) => idx !== i),
                      })
                    }
                    className="mt-3 font-mono text-xs text-flag hover:opacity-70"
                  >
                    Remove medication
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setDraft({ ...draft, medications: [...draft.medications, emptyMedication()] })
                }
                className="font-mono text-xs text-seal hover:opacity-70"
              >
                + Add medication
              </button>
            </div>
          </div>

          <div className="py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Follow-up
            </p>
            <div className="mt-2 space-y-3">
              <EditInput
                value={draft.followup.duration?.text ?? ''}
                placeholder="Follow-up duration"
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    followup: { ...draft.followup, duration: v ? field(v) : null },
                  })
                }
              />
              <EditInput
                value={draft.followup.instructions?.text ?? ''}
                placeholder="Follow-up instructions"
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    followup: { ...draft.followup, instructions: v ? field(v) : null },
                  })
                }
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={saveEdits} loading={saving}>
              Save changes
            </Button>
            <Button variant="quiet" onClick={cancelEditing}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-7 py-7">
          <ViewField label="Chief Complaint" field={report.chief_complaint} />

          {report.symptoms.length > 0 && (
            <div className="border-b border-rule py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Symptoms
              </p>
              <div className="mt-2 space-y-2">
                {report.symptoms.map((s, i) => (
                  <div key={i} className="flex items-baseline gap-2">
                    <p className="text-[15px] text-ink">{s.text}</p>
                    <span
                      className={`font-mono text-[10px] uppercase ${CONFIDENCE_COLOR[confidenceLevel(s.confidence)]}`}
                    >
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.diagnosis.length > 0 && (
            <div className="border-b border-rule py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                  Diagnosis
                </p>
                {report.icd_codes.length === 0 && (
                  <button
                    onClick={handleGenerateIcd}
                    disabled={codingIcd}
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-seal hover:opacity-70 disabled:opacity-50"
                  >
                    {codingIcd ? 'Coding…' : '+ Generate ICD Codes'}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {report.diagnosis.map((d, i) => {
                  const icd = report.icd_codes.find((c) => c.diagnosis_text === d.text)
                  return (
                    <div key={i}>
                      <div className="flex items-baseline gap-2">
                        <p className="text-[15px] text-ink">{d.text}</p>
                        <span
                          className={`font-mono text-[10px] uppercase ${CONFIDENCE_COLOR[confidenceLevel(d.confidence)]}`}
                        >
                          {Math.round(d.confidence * 100)}%
                        </span>
                      </div>
                      {icd && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="font-mono text-xs text-graphite">
                            {icd.system} {icd.code} — {icd.display}
                          </span>
                          <Chip tone={icd.verified ? 'seal' : 'caution'}>
                            {icd.verified ? 'Verified' : 'AI-suggested'}
                          </Chip>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {report.family_history.length > 0 && (
            <div className="border-b border-rule py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Family History
              </p>
              <div className="mt-2 space-y-2">
                {report.family_history.map((h, i) => (
                  <div key={i} className="flex items-baseline gap-2">
                    <p className="text-[15px] text-ink">{h.text}</p>
                    <span
                      className={`font-mono text-[10px] uppercase ${CONFIDENCE_COLOR[confidenceLevel(h.confidence)]}`}
                    >
                      {Math.round(h.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.medications.length > 0 && (
            <div className="border-b border-rule py-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                  Medications
                </p>
                {report.medications.length > 1 && (
                  <button
                    onClick={handleCheckInteractions}
                    disabled={checkingInteractions}
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-seal hover:opacity-70 disabled:opacity-50"
                  >
                    {checkingInteractions ? 'Checking…' : '+ Check Interactions'}
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-4">
                {report.medications.map((m, i) => (
                  <div key={i} className="border border-rule px-4 py-3">
                    <p className="font-medium text-ink">{m.name.text}</p>
                    <p className="mt-1 text-sm text-graphite">
                      {[m.dosage?.text, m.frequency?.text, m.duration?.text, m.instructions?.text]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>

              {report.interaction_warnings.length > 0 && (
                <div className="mt-4 space-y-2">
                  {report.interaction_warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`border-l-2 px-4 py-3 ${
                        w.severity === 'high'
                          ? 'border-flag bg-flag/5'
                          : 'border-caution bg-caution/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Chip tone={w.severity === 'high' ? 'flag' : 'caution'}>
                          {w.severity === 'high' ? 'High risk' : 'Moderate risk'}
                        </Chip>
                        <span className="font-mono text-xs text-ink">
                          {w.drug_a} + {w.drug_b}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-graphite">{w.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {interactionsChecked && report.interaction_warnings.length === 0 && (
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-seal">
                  No known interactions found in the curated table
                </p>
              )}
            </div>
          )}

          <div className="py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Follow-up
            </p>
            <ViewField label="Duration" field={report.followup.duration} />
            <ViewField label="Instructions" field={report.followup.instructions} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!report.confirmed ? (
              <Button onClick={handleConfirm} loading={confirming}>
                Confirm Case Sheet
              </Button>
            ) : (
              <>
                <span className="border border-seal px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-seal">
                  Confirmed
                </span>
                <Button
                  variant="quiet"
                  onClick={() => navigate(`/app/sessions/${sessionId}/card`)}
                >
                  View Patient Card
                </Button>
                <button
                  onClick={() => navigate(`/app/sessions/${sessionId}/referral`)}
                  className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
                >
                  Referral Summary
                </button>
                <button
                  onClick={handleExportFhir}
                  className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
                >
                  Export FHIR
                </button>
                <button
                  onClick={handleExportPdf}
                  className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
                >
                  Export PDF
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}