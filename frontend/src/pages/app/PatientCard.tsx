import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice } from '../../components/ui'
import {
  LANGUAGE_LABELS,
  type Language,
  type PatientCard,
} from '../../types'

const LANGUAGES: Language[] = ['en', 'hi', 'kn', 'ta', 'te', 'ml']

export default function PatientCardPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  const [language, setLanguage] = useState<Language>('kn')
  const [card, setCard] = useState<PatientCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function load(lang: Language) {
    if (!sessionId) return
    setLoading(true)
    setError('')
    try {
      setCard(await api<PatientCard>(`/api/sessions/${sessionId}/card?language=${lang}`))
    } catch {
      setCard(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(language)
  }, [sessionId, language])

  async function handleGenerate() {
    if (!sessionId) return
    setGenerating(true)
    setError('')
    try {
      const c = await api<PatientCard>(
        `/api/sessions/${sessionId}/card?language=${language}`,
        { method: 'POST' },
      )
      setCard(c)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate card')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AppLayout>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        Patient Explanation Card
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-medium">Patient Card</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
              language === lang
                ? 'border-seal bg-seal text-paper'
                : 'border-rule text-graphite hover:bg-wash'
            }`}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNotice message={error} />
        </div>
      )}

      {loading ? (
        <p className="mt-8 px-6 py-14 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Loading
        </p>
      ) : !card ? (
        <div className="mt-8 border border-dashed border-rule px-8 py-14 text-center">
          <p className="font-display text-lg">No card yet in this language</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-graphite">
            Generate the patient explanation card in {LANGUAGE_LABELS[language]}.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <Button onClick={handleGenerate} loading={generating}>
              Generate Card
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 border border-rule bg-white px-7 py-7">
          <p className="text-[15px] text-ink">{card.greeting}</p>

          <div className="mt-6 border-t border-rule pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Your Condition
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {card.condition_explanation}
            </p>
          </div>

          <div className="mt-6 border-t border-rule pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Your Medicines
            </p>
            <ul className="mt-2 space-y-2">
              {card.medication_instructions.map((line, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink">
                  • {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-rule pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
              Follow-up
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {card.followup_instructions}
            </p>
          </div>

          <div className="mt-6 border-t border-rule bg-flag/5 px-5 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-flag">
              Warning Signs — Return Immediately If
            </p>
            <ul className="mt-2 space-y-1.5">
              {card.warning_signs.map((sign, i) => (
                <li key={i} className="text-[15px] leading-relaxed text-ink">
                  • {sign}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </AppLayout>
  )
}