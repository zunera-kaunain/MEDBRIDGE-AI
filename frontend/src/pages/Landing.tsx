import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <div className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-medium text-ink">MedBridge AI</span>
          <div className="flex items-center gap-6">
            <Link
              to="/login"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="border border-seal px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-seal transition-colors hover:bg-seal hover:text-paper"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>

      {/* Hero — split layout: copy left, visual proof right */}
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <span className="inline-block border border-rule bg-wash px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-seal">
              Final-year capstone · VTU
            </span>
            <h1 className="mt-6 font-display text-[44px] font-medium leading-[1.1] text-ink">
              What the doctor says in English.
              <br />
              What the patient hears in{' '}
              <span className="text-seal">their own language.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-graphite">
              Indian physicians think and document in English. Patients speak
              Kannada, Hindi, and more. In the gap between the two, warning
              signs and dosing details routinely get lost. MedBridge closes
              that gap.
            </p>
            <div className="mt-9 flex gap-4">
              <Link
                to="/register"
                className="bg-seal px-6 py-3 font-mono text-[13px] uppercase tracking-[0.1em] text-paper transition-opacity hover:opacity-90"
              >
                Start a Consultation
              </Link>
              <Link
                to="/login"
                className="border border-rule px-6 py-3 font-mono text-[13px] uppercase tracking-[0.1em] text-ink transition-colors hover:bg-wash"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Visual proof — the actual transformation, shown not told */}
          <div className="relative">
            <div className="border border-rule bg-white shadow-[0_1px_0_var(--color-rule),0_20px_48px_-28px_rgba(22,33,28,0.35)]">
              <div className="border-b border-rule bg-wash px-5 py-2.5">
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

            <div className="mt-4 ml-8 border border-rule bg-white shadow-[0_1px_0_var(--color-rule),0_20px_48px_-28px_rgba(22,33,28,0.35)]">
              <div className="flex items-center justify-between border-b border-rule bg-wash px-5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                  Patient receives — ಕನ್ನಡ
                </p>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-seal">
                  Complete
                </span>
              </div>
              <div className="px-5 py-4 space-y-2">
                <p className="text-[14px] leading-relaxed text-ink">
                  ಪ್ಯಾರಸಿಟಮಾಲ್ 500 ಮಿಗ್ರಾ — ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ, ಊಟದ ನಂತರ, 5
                  ದಿನಗಳವರೆಗೆ.
                </p>
                <div className="border-l-2 border-flag bg-[#f6e9e3] px-3 py-2">
                  <p className="text-[13px] leading-relaxed text-ink">
                    103°F ಗಿಂತ ಹೆಚ್ಚಿನ ಜ್ವರ ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದ್ದರೆ ತಕ್ಷಣ
                    ಬನ್ನಿ.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 ml-8 font-mono text-[10px] uppercase tracking-[0.14em] text-graphite">
              Nothing dropped in translation — including the warning sign.
            </p>
          </div>
        </div>
      </div>

      {/* The problem */}
      <div className="border-t border-rule bg-wash py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            The problem
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium text-ink">
            Not a language barrier. A compression problem.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
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
                body: "Warning signs, dosing rationale, and what to watch for are frequently the first things lost in that compression.",
              },
            ].map((item) => (
              <div key={item.n}>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[12px] font-medium ${item.tone}`}
                >
                  {item.n}
                </span>
                <p className="mt-4 text-[15px] leading-relaxed text-ink">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-paper py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium text-ink">
            Full detail in, full detail out.
          </h2>

          <div className="mt-10 space-y-5">
            {[
              {
                title: 'Live transcription during the consultation',
                body: 'Real-time, code-switched speech recognition captures the full conversation as it happens — no separate note-taking step.',
              },
              {
                title: 'Structured clinical extraction',
                body: 'Symptoms, diagnosis, medications, and follow-up are pulled out automatically, each with a confidence score the doctor can review and correct.',
              },
              {
                title: "A complete card, in the patient's language",
                body: 'The full clinical detail — including every warning sign — is translated into a plain-language card the patient can actually take home and understand.',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="flex gap-5 border border-rule bg-white px-6 py-5"
              >
                <span className="shrink-0 font-display text-2xl font-medium text-rule">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-lg font-medium text-ink">{item.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-graphite">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Honesty strip */}
      <div className="border-y border-rule bg-wash py-10">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="inline-block border border-caution bg-[#f3ecd9] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-caution">
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
      <div className="bg-paper py-16 text-center">
        <Link
          to="/register"
          className="inline-block bg-seal px-6 py-3 font-mono text-[13px] uppercase tracking-[0.1em] text-paper transition-opacity hover:opacity-90"
        >
          Get Started
        </Link>
      </div>
    </div>
  )
}
