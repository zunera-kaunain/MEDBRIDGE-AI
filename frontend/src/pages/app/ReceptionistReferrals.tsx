import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../lib/api'
import { ErrorNotice } from '../../components/ui'
import type { ReceptionistReferralNotice } from '../../types'

export default function ReceptionistReferrals() {
  const navigate = useNavigate()
  const [referrals, setReferrals] = useState<ReceptionistReferralNotice[]>([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    api<ReceptionistReferralNotice[]>('/api/receptionist/referrals', {
      role: 'receptionist',
    })
      .then((rows) => {
        setReferrals(rows)
        setLoadError('')
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Could not load referrals')
      })
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-seal">
            Front desk
          </p>
          <h1 className="mt-1 font-display text-2xl font-medium text-slate-900">Referrals</h1>
          <p className="mt-1 text-sm text-graphite">
            Where to guide each patient next — no clinical details, just where they're headed.
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
        >
          ← Back
        </button>
      </div>

      {loadError && (
        <div className="mt-6">
          <ErrorNotice message={loadError} />
        </div>
      )}

      <div className="mt-6 divide-y divide-rule border border-rule bg-white">
        {referrals.length === 0 && !loadError && (
          <p className="px-5 py-6 text-sm text-graphite">No referrals yet.</p>
        )}
        {referrals.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-[180px] flex-1">
              <p className="font-medium text-slate-900">
                {r.patient_name}{' '}
                <span className="font-mono text-xs text-graphite">({r.patient_short_id})</span>
              </p>
              <p className="text-sm text-graphite">{r.reason}</p>
            </div>

            <div className="min-w-[220px] text-sm text-slate-900">
              {r.specialist_name || 'Specialist not specified'}
              {r.department ? (
                <span className="text-graphite"> — {r.department}</span>
              ) : null}
            </div>

            <div className="min-w-[120px] text-sm text-graphite">
              {new Date(r.generated_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
