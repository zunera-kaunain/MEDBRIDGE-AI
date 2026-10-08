import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice, Field, SelectField } from '../../components/ui'
import { PatientChat } from '../../components/PatientChat'
import {
  LANGUAGE_LABELS,
  type Gender,
  type Language,
  type Patient,
  type PatientUpdate,
  type Session,
  type SessionCreate,
} from '../../types'

const LANG_TO_PAIR: Record<string, SessionCreate['language_pair']> = {
  kn: 'kn-en',
  hi: 'hi-en',
  ta: 'ta-en',
  te: 'te-en',
  ml: 'ml-en',
  en: 'en',
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [history, setHistory] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [deletingPatient, setDeletingPatient] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: '',
    age: '',
    gender: 'female' as Gender,
    phone: '',
    email: '',
    preferred_language: 'kn' as Language,
  })
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const [p, h] = await Promise.all([
          api<Patient>(`/api/patients/${id}`),
          api<Session[]>(`/api/patients/${id}/history`),
        ])
        setPatient(p)
        setHistory(h)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load patient')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function startEditing() {
    if (!patient) return
    setEditForm({
      full_name: patient.full_name,
      age: String(patient.age),
      gender: patient.gender,
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      preferred_language: patient.preferred_language,
    })
    setEditError('')
    setEditing(true)
  }

  function updateEditField(key: keyof typeof editForm, value: string) {
    setEditForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!patient) return
    setEditError('')
    setSavingEdit(true)
    try {
      const body: PatientUpdate = {
        full_name: editForm.full_name,
        age: Number(editForm.age),
        gender: editForm.gender,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        preferred_language: editForm.preferred_language,
      }
      const updated = await api<Patient>(`/api/patients/${patient.id}`, {
        method: 'PATCH',
        body,
      })
      setPatient(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setSavingEdit(false)
    }
  }

  async function startConsultation() {
    if (!patient) return
    setStarting(true)
    setError('')
    try {
      const languagePair = LANG_TO_PAIR[patient.preferred_language] ?? 'en'
      const session = await api<Session>('/api/sessions', {
        method: 'POST',
        body: {
          patient_id: patient.id,
          language_pair: languagePair,
        },
      })

      const params = new URLSearchParams({
        session: session.id,
        patient: patient.full_name,
        lang: languagePair,
      })
      navigate(`/app?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start consultation')
      setStarting(false)
    }
  }

  async function deleteSession(sessionId: string) {
    if (!window.confirm('Delete this visit permanently? This cannot be undone.')) return
    try {
      await api(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      setHistory((prev) => prev.filter((s) => s.id !== sessionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete visit')
    }
  }

  async function handleDeletePatient() {
    if (!patient) return
    const confirmed = window.confirm(
      `Permanently delete ${patient.full_name} and ALL their visit records, case sheets, and cards? This cannot be undone.`,
    )
    if (!confirmed) return

    setDeletingPatient(true)
    setError('')
    try {
      await api(`/api/patients/${patient.id}`, { method: 'DELETE' })
      navigate('/app/patients')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete patient')
      setDeletingPatient(false)
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

  if (error && !patient) {
    return (
      <AppLayout>
        <ErrorNotice message={error} />
      </AppLayout>
    )
  }

  if (!patient) return null

  return (
    <AppLayout back="none">
      <button
        onClick={() => navigate('/app/patients')}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
      >
        ← Back to patients
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            {patient.short_id}
          </p>
          {!editing && (
            <>
              <h1 className="mt-1.5 font-display text-3xl font-medium">
                {patient.full_name}
              </h1>
              <p className="mt-1 text-sm text-graphite">
                {patient.age} yrs · {patient.gender} · {LANGUAGE_LABELS[patient.preferred_language]}
                {patient.phone && ` · ${patient.phone}`}
                {patient.email && ` · ${patient.email}`}
              </p>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDeletePatient}
              disabled={deletingPatient}
              className="border border-flag px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-flag transition-colors hover:bg-flag hover:text-paper disabled:opacity-50"
            >
              {deletingPatient ? 'Deleting…' : 'Delete Patient'}
            </button>
            <button
              onClick={startEditing}
              className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
            >
              Edit
            </button>
            <Button onClick={startConsultation} loading={starting}>
              Start Consultation
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-6 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-6 py-6">
          <form onSubmit={handleSaveEdit} className="space-y-5">
            {editError && <ErrorNotice message={editError} />}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label="Full name"
                required
                value={editForm.full_name}
                onChange={(e) => updateEditField('full_name', e.target.value)}
              />
              <Field
                label="Phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => updateEditField('phone', e.target.value)}
              />
              <Field
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(e) => updateEditField('email', e.target.value)}
              />
              <Field
                label="Age"
                type="number"
                min={0}
                max={130}
                required
                value={editForm.age}
                onChange={(e) => updateEditField('age', e.target.value)}
              />
              <SelectField
                label="Gender"
                value={editForm.gender}
                onChange={(e) => updateEditField('gender', e.target.value)}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </SelectField>
            </div>

            <SelectField
              label="Language for patient card"
              value={editForm.preferred_language}
              onChange={(e) => updateEditField('preferred_language', e.target.value)}
            >
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </SelectField>

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={savingEdit}>
                Save changes
              </Button>
              <Button type="button" variant="quiet" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {error && !editing && (
        <div className="mt-4">
          <ErrorNotice message={error} />
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden">
        <div className="border-b border-rule bg-wash px-7 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            Visit History
          </p>
        </div>

        {history.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-lg">No visits yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-graphite">
              Start a consultation to create the first record.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-rule">
            {history.map((s) => (
              <div
                key={s.id}
                className="flex w-full items-center justify-between px-7 py-4 transition-colors hover:bg-wash"
              >
                <button
                  onClick={() => navigate(`/app/sessions/${s.id}/report`)}
                  className="flex flex-1 items-center justify-between text-left"
                >
                  <div>
                    <p className="text-[15px] text-ink">
                      {new Date(s.encounter_start).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-graphite">
                      {s.status}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-graphite">
                    {new Date(s.encounter_start).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
                <button
                  onClick={() => deleteSession(s.id)}
                  className="ml-4 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-flag hover:opacity-70"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <PatientChat patientId={patient.id} />
    </AppLayout>
  )
}