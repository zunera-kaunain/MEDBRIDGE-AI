import { useAuth } from '../../lib/auth'
import { Stamp } from '../../components/ui'

export default function Dashboard() {
  const { doctor, signOut } = useAuth()
  if (!doctor) return null

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <p className="font-display text-lg font-medium">MedBridge AI</p>
          <button
            onClick={signOut}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Signed in as
        </p>
        <h1 className="mt-2 font-display text-3xl font-medium">
          {doctor.full_name}
        </h1>

        <p className="mt-1 text-sm text-graphite">
          {doctor.qualification} · {doctor.specialization}
        </p>

        <div className="mt-4 flex items-center gap-4">
          <span className="font-mono text-xs text-graphite">
            {doctor.registration_number}
          </span>
          <Stamp status={doctor.verification_status} />
        </div>

        {/* Empty states are an invitation to act, not an apology. */}
        <div className="mt-12 border border-dashed border-rule px-8 py-14 text-center">
          <p className="font-display text-lg">No consultations yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-graphite">
            Recording and live transcription arrive in week 3. This is where
            today's consultations will appear.
          </p>
        </div>
      </main>
    </div>
  )
}