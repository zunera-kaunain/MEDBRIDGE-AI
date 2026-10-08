import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice, Field, SelectField, Stamp } from '../../components/ui'
import { RecordingPanel } from '../../components/RecordingPanel'
import { SessionInfoStrip } from '../../components/SessionInfoStrip'
import {
  LANGUAGE_LABELS,
  LANGUAGE_PAIR_LABELS,
  type Gender,
  type Language,
  type LanguagePair,
  type Patient,
  type Session,
} from '../../types'

const EMPTY_FORM = {
  full_name: '',
  age: '',
  gender: 'female' as Gender,
  phone: '',
  email: '',
  preferred_language: 'kn' as Language,
}

// Map the patient's card language to the ASR language-pair the doctor
// most likely speaks with them in.
const LANG_TO_PAIR: Record<string, LanguagePair> = {
  kn: 'kn-en',
  hi: 'hi-en',
  ta: 'ta-en',
  te: 'te-en',
  ml: 'ml-en',
  en: 'en',
}

export default function Dashboard() {
  const { doctor } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [justAdded, setJustAdded] = useState<Patient | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  // Consent gate — only relevant once a real session is in the URL.
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [consentLoading, setConsentLoading] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentError, setConsentError] = useState('')

  const rawSessionId = params.get('session')

  useEffect(() => {
    if (!rawSessionId) {
      setActiveSession(null)
      return
    }
    ;(async () => {
      try {
        const session = await api<Session>(`/api/sessions/${rawSessionId}`)
        setActiveSession(session)
      } catch (err) {
        setConsentError(err instanceof Error ? err.message : 'Could not load session')
      }
    })()
  }, [rawSessionId])

  if (!doctor) return null

  const sessionId = rawSessionId ?? 'test-session-1'
  const patientName = params.get('patient') ?? 'Test Patient'
  const languagePair = (params.get('lang') as LanguagePair) ?? 'kn-en'

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const patient = await api<Patient>('/api/patients', {
        method: 'POST',
        body: {
          full_name: form.full_name,
          age: Number(form.age),
          gender: form.gender,
          phone: form.phone || undefined,
          email: form.email || undefined,
          preferred_language: form.preferred_language,
        },
      })
      setForm(EMPTY_FORM)
      setAdding(false)
      setJustAdded(patient)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save patient')
    } finally {
      setSaving(false)
    }
  }

  async function startConsultation(patient: Patient) {
    setStarting(true)
    setStartError('')
    try {
      const pair = LANG_TO_PAIR[patient.preferred_language] ?? 'en'
      const session = await api<Session>('/api/sessions', {
        method: 'POST',
        body: {
          patient_id: patient.id,
          language_pair: pair,
        },
      })

      const newParams = new URLSearchParams({
        session: session.id,
        patient: patient.full_name,
        lang: pair,
      })
      navigate(`/app?${newParams.toString()}`)
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not start consultation')
      setStarting(false)
    }
  }

  async function handleConfirmConsent() {
    if (!activeSession) return
    setConsentLoading(true)
    setConsentError('')
    try {
      const updated = await api<Session>(`/api/sessions/${activeSession.id}/consent`, {
        method: 'POST',
        body: { confirmed: true },
      })
      setActiveSession(updated)
      setConsentChecked(false)
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : 'Could not record consent')
    } finally {
      setConsentLoading(false)
    }
  }

  const needsConsent = Boolean(rawSessionId) && activeSession !== null && !activeSession.consent_given

  return (
    <AppLayout>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        {today}
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-medium">
        {doctor.full_name}
      </h1>
      <p className="mt-1 text-sm text-graphite">
        {doctor.qualification} · {doctor.specialization}
      </p>

      <div className="mt-4">
        <Stamp status={doctor.verification_status} />
      </div>

      {!rawSessionId && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
              Patient
            </p>
            {!adding && (
              <button
                onClick={() => {
                  setAdding(true)
                  setJustAdded(null)
                }}
                className="rounded-lg border border-seal px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-seal transition-colors hover:bg-seal hover:text-paper"
              >
                + Add Patient
              </button>
            )}
          </div>

          {adding && (
            <div className="mt-3 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-6 py-6">
              <form onSubmit={handleCreate} className="space-y-5">
                {formError && <ErrorNotice message={formError} />}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    required
                    value={form.full_name}
                    onChange={(e) => update('full_name', e.target.value)}
                  />
                  <Field
                    label="Phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                  />
                  <Field
                    label="Age"
                    type="number"
                    min={0}
                    max={130}
                    required
                    value={form.age}
                    onChange={(e) => update('age', e.target.value)}
                  />
                  <SelectField
                    label="Gender"
                    value={form.gender}
                    onChange={(e) => update('gender', e.target.value)}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </SelectField>
                </div>

                <SelectField
                  label="Language for patient card"
                  value={form.preferred_language}
                  onChange={(e) => update('preferred_language', e.target.value)}
                >
                  {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </SelectField>

                <div className="flex gap-3 pt-1">
                  <Button type="submit" loading={saving}>
                    Save patient
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      setAdding(false)
                      setFormError('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {justAdded && !adding && (
            <div className="mt-3 border-l-2 border-seal bg-seal/5 px-4 py-4">
              {startError && (
                <div className="mb-3">
                  <ErrorNotice message={startError} />
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-ink">
                  <span className="font-mono text-xs text-seal">{justAdded.short_id}</span>
                  {' — '}
                  {justAdded.full_name} added.
                </p>
                <button
                  onClick={() => startConsultation(justAdded)}
                  disabled={starting}
                  className="shrink-0 rounded-lg border border-seal bg-seal px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {starting ? 'Starting…' : 'Start Consultation'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {rawSessionId && (
        <div className="mt-8">
          <SessionInfoStrip
            patientName={patientName}
            languagePair={LANGUAGE_PAIR_LABELS[languagePair] ?? languagePair}
            startTime={new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          />

          {needsConsent ? (
            <div className="mt-4 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-6 py-6">
              <p className="font-display text-lg">Patient Consent</p>
              <p className="mt-2 text-sm text-graphite">
                Before recording starts, the patient (or their attendant) must consent to
                this consultation being recorded and processed for documentation purposes.
              </p>

              {consentError && (
                <div className="mt-3">
                  <ErrorNotice message={consentError} />
                </div>
              )}

              <label className="mt-4 flex items-start gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Patient consents to this consultation being recorded and processed for
                  documentation purposes.
                </span>
              </label>

              <div className="mt-5">
                <Button onClick={handleConfirmConsent} loading={consentLoading} disabled={!consentChecked}>
                  Confirm &amp; Start Recording
                </Button>
              </div>
            </div>
          ) : activeSession ? (
            <RecordingPanel sessionId={sessionId} />
          ) : (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
              Loading session…
            </p>
          )}
        </div>
      )}
    </AppLayout>
  )
}