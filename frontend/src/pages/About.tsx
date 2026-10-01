import { PublicNav } from '../components/PublicNav'
import { PublicFooter } from '../components/PublicFooter'

export default function About() {
  return (
    <div className="min-h-screen bg-paper">
      <PublicNav />

      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          About
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium text-ink">
          Built to close one specific gap.
        </h1>

        <p className="mt-6 text-[17px] leading-relaxed text-graphite">
          MedBridge AI is a final-year capstone project for the B.E. in
          Artificial Intelligence &amp; Data Science programme at Navkis
          College of Engineering, Hassan, under Visvesvaraya Technological
          University (VTU).
        </p>
        <p className="mt-5 text-[17px] leading-relaxed text-graphite">
          The idea came from a simple, recurring pattern in Indian OPDs:
          doctors examine, think, and document in English, but most patients
          don't speak it. What gets said back to the patient is a
          compressed, verbal summary — shorter than what was actually found
          and decided. The things most likely to be lost in that compression
          are exactly the things that matter most: dosing details, warning
          signs, when to come back.
        </p>
        <p className="mt-5 text-[17px] leading-relaxed text-graphite">
          MedBridge sits inside the consultation itself. It transcribes the
          conversation as it happens, extracts the clinical structure —
          symptoms, diagnosis, medication, follow-up — and generates a
          complete, plain-language patient card in the patient's own
          language. Nothing the doctor said gets left out because there
          wasn't time to translate it by hand.
        </p>

        <div className="mt-12 border-l-2 border-caution bg-[#f3ecd9] px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-caution">
            Academic project — verification pending
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            This is a student-built system. Doctor credentials are collected
            but not independently verified against the Indian Medical
            Register, and the app is not a substitute for clinical
            judgement.
          </p>
        </div>

        <h2 className="mt-14 font-display text-2xl font-medium text-ink">
          What it does
        </h2>
        <ul className="mt-5 space-y-3 text-[16px] leading-relaxed text-graphite">
          <li>— Live, code-switched speech transcription during the consultation</li>
          <li>— Structured extraction of symptoms, diagnosis, medication, and follow-up</li>
          <li>— A complete patient card translated into the patient's preferred language</li>
          <li>— Separate tooling for doctors and front-desk receptionists</li>
        </ul>
      </div>

      <PublicFooter />
    </div>
  )
}
