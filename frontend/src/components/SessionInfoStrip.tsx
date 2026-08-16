export function SessionInfoStrip({
  patientName,
  languagePair,
  startTime,
}: {
  patientName: string
  languagePair: string
  startTime: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 border border-rule bg-wash px-7 py-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
          Patient
        </p>
        <p className="mt-0.5 text-[15px] text-ink">{patientName}</p>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
          Language Pair
        </p>
        <p className="mt-0.5 text-[15px] text-ink">{languagePair}</p>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
          Encounter Start
        </p>
        <p className="mt-0.5 text-[15px] text-ink">{startTime}</p>
      </div>
    </div>
  )
}