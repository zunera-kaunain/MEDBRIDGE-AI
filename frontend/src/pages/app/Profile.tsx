import { Link } from 'react-router-dom'

import { useAuth } from '../../lib/auth'
import { AppLayout } from '../../components/AppLayout'
import { Stamp } from '../../components/ui'

export default function Profile() {
  const { doctor } = useAuth()
  if (!doctor) return null

  const rows: [string, string][] = [
    ['Full name', doctor.full_name],
    ['Email', doctor.email],
    ['Qualification', doctor.qualification || '—'],
    ['Specialisation', doctor.specialization || '—'],
    ['Registration number', doctor.registration_number || '—'],
    ['Medical council', doctor.state_medical_council || '—'],
    ['Clinic name', doctor.clinic_name || '—'],
  ]

  return (
    <AppLayout>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        Profile
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-medium text-ink">
        {doctor.full_name}
      </h1>

      <div className="mt-4">
        <Stamp status={doctor.verification_status} />
      </div>

      <div className="mt-8 divide-y divide-rule border border-rule bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <p className="w-48 shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
              {label}
            </p>
            <p className="text-[15px] text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link
          to="/complete-profile"
          className="border border-seal px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-seal transition-colors hover:bg-seal hover:text-paper"
        >
          Edit details
        </Link>
      </div>
    </AppLayout>
  )
}
