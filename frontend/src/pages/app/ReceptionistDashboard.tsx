import { Link, useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'

/**
 * Landing page for a signed-in receptionist — links to registering a new
 * patient and viewing/reassigning existing ones.
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
        Register a new patient and route them to a doctor, or look up
        existing ones and reassign if needed.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/receptionist/patients/new"
          className="inline-block bg-seal px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-paper hover:opacity-90"
        >
          Register a patient
        </Link>
        <Link
          to="/receptionist/patients"
          className="inline-block border border-slate-300 px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-slate-900 hover:bg-slate-50"
        >
          View patients
        </Link>
        <Link
          to="/receptionist/referrals"
          className="inline-block border border-slate-300 px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-slate-900 hover:bg-slate-50"
        >
          Referrals
        </Link>
      </div>

      <div>
        <button
          onClick={handleSignOut}
          className="mt-4 border border-slate-300 px-5 py-2.5 font-mono text-[12px] uppercase tracking-[0.1em] text-slate-900 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
