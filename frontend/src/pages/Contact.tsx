import { PublicNav } from '../components/PublicNav'
import { PublicFooter } from '../components/PublicFooter'

const EMAIL = 'medbridgeai@gmail.com'

export default function Contact() {
  return (
    <div className="min-h-screen bg-paper">
      <PublicNav />

      <div className="mx-auto max-w-2xl px-6 py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Contact
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium text-ink">
          Get in touch.
        </h1>
        <p className="mt-6 text-[17px] leading-relaxed text-graphite">
          Questions about MedBridge AI, feedback on the project, or curious
          how it works under the hood — reach out by email and we'll get
          back to you.
        </p>

        <div className="mt-10 border border-rule bg-white px-7 py-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">
            Email
          </p>
          <a
            href={`mailto:${EMAIL}`}
            className="mt-1.5 block font-display text-2xl font-medium text-seal hover:opacity-80"
          >
            {EMAIL}
          </a>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-graphite">
          MedBridge AI is a final-year capstone project (VTU, B.E. AI &amp;
          Data Science) — response times may vary during academic terms.
        </p>
      </div>

      <PublicFooter />
    </div>
  )
}
