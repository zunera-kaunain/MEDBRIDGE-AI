import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../../lib/api'
import { Chip, ErrorNotice, Field } from '../../components/ui'
import type { DoctorForRouting, ReceptionistPatientSummary, SessionStatus } from '../../types'

const STATUS_LABEL: Record<SessionStatus, string> = {
  recording: 'Recording',
  processing: 'Processing',
  ready: 'Ready for review',
  confirmed: 'Confirmed',
  failed: 'Failed',
}

const STATUS_TONE: Record<SessionStatus, 'seal' | 'caution' | 'flag' | 'graphite'> = {
  recording: 'caution',
  processing: 'caution',
  ready: 'seal',
  confirmed: 'seal',
  failed: 'flag',
}

export default function ReceptionistPatients() {
  const [patients, setPatients] = useState<ReceptionistPatientSummary[]>([])
  const [doctors, setDoctors] = useState<DoctorForRouting[]>([])
  const [q, setQ] = useState('')
  const [loadError, setLoadError] = useState('')
  const [reassignError, setReassignError] = useState('')
  const [reassigningId, setReassigningId] = useState<string | null>(null)

  async function loadPatients(search: string) {
    try {
      const path = search
        ? `/api/receptionist/patients?q=${encodeURIComponent(search)}`
        : '/api/receptionist/patients'
      const rows = await api<ReceptionistPatientSummary[]>(path, { role: 'receptionist' })
      setPatients(rows)
      setLoadError('')
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load patients')
    }
  }

  useEffect(() => {
    api<DoctorForRouting[]>('/api/receptionist/doctors', { role: 'receptionist' }).then(
      setDoctors,
    )
    loadPatients('')
  }, [])

  // Debounced search — refetch 300ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => loadPatients(q), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  async function handleReassign(patientId: string, doctorId: string) {
    setReassignError('')
    setReassigningId(patientId)
    try {
      await api(`/api/receptionist/patients/${patientId}/doctor`, {
        method: 'PATCH',
        body: { doctor_id: doctorId },
        role: 'receptionist',
      })
      await loadPatients(q)
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : 'Could not reassign patient')
    } finally {
      setReassigningId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-seal">
            Front desk
          </p>
          <h1 className="mt-1 font-display text-2xl font-medium text-slate-900">Patients</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/receptionist/referrals"
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-seal hover:opacity-80"
          >
            Referrals
          </Link>
          <Link
            to="/receptionist/patients/new"
            className="bg-seal px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-paper hover:opacity-90"
          >
            Register a patient
          </Link>
        </div>
      </div>

      <div className="mt-6 max-w-sm">
        <Field
          label="Search"
          name="q"
          placeholder="Name, phone, or short ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loadError && (
        <div className="mt-4">
          <ErrorNotice message={loadError} />
        </div>
      )}
      {reassignError && (
        <div className="mt-4">
          <ErrorNotice message={reassignError} />
        </div>
      )}

      <div className="mt-6 divide-y divide-rule border border-rule bg-white">
        {patients.length === 0 && !loadError && (
          <p className="px-5 py-6 text-sm text-graphite">No patients yet.</p>
        )}
        {patients.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-[180px] flex-1">
              <p className="font-medium text-slate-900">
                {p.full_name}{' '}
                <span className="font-mono text-xs text-graphite">({p.short_id})</span>
              </p>
              <p className="text-sm text-graphite">
                {p.age} yrs
                {p.intake_chief_complaint ? ` · ${p.intake_chief_complaint}` : ''}
              </p>
            </div>

            <div className="min-w-[200px]">
              <select
                value={p.doctor_id}
                disabled={reassigningId === p.id}
                onChange={(e) => handleReassign(p.id, e.target.value)}
                className="w-full border-b border-rule bg-transparent pb-1 text-sm outline-none focus:border-seal"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                    {d.specialization ? ` — ${d.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[140px]">
              {p.latest_session_status ? (
                <Chip tone={STATUS_TONE[p.latest_session_status]}>
                  {STATUS_LABEL[p.latest_session_status]}
                </Chip>
              ) : (
                <Chip tone="graphite">No consultation yet</Chip>
              )}
            </div>

            <div className="min-w-[160px] text-sm text-graphite">
              {p.next_followup_at
                ? `Follow-up: ${new Date(p.next_followup_at).toLocaleDateString()}`
                : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
