import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../../lib/api'
import { useReceptionistAuth } from '../../lib/receptionistAuth'
import { PublicNav } from '../../components/PublicNav'
import type { ReceptionistPatientSummary, ReceptionistReferralNotice } from '../../types'

// Small line-art icons, same thin-stroke style used on the doctor side's
// profile page — kept local to this file.
function IconPersonPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 20c.6-3.4 3-5.3 5.5-5.3s4.9 1.9 5.5 5.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M18 8v6M15 11h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconList({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function IconCompass({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 9l-2 6-4 2 2-6 4-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '—'
  )
}

/**
 * Landing page for a signed-in receptionist — links to registering a new
 * patient and viewing/reassigning existing ones.
 */
export default function ReceptionistDashboard() {
  const { receptionist } = useReceptionistAuth()

  const [patientCount, setPatientCount] = useState<number | null>(null)
  const [referralCount, setReferralCount] = useState<number | null>(null)

  useEffect(() => {
    api<ReceptionistPatientSummary[]>('/api/receptionist/patients', { role: 'receptionist' })
      .then((rows) => setPatientCount(rows.length))
      .catch(() => setPatientCount(null))
    api<ReceptionistReferralNotice[]>('/api/receptionist/referrals', { role: 'receptionist' })
      .then((rows) => setReferralCount(rows.length))
      .catch(() => setReferralCount(null))
  }, [])

  if (!receptionist) return null

  return (
    <div className="min-h-screen bg-paper">
      <PublicNav />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-seal">
          Front desk
        </p>

        {/* ID card header — same visual language as the doctor's profile */}
        <div className="relative mt-3 overflow-hidden border border-rule bg-white shadow-[0_1px_0_var(--color-rule),0_20px_48px_-28px_rgba(22,33,28,0.35)]">
          <div className="border-b border-rule bg-wash px-7 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
              Front desk ID
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 px-7 py-7">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-seal font-display text-xl font-medium text-paper">
              {initials(receptionist.full_name)}
            </div>
            <div>
              <h1 className="font-display text-[26px] font-medium leading-tight text-ink">
                {receptionist.full_name}
              </h1>
              <p className="mt-1 text-[15px] text-graphite">{receptionist.email}</p>
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="border border-rule bg-white px-6 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">
              Patients registered
            </p>
            <p className="mt-2 font-display text-3xl font-medium text-ink">
              {patientCount ?? '—'}
            </p>
          </div>
          <div className="border border-rule bg-white px-6 py-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">
              Referrals logged
            </p>
            <p className="mt-2 font-display text-3xl font-medium text-ink">
              {referralCount ?? '—'}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Quick actions
        </p>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Link
            to="/receptionist/patients/new"
            className="border border-rule bg-white px-6 py-6 transition-colors hover:border-seal"
          >
            <IconPersonPlus className="h-7 w-7 text-seal" />
            <p className="mt-4 font-display text-lg font-medium text-ink">
              Register a patient
            </p>
            <p className="mt-1 text-sm text-graphite">
              Add a new patient and route them to a doctor.
            </p>
          </Link>
          <Link
            to="/receptionist/patients"
            className="border border-rule bg-white px-6 py-6 transition-colors hover:border-seal"
          >
            <IconList className="h-7 w-7 text-seal" />
            <p className="mt-4 font-display text-lg font-medium text-ink">View patients</p>
            <p className="mt-1 text-sm text-graphite">
              Look up existing patients and reassign doctors.
            </p>
          </Link>
          <Link
            to="/receptionist/referrals"
            className="border border-rule bg-white px-6 py-6 transition-colors hover:border-seal"
          >
            <IconCompass className="h-7 w-7 text-seal" />
            <p className="mt-4 font-display text-lg font-medium text-ink">Referrals</p>
            <p className="mt-1 text-sm text-graphite">
              See where each patient should go next.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
