import { Link } from 'react-router-dom'

import { useAuth } from '../../lib/auth'
import { AppLayout } from '../../components/AppLayout'
import { DeleteAccountSection } from '../../components/DeleteAccountSection'
import { Stamp } from '../../components/ui'

// Small line-art icons, same thin-stroke style as the doodle background —
// kept local to this page rather than exported, since nothing else needs
// them yet.
function IconScroll({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 3h11v15a3 3 0 0 1-3 3H7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 21a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 8h5M10 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 21V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 10h5a1 1 0 0 1 1 1v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 9h.01M8 13h.01M8 17h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 21h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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

const STATUS_NOTE: Record<string, { border: string; bg: string; body: string }> = {
  pending: {
    border: 'border-caution',
    bg: 'bg-[#f3ecd9]',
    body: "These details appear on every case sheet you generate, but they aren't checked against the Indian Medical Register — that's why the stamp above still reads verification pending.",
  },
  verified: {
    border: 'border-seal',
    bg: 'bg-[#e4ece8]',
    body: 'These details have been verified and appear on every case sheet you generate.',
  },
  rejected: {
    border: 'border-flag',
    bg: 'bg-[#f6e9e3]',
    body: 'These details were not accepted on review. Update them below to be re-checked.',
  },
}

export default function Profile() {
  const { doctor } = useAuth()
  if (!doctor) return null

  const note = STATUS_NOTE[doctor.verification_status]
  const memberSince = new Date(doctor.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <AppLayout>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        Profile
      </p>

      {/* Practitioner ID card — the signature visual for this page */}
      <div className="relative mt-3 overflow-hidden rounded-2xl border border-rule/80 bg-white/90 shadow-[0_1px_0_var(--color-rule),0_20px_48px_-28px_rgba(22,33,28,0.35)]">
        <div className="border-b border-rule bg-wash px-7 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            Practitioner ID
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-6 px-7 py-7">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-seal font-display text-2xl font-medium text-paper">
            {initials(doctor.full_name)}
          </div>

          <div className="min-w-[220px] flex-1">
            <h1 className="font-display text-[30px] font-medium leading-tight text-ink">
              {doctor.full_name}
            </h1>
            <p className="mt-1 text-[15px] text-graphite">
              {doctor.qualification || 'Qualification pending'}
              {doctor.specialization ? ` · ${doctor.specialization}` : ''}
            </p>
            <p className="mt-2.5 font-mono text-[12px] tracking-[0.08em] text-graphite">
              {doctor.registration_number || 'No registration number on file'}
            </p>
          </div>

          <div className="shrink-0 pt-1">
            <Stamp status={doctor.verification_status} />
          </div>
        </div>
      </div>

      {/* Detail cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-6 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">
            Practice
          </p>
          <dl className="mt-4 space-y-5">
            <div className="flex items-start gap-3">
              <IconScroll className="mt-0.5 h-5 w-5 shrink-0 text-seal" />
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                  Medical council
                </dt>
                <dd className="mt-0.5 text-[15px] text-ink">
                  {doctor.state_medical_council || '—'}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <IconBuilding className="mt-0.5 h-5 w-5 shrink-0 text-seal" />
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                  Clinic
                </dt>
                <dd className="mt-0.5 text-[15px] text-ink">{doctor.clinic_name || '—'}</dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-6 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">
            Account
          </p>
          <dl className="mt-4 space-y-5">
            <div className="flex items-start gap-3">
              <IconMail className="mt-0.5 h-5 w-5 shrink-0 text-seal" />
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                  Email
                </dt>
                <dd className="mt-0.5 text-[15px] text-ink">{doctor.email}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <IconCalendar className="mt-0.5 h-5 w-5 shrink-0 text-seal" />
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">
                  Member since
                </dt>
                <dd className="mt-0.5 text-[15px] text-ink">{memberSince}</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      <div className={`mt-6 border-l-2 ${note.border} ${note.bg} px-5 py-4 text-sm leading-relaxed text-ink`}>
        {note.body}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/complete-profile"
          className="inline-block border border-seal px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-seal transition-colors hover:bg-seal hover:text-paper"
        >
          Edit details
        </Link>
        <Link
          to="/app/activity"
          className="inline-block border border-rule px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:text-ink"
        >
          Account activity
        </Link>
      </div>

      <DeleteAccountSection role="doctor" />
    </AppLayout>
  )
}
