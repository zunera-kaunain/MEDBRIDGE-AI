import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-medium text-slate-900">MedBridge AI</span>
          <div className="flex items-center gap-6">
            <Link
              to="/login"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="border border-blue-600 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
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
            <span className="inline-block border border-blue-200 bg-blue-50 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-blue-700">
              Final-year capstone · VTU
            </span>
            <h1 className="mt-6 font-display text-[44px] font-medium leading-[1.1] text-slate-900">
              What the doctor says in English.
              <br />
              What the patient hears in{' '}
              <span className="text-blue-600">their own language.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-slate-600">
              Indian physicians think and document in English. Patients speak
              Kannada, Hindi, and more. In the gap between the two, warning
              signs and dosing details routinely get lost. MedBridge closes
              that gap.
            </p>
            <div className="mt-9 flex gap-4">
              <Link
                to="/register"
                className="bg-blue-600 px-6 py-3 font-mono text-[13px] uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-90"
              >
                Start a Consultation
              </Link>
              <Link
                to="/login"
                className="border border-slate-300 px-6 py-3 font-mono text-[13px] uppercase tracking-[0.1em] text-slate-900 transition-colors hover:bg-slate-50"
              >
                Sign In
              </Link>
            </div>
          </div>

          {/* Visual proof — the actual transformation, shown not told */}
          <div className="relative">
            <div className="border border-slate-200 bg-white shadow-[0_1px_0_#e2e8f0,0_20px_48px_-28px_rgba(15,23,42,0.25)]">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Doctor says — English
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[14px] leading-relaxed text-slate-800">
                  "Paracetamol five hundred milligram, three times a day, after
                  food, for five days. If the fever crosses one oh two, or
                  there's breathing difficulty, come back immediately."
                </p>
              </div>
            </div>

            <div className="mt-4 ml-8 border border-slate-200 bg-white shadow-[0_1px_0_#e2e8f0,0_20px_48px_-28px_rgba(15,23,42,0.25)]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Patient receives — ಕನ್ನಡ
                </p>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-blue-600">
                  Complete
                </span>
              </div>
              <div className="px-5 py-4 space-y-2">
                <p className="text-[14px] leading-relaxed text-slate-800">
                  ಪ್ಯಾರಸಿಟಮಾಲ್ 500 ಮಿಗ್ರಾ — ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ, ಊಟದ ನಂತರ, 5
                  ದಿನಗಳವರೆಗೆ.
                </p>
                <div className="border-l-2 border-red-400 bg-red-50 px-3 py-2">
                  <p className="text-[13px] leading-relaxed text-slate-800">
                    103°F ಗಿಂತ ಹೆಚ್ಚಿನ ಜ್ವರ ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದ್ದರೆ ತಕ್ಷಣ
                    ಬನ್ನಿ.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 ml-8 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Nothing dropped in translation — including the warning sign.
            </p>
          </div>
        </div>
      </div>

      {/* The problem */}
      <div className="border-t border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            The problem
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium text-slate-900">
            Not a language barrier. A compression problem.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3">
            {[
              {
                n: '01',
                tone: 'text-blue-600 border-blue-600',
                body: 'The doctor examines and states findings in English — the language of clinical training and record-keeping.',
              },
              {
                n: '02',
                tone: 'text-amber-600 border-amber-500',
                body: 'A compressed summary is spoken back to the patient in their own language — necessarily shorter than what was said.',
              },
              {
                n: '03',
                tone: 'text-red-600 border-red-500',
                body: "Warning signs, dosing rationale, and what to watch for are frequently the first things lost in that compression.",
              },
            ].map((item) => (
              <div key={item.n}>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[12px] font-medium ${item.tone}`}
                >
                  {item.n}
                </span>
                <p className="mt-4 text-[15px] leading-relaxed text-slate-800">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
            How it works
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium text-slate-900">
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
                className="flex gap-5 border border-slate-200 bg-white px-6 py-5"
              >
                <span className="shrink-0 font-display text-2xl font-medium text-slate-200">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-lg font-medium text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-600">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Honesty strip */}
      <div className="border-y border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="inline-block border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-amber-700">
            Verification pending
          </span>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Built as an academic project (VTU, AI &amp; Data Science). Doctor
            credentials are collected but not independently verified. This is
            not a substitute for clinical judgement.
          </p>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-white py-16 text-center">
        <Link
          to="/register"
          className="inline-block bg-blue-600 px-6 py-3 font-mono text-[13px] uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-90"
        >
          Get Started
        </Link>
      </div>
    </div>
  )
}