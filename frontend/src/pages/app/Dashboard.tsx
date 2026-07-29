import { useAuth } from '../../lib/auth'
import { AppLayout } from '../../components/AppLayout'
import { Stamp } from '../../components/ui'

export default function Dashboard() {
  const { doctor } = useAuth()
  if (!doctor) return null

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <AppLayout>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        {today}
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-medium">
        {doctor.full_name}
      </h1>
      <p className="mt-1 text-sm text-graphite">
        {doctor.qualification} · {doctor.specialization}
      </p>

      <div className="mt-4">
        <Stamp status={doctor.verification_status} />
      </div>

      <div className="mt-12 border border-dashed border-rule px-8 py-14 text-center">
        <p className="font-display text-lg">No consultations today</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-graphite">
          Recording and live transcription arrive in week 3. Consultations will
          appear here as you record them.
        </p>
      </div>
    </AppLayout>
  )
}