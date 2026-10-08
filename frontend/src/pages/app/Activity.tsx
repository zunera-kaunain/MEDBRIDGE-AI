import { useCallback, useEffect, useState } from 'react'

import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice } from '../../components/ui'

interface AuditEntry {
  id: string
  ts: string
  actor_role?: string | null
  method: string
  route: string
  path: string
  status: number
  ip?: string | null
}

// Plain-language labels for the routes we log. Anything not listed falls back
// to the method + path so nothing is ever hidden.
const RULES: [string, RegExp, string][] = [
  ['POST', /^\/auth\/login$/, 'Signed in'],
  ['POST', /^\/auth\/google$/, 'Signed in with Google'],
  ['POST', /^\/auth\/register$/, 'Created account'],
  ['POST', /^\/auth\/forgot-password$/, 'Requested a password reset'],
  ['POST', /^\/auth\/reset-password$/, 'Reset password'],
  ['DELETE', /^\/auth\/me$/, 'Deleted account'],
  ['GET', /^\/api\/patients$/, 'Viewed patient list'],
  ['POST', /^\/api\/patients$/, 'Added a patient'],
  ['GET', /^\/api\/patients\/\{[^}]+\}$/, 'Opened a patient record'],
  ['PATCH', /^\/api\/patients\/\{[^}]+\}$/, 'Edited a patient record'],
  ['DELETE', /^\/api\/patients\/\{[^}]+\}$/, 'Deleted a patient'],
  ['GET', /report/, 'Viewed a consultation report'],
  ['GET', /card/, 'Viewed a patient card'],
  ['GET', /referral/, 'Viewed a referral'],
  ['GET', /^\/api\/audit-log$/, 'Viewed activity log'],
  ['GET', /^\/api\/dashboard/, 'Viewed dashboard'],
]

function describe(e: AuditEntry): string {
  for (const [method, re, label] of RULES) {
    if (e.method === method && re.test(e.route || e.path)) return label
  }
  return `${e.method} ${e.route || e.path}`
}

function fmt(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function Activity() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api<AuditEntry[]>('/api/audit-log?limit=200')
      .then(setRows)
      .catch((e: Error) => setError(e.message || 'Could not load activity.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return (
    <AppLayout>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        Activity
      </p>
      <h1 className="mt-2 font-display text-[28px] font-medium text-ink">Your account activity</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-graphite">
        A record of what happened under your account — sign-ins, and which records were opened or
        changed. It never stores what was said or written. If something here isn't you, change your
        password.
      </p>

      <div className="mt-6">
        <Button variant="quiet" onClick={load} loading={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mt-5">
          <ErrorNotice message={error} />
        </div>
      )}

      {rows && rows.length === 0 && !error && (
        <p className="mt-8 text-[15px] text-graphite">No activity recorded yet.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="mt-5 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden">
          <ul className="divide-y divide-rule">
            {rows.map((r) => {
              const ok = r.status < 400
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink">{describe(r)}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-graphite">
                      {fmt(r.ts)}
                      {r.ip ? ` · ${r.ip}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] ${
                      ok ? 'text-seal' : 'text-flag'
                    }`}
                  >
                    {ok ? 'OK' : `Failed · ${r.status}`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!rows && !error && (
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Loading
        </p>
      )}
    </AppLayout>
  )
}
