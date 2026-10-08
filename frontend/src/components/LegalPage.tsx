import { BackButton } from './BackButton'
import type { LegalDoc } from './legalContent'
import { PublicFooter } from './PublicFooter'
import { PublicNav } from './PublicNav'

/** Shared sections list, used both on the full page and inside the popup. */
export function LegalSections({ doc }: { doc: LegalDoc }) {
  return (
    <div className="space-y-8">
      {doc.sections.map((s) => (
        <section key={s.heading}>
          <h2 className="font-display text-xl font-medium text-ink">{s.heading}</h2>
          <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-graphite">
            {s.body}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Full-page layout for the Privacy Policy and Terms of Use. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen">
      <PublicNav />
      <div className="mx-auto max-w-2xl px-6 py-12">
        <BackButton fallback="/" />
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          {doc.label}
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium text-ink">{doc.title}</h1>
        <p className="mt-6 text-[17px] leading-relaxed text-graphite">{doc.intro}</p>

        <div className="mt-10">
          <LegalSections doc={doc} />
        </div>

        <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
          Questions? medbridgeai@gmail.com
        </p>
      </div>
      <PublicFooter />
    </div>
  )
}
