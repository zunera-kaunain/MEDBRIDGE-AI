import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { api } from '../../lib/api'
import { AppLayout } from '../../components/AppLayout'
import { Button, ErrorNotice } from '../../components/ui'
import {
  LANGUAGE_LABELS,
  type Language,
  type Patient,
  type PatientCard,
} from '../../types'

const LANGUAGES: Language[] = ['en', 'hi', 'kn', 'ta', 'te', 'ml']

function safeFilename(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]+/g, '_')
}

function buildWhatsAppLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`
}

function buildSmsLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.length === 10 ? `91${digits}` : digits
  return `sms:${withCountry}?body=${encodeURIComponent(text)}`
}

function cardToMessage(card: PatientCard): string {
  const lines = [
    card.greeting,
    '',
    card.condition_explanation,
    '',
    'Medicines:',
    ...card.medication_instructions.map((m) => `- ${m}`),
    '',
    card.followup_instructions,
  ]
  if (card.warning_signs.length > 0) {
    lines.push('', 'Return immediately if:', ...card.warning_signs.map((w) => `- ${w}`))
  }
  return lines.join('\n')
}

export default function PatientCardPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [language, setLanguage] = useState<Language>('en')
  const [card, setCard] = useState<PatientCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [patientId, setPatientId] = useState<string | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)

  const [emailAddress, setEmailAddress] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Guards so the default-language-from-patient and the one-time
  // auto-generate each only ever run once, not on every re-render.
  const defaultLanguageSet = useRef(false)
  const autoGenerateAttempted = useRef(false)

  useEffect(() => {
    if (!sessionId) return
    api<{ patient_id: string }>(`/api/sessions/${sessionId}`)
      .then((s) => setPatientId(s.patient_id))
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    if (!patientId) return
    api<Patient>(`/api/patients/${patientId}`)
      .then((p) => {
        setPatient(p)
        if (p.email) setEmailAddress(p.email)
        if (!defaultLanguageSet.current) {
          defaultLanguageSet.current = true
          setLanguage(p.preferred_language)
        }
      })
      .catch(() => {})
  }, [patientId])

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

  // Auto-generate once, only for the patient's own default language, only
  // after we've confirmed there's genuinely no card yet — never on a
  // manual language switch, so switching tabs to browse doesn't silently
  // burn an API call every time.
  useEffect(() => {
    if (
      !loading &&
      !card &&
      !generating &&
      patient &&
      language === patient.preferred_language &&
      !autoGenerateAttempted.current
    ) {
      autoGenerateAttempted.current = true
      handleGenerate()
    }
  }, [loading, card, generating, patient, language])

  async function handleExportPdf() {
    if (!sessionId) return
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/card/pdf?language=${language}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('medbridge_token')}` } },
      )
      if (!res.ok) throw new Error('Could not export PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = patient ? `${safeFilename(patient.full_name)}_summary_card_${language}.pdf`: `card-${sessionId}-${language}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export PDF')
    }
  }

  function handleWhatsAppShare() {
    if (!card || !patient?.phone) return
    const link = buildWhatsAppLink(patient.phone, cardToMessage(card))
    window.open(link, '_blank')
  }

  function handleSmsShare() {
    if (!card || !patient?.phone) return
    const link = buildSmsLink(patient.phone, cardToMessage(card))
    window.open(link, '_blank')
  }

  async function handleEmailSend() {
    if (!sessionId || !emailAddress) return
    setSendingEmail(true)
    setError('')
    setEmailSent(false)
    try {
      await api(`/api/sessions/${sessionId}/card/email?language=${language}`, {
        method: 'POST',
        body: { to_email: emailAddress },
      })
      setEmailSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send email')
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <AppLayout back="none">
      {patientId && (
        <button
          onClick={() => navigate(`/app/patients/${patientId}`)}
          className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
        >
          ← Back to patient
        </button>
      )}

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
            {patient && lang === patient.preferred_language && ' •'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNotice message={error} />
        </div>
      )}

      {loading || (generating && !card) ? (
        <p className="mt-8 px-6 py-14 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          {generating ? 'Generating card…' : 'Loading'}
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
        <div className="mt-8 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-7 py-7">
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

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportPdf}
              className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
            >
              Export PDF
            </button>
            {patient?.phone && (
              <>
                <button
                  onClick={handleWhatsAppShare}
                  className="border border-seal px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-seal transition-colors hover:bg-seal hover:text-paper"
                >
                  Share via WhatsApp
                </button>
                <button
                  onClick={handleSmsShare}
                  className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash"
                >
                  Share via SMS
                </button>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => {
                setEmailAddress(e.target.value)
                setEmailSent(false)
              }}
              placeholder="patient@email.com"
              className="border border-rule px-3 py-2 font-mono text-[12px] outline-none focus:border-seal"
            />
            <button
              onClick={handleEmailSend}
              disabled={sendingEmail || !emailAddress}
              className="border border-rule px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite transition-colors hover:bg-wash disabled:opacity-50"
            >
              {sendingEmail ? 'Sending…' : 'Email Card'}
            </button>
            {emailSent && (
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-seal">
                Sent ✓
              </span>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}