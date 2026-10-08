import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { PublicNav } from '../components/PublicNav'
import { PublicFooter } from '../components/PublicFooter'

/* Small line icons, drawn with currentColor to match the ink-on-paper look. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}
const MicIcon = () => (
  <Icon>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Icon>
)
const ListIcon = () => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
  </Icon>
)
const CardIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M7 10h6M7 14h10" />
  </Icon>
)
const ShieldIcon = () => (
  <Icon>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)

const LANGUAGES = [
  { name: 'ಕನ್ನಡ', en: 'Kannada' },
  { name: 'हिन्दी', en: 'Hindi' },
  { name: 'தமிழ்', en: 'Tamil' },
  { name: 'తెలుగు', en: 'Telugu' },
  { name: 'മലയാളം', en: 'Malayalam' },
  { name: 'English', en: 'English' },
]

const cardShadow =
  'shadow-[0_1px_0_var(--color-rule),0_24px_56px_-30px_rgba(22,33,28,0.45)]'

export default function Landing() {
  return (
    <div className="min-h-screen">
      <PublicNav />

      {/* Hero */}
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-14 sm:pt-20">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
          <div className="mb-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-seal/30 bg-white/70 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-seal backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-seal" />
              Final-year capstone · VTU
            </span>
            <h1 className="mt-6 font-display text-[36px] font-medium leading-[1.1] text-ink sm:text-[48px]">
              What the doctor says in English.
              <br />
              What the patient hears in{' '}
              <span className="bg-gradient-to-r from-seal to-[#2f8f77] bg-clip-text text-transparent">
                their own language.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-graphite">
              Indian physicians think and document in English. Patients speak
              Kannada, Hindi, and more. In the gap between the two, warning
              signs and dosing details routinely get lost. MedBridge closes
              that gap.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="rounded-xl bg-gradient-to-b from-[#14705b] to-seal px-7 py-3.5 font-mono text-[13px] uppercase tracking-[0.1em] text-paper shadow-[0_12px_28px_-12px_rgba(15,92,74,0.8)] transition-all hover:-translate-y-0.5 hover:brightness-110"
              >
                Start a Consultation
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-rule bg-white/70 px-7 py-3.5 font-mono text-[13px] uppercase tracking-[0.1em] text-ink backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Visual proof — the actual transformation, shown not told */}
          <div className="mb-fade-up mb-delay-2 relative">
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-seal/10 via-transparent to-caution/10 blur-2xl"
            />
            <div className={`overflow-hidden rounded-2xl border border-rule bg-white/90 backdrop-blur ${cardShadow}`}>
              <div className="flex items-center gap-2 border-b border-rule bg-wash/80 px-5 py-2.5">
                <span className="h-2 w-2 rounded-full bg-seal" />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                  Doctor says — English
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[14px] leading-relaxed text-ink">
                  "Paracetamol five hundred milligram, three times a day, after
                  food, for five days. If the fever crosses one oh two, or
                  there's breathing difficulty, come back immediately."
                </p>
              </div>
            </div>

            <div className="mb-float relative z-10 -mt-1 ml-6 sm:ml-10">
              <div className="mx-auto -mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-rule bg-white text-seal shadow-sm">
                ↓
              </div>
              <div className={`overflow-hidden rounded-2xl border border-rule bg-white ${cardShadow}`}>
                <div className="flex items-center justify-between border-b border-rule bg-gradient-to-r from-wash to-[#e4eee8] px-5 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                    Patient receives — ಕನ್ನಡ
                  </p>
                  <span className="rounded-full border border-seal/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-seal">
                    Complete
                  </span>
                </div>
                <div className="space-y-2 px-5 py-4">
                  <p className="text-[14px] leading-relaxed text-ink">
                    ಪ್ಯಾರಸಿಟಮಾಲ್ 500 ಮಿಗ್ರಾ — ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ, ಊಟದ ನಂತರ, 5
                    ದಿನಗಳವರೆಗೆ.
                  </p>
                  <div className="rounded-lg border-l-2 border-flag bg-[#f6e9e3] px-3 py-2">
                    <p className="text-[13px] leading-relaxed text-ink">
                      103°F ಗಿಂತ ಹೆಚ್ಚಿನ ಜ್ವರ ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದ್ದರೆ ತಕ್ಷಣ
                      ಬನ್ನಿ.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 ml-6 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite sm:ml-10">
              Nothing dropped in translation — including the warning sign.
            </p>
          </div>
        </div>
      </div>

      {/* Languages band */}
      <div className="border-y border-rule/70 bg-white/60 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-3 px-6">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.18em] text-graphite">
            Patient cards in
          </span>
          {LANGUAGES.map((l) => (
            <span
              key={l.en}
              title={l.en}
              className="rounded-full border border-rule bg-white px-4 py-1.5 text-[14px] text-ink shadow-sm transition-colors hover:border-seal hover:text-seal"
            >
              {l.name}
            </span>
          ))}
        </div>
      </div>

      {/* The problem */}
      <div className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            The problem
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium text-ink">
            Not a language barrier. A compression problem.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              {
                n: '01',
                tone: 'text-seal border-seal',
                body: 'The doctor examines and states findings in English — the language of clinical training and record-keeping.',
              },
              {
                n: '02',
                tone: 'text-caution border-caution',
                body: 'A compressed summary is spoken back to the patient in their own language — necessarily shorter than what was said.',
              },
              {
                n: '03',
                tone: 'text-flag border-flag',
                body: 'Warning signs, dosing rationale, and what to watch for are frequently the first things lost in that compression.',
              },
            ].map((item) => (
              <div
                key={item.n}
                className="rounded-2xl border border-rule/80 bg-white/80 p-6 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] backdrop-blur transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgba(22,33,28,0.5)]"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[12px] font-medium ${item.tone}`}
                >
                  {item.n}
                </span>
                <p className="mt-4 text-[15px] leading-relaxed text-ink">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="border-t border-rule/70 bg-gradient-to-b from-wash/70 to-transparent py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium text-ink">
            Full detail in, full detail out.
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                icon: <MicIcon />,
                title: 'Live transcription during the consultation',
                body: 'Real-time, code-switched speech recognition captures the full conversation as it happens — no separate note-taking step.',
              },
              {
                icon: <ListIcon />,
                title: 'Structured clinical extraction',
                body: 'Symptoms, diagnosis, medications, and follow-up are pulled out automatically, each with a confidence score the doctor can review and correct.',
              },
              {
                icon: <CardIcon />,
                title: "A complete card, in the patient's language",
                body: 'The full clinical detail — including every warning sign — is translated into a plain-language card the patient can actually take home and understand.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="group relative rounded-2xl border border-rule/80 bg-white/90 p-6 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] transition-all hover:-translate-y-1 hover:border-seal/50 hover:shadow-[0_20px_44px_-24px_rgba(15,92,74,0.45)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-seal/15 to-seal/5 text-seal transition-colors group-hover:from-seal group-hover:to-[#14705b] group-hover:text-paper">
                    {item.icon}
                  </span>
                  <span className="font-display text-3xl font-medium text-rule">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-lg font-medium text-ink">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-graphite">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Doctor in the loop */}
      <div className="pb-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col items-start gap-5 rounded-2xl border border-seal/20 bg-gradient-to-br from-seal/10 via-white/70 to-white/60 p-8 backdrop-blur sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-seal text-paper">
              <ShieldIcon />
            </span>
            <div>
              <h3 className="font-display text-xl font-medium text-ink">
                The doctor stays in charge.
              </h3>
              <p className="mt-1 text-[15px] leading-relaxed text-graphite">
                Every extracted field shows how confident the system is, and
                nothing becomes a case sheet until the doctor has reviewed and
                confirmed it.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Honesty strip */}
      <div className="border-y border-rule/70 bg-white/60 py-10 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="inline-block rounded-full border border-caution bg-[#f3ecd9] px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-caution">
            Verification pending
          </span>
          <p className="mt-4 text-sm leading-relaxed text-graphite">
            Built as an academic project (VTU, AI &amp; Data Science). Doctor
            credentials are collected but not independently verified. This is
            not a substitute for clinical judgement.
          </p>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-16 text-center">
        <Link
          to="/register"
          className="inline-block rounded-xl bg-gradient-to-b from-[#14705b] to-seal px-8 py-3.5 font-mono text-[13px] uppercase tracking-[0.1em] text-paper shadow-[0_12px_28px_-12px_rgba(15,92,74,0.8)] transition-all hover:-translate-y-0.5 hover:brightness-110"
        >
          Get Started
        </Link>
      </div>

      <PublicFooter />
    </div>
  )
}
