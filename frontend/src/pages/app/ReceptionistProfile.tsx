import { useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'

export default function ReceptionistProfile() {
  const navigate = useNavigate()
  const { receptionist, signOut } = useReceptionistAuth()

  function handleSignOut() {
    signOut()
    navigate('/receptionist/login')
  }

  if (!receptionist) return null

  const rows: [string, string][] = [
    ['Full name', receptionist.full_name],
    ['Email', receptionist.email],
    ['Member since', new Date(receptionist.created_at).toLocaleDateString()],
  ]

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <button
        onClick={() => navigate(-1)}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
      >
        ← Back
      </button>
      <div className="mt-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-seal">
          Front desk
        </p>
        <h1 className="mt-1 font-display text-2xl font-medium text-slate-900">
          Your profile
        </h1>
      </div>

      <div className="mt-6 divide-y divide-rule border border-rule bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <p className="w-40 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
              {label}
            </p>
            <p className="text-[15px] text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={handleSignOut}
          className="border border-rule px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-900 hover:bg-wash"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
