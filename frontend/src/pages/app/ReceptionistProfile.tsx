import { useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'
import { PublicNav } from '../../components/PublicNav'
import { DeleteAccountSection } from '../../components/DeleteAccountSection'

export default function ReceptionistProfile() {
  const navigate = useNavigate()
  const { receptionist, signOut } = useReceptionistAuth()

  function handleSignOut() {
    navigate('/', { replace: true })
    signOut()
  }

  if (!receptionist) return null

  const rows: [string, string][] = [
    ['Full name', receptionist.full_name],
    ['Email', receptionist.email],
    ['Member since', new Date(receptionist.created_at).toLocaleDateString()],
  ]

  return (
    <div className="min-h-screen">
      <PublicNav />
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
          <h1 className="mt-1 font-display text-2xl font-medium text-ink">
            Your profile
          </h1>
        </div>

        <div className="mt-6 divide-y divide-rule rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <p className="w-40 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
                {label}
              </p>
              <p className="text-[15px] text-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button
            onClick={handleSignOut}
            className="border border-rule px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink hover:bg-wash"
          >
            Sign out
          </button>
        </div>

        <DeleteAccountSection role="receptionist" />
      </div>
    </div>
  )
}
