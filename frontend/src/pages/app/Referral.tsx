import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice } from '../../components/ui'
import type { Patient, Report, ReferralSummary } from '../../types'

function safeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]+/g, '_')
}

export default function ReferralPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [editingForm, setEditingForm] = useState(false)

  const [patientId, setPatientId] = useState<string | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)

  const [specialistName, setSpecialistName] = useState('')
  const [department, setDepartment] = useState('')
  const [reason, setReason] = useState('')

  const [emailAddress, setEmailAddress] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    api<{ patient_id: string }>(`/api/sessions/${sessionId}`)
      .then((s) => setPatientId(s.patient_id))
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    if (!patientId) return
    api<Patient>(`/api/patients/${patientId}`).then(setPatient).catch(() => {})
  }, [patientId])

  useEffect(() => {
    if (!sessionId) return
    api<Report>(`/api/sessions/${sessionId}/report`).then(setReport).catch(() => {})
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    api<ReferralSummary>(`/api/sessions/${sessionId}/referral`)
      .then((r) => setReferral(r))
      .catch(() => setReferral(null))
      .finally(() => setLoading(false))
  }, [sessionId])

  // Once the report loads, if there's no referral yet, pre-fill the reason
  // field from what the transcript already extracted (report.followup.referral)
  // so the doctor is editing/confirming rather than typing from scratch.
  useEffect(() => {
    if (!referral && report?.followup.referral && !reason) {
      setReason(report.followup.referral.text)
    }
  }, [report, referral, reason])

  function startEditingForm() {
    setSpecialistName(referral?.specialist_name ?? '')
    setDepartment(referral?.department ?? '')
    setReason(referral?.reason ?? report?.followup.referral?.text ?? '')
    setError('')
    setEditingForm(true)
  }

  async function handleGenerate() {
    if (!sessionId) return
    setGenerating(true)
    setError('')
    try {
      const r = await api<ReferralSummary>(`/api/sessions/${sessionId}/referral`, {
        method: 'POST',
        body: {
          specialist_name: specialistName || undefined,
          department: department || undefined,
          reason: reason || undefined,
        },
      })
      setReferral(r)
      setEditingForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate referral summary')
    } finally {
      setGenerating(false)
    }
  }

  async function handleExportPdf() {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/referral/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('medbridge_token')}` },
      })
      if (!res.ok) throw new Error('Could not export PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = patient
        ? `${safeFilename(patient.full_name)}_referral.pdf`
        : `referral-${sessionId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export PDF')
    }
  }

  async function handleEmailSend() {
    if (!sessionId || !emailAddress) return
    setSendingEmail(true)
    setError('')
    setEmailSent(false)
    try {
      await api(`/api/sessions/${sessionId}/referral/email`, {
        method: 'POST',
        body: { to_email: emailAddress },
      })
      setEmailSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const showForm = editingForm || (!loading && !referral)

  return (
    <AppLayout back="none">
      {patientId && (
        <button
          onClick={() => navigate(`/app/patients/${patientId}`)}
          className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
        >
          ← Back to patient
        </button>
      )}

      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        Referral Letter
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-medium">Referral Summary</h1>

      {error && (
        <div className="mt-4">
          <ErrorNotice message={error} />
        </div>
      )}

      {loading ? (
        <p className="mt-8 px-6 py-14 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Loading
        </p>
      ) : showForm ? (
        <div className="mt-8 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-7 py-7">
          {!referral && (
            <p className="mb-6 text-sm text-graphite">
              Generate a referral letter for this consultation. Fields left blank are
              filled in automatically where possible — the reason defaults to what
              was extracted from the transcript, and you can edit it below before
              sending.
            </p>
          )}

          <div className="space-y-5">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Specialist Name
              </label>
              <input
                value={specialistName}
                onChange={(e) => setSpecialistName(e.target.value)}
                placeholder="e.g. Dr. Rao"
                className="mt-1.5 w-full border-b border-rule bg-transparent py-1.5 text-[15px] outline-none placeholder:text-rule focus:border-seal"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Department
              </label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Cardiology"
                className="mt-1.5 w-full border-b border-rule bg-transparent py-1.5 text-[15px] outline-none placeholder:text-rule focus:border-seal"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Reason for Referral
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is the patient being referred?"
                rows={3}
                className="mt-1.5 w-full border border-rule bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-rule focus:border-seal"
              />
              {!reason && report && !report.followup.referral && (
                <p className="mt-1.5 text-xs text-graphite">
                  Nothing about a referral was picked up from the transcript — enter
                  a reason to continue.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleGenerate} loading={generating} disabled={!reason}>
              {referral ? 'Regenerate Letter' : 'Generate Referral'}
            </Button>
            {referral && (
              <Button variant="quiet" onClick={() => setEditingForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : referral ? (
        <div className="mt-8 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-7 py-7">
          <div className="border-b border-rule py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              To
            </p>
            <p className="mt-1 text-[15px] text-ink">
              {referral.specialist_name || 'The Attending Specialist'}
              {referral.department ? `, ${referral.department}` : ''}
            </p>
          </div>

          <div className="border-b border-rule py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Reason for Referral
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">{referral.reason}</p>
          </div>

          {referral.chief_complaint && (
            <div className="border-b border-rule py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Chief Complaint
              </p>
              <p className="mt-1 text-[15px] text-ink">{referral.chief_complaint}</p>
            </div>
          )}

          {referral.diagnosis.length > 0 && (
            <div className="border-b border-rule py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Diagnosis
              </p>
              <div className="mt-2 space-y-1">
                {referral.diagnosis.map((d, i) => (
                  <p key={i} className="text-[15px] text-ink">• {d}</p>
                ))}
              </div>
            </div>
          )}

          {referral.icd_codes.length > 0 && (
            <div className="border-b border-rule py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                ICD-10-CM Codes
              </p>
              <div className="mt-2 space-y-1">
                {referral.icd_codes.map((c, i) => (
                  <p key={i} className="font-mono text-xs text-graphite">{c}</p>
                ))}
              </div>
            </div>
          )}

          {referral.medications.length > 0 && (
            <div className="py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Current Medications
              </p>
              <div className="mt-2 space-y-1">
                {referral.medications.map((m, i) => (
                  <p key={i} className="text-[15px] text-ink">• {m}</p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportPdf}
              className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
            >
              Export PDF
            </button>
            <button
              onClick={startEditingForm}
              className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
            >
              Edit / Regenerate
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => {
                setEmailAddress(e.target.value)
                setEmailSent(false)
              }}
              placeholder="specialist@clinic.com"
              className="border border-rule px-3 py-2 font-mono text-[12px] outline-none focus:border-seal"
            />
            <button
              onClick={handleEmailSend}
              disabled={sendingEmail || !emailAddress}
              className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash disabled:opacity-50"
            >
              {sendingEmail ? 'Sending…' : 'Email Referral'}
            </button>
            {emailSent && (
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-seal">
                Sent ✓
              </span>
            )}
          </div>
        </div>
      ) : null}
    </AppLayout>
  )
}
