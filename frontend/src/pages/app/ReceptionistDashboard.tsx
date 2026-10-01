import { useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'

/**
 * Placeholder landing page for a signed-in receptionist.
 *
 * This exists only to prove the receptionist login works end-to-end.
 * The real screen — patient registration + doctor routing by chief
 * complaint and age — is the next piece of work, not built yet.
 */
export default function ReceptionistDashboard() {
  const { receptionist, signOut } = useReceptionistAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    navigate('/receptionist/login')
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-seal">
        Front desk
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium text-slate-900">
        Signed in as {receptionist?.full_name}
      </h1>
      <p className="mt-3 text-slate-600">
        Patient registration and doctor routing aren't built yet — this page
        just confirms receptionist login is working.
      </p>
      <button
        onClick={handleSignOut}
        className="mt-8 border border-slate-300 px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-slate-900 hover:bg-slate-50"
      >
        Sign out
      </button>
    </div>
  )
}
