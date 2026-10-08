import { useState } from 'react'
import { api } from '../lib/api'

interface ChatMessage {
  role: 'doctor' | 'assistant'
  text: string
}

export function PatientChat({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')

  async function handleAsk() {
    const trimmed = question.trim()
    if (!trimmed) return

    setMessages((prev) => [...prev, { role: 'doctor', text: trimmed }])
    setQuestion('')
    setAsking(true)
    setError('')

    try {
      const res = await api<{ answer: string }>(`/api/patients/${patientId}/ask`, {
        method: 'POST',
        body: { question: trimmed },
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer')
    } finally {
      setAsking(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !asking) {
      handleAsk()
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-rule bg-wash px-7 py-3"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Ask About This Patient
        </p>
        <span className="font-mono text-xs text-graphite">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-7 py-6">
          <p className="mb-4 text-xs text-graphite">
            Answers are grounded only in this patient's confirmed visit history — no outside
            medical knowledge is used to fill gaps.
          </p>

          {messages.length === 0 && (
            <p className="mb-4 text-sm italic text-graphite">
              Try: "Has this patient had diabetes before?" or "Summarize their last visit."
            </p>
          )}

          <div className="mb-4 max-h-80 space-y-3 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'doctor' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-[85%] px-4 py-2.5 text-left text-[14px] leading-relaxed ${
                    m.role === 'doctor'
                      ? 'bg-seal text-paper'
                      : 'border border-rule bg-wash text-ink'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {asking && (
              <div className="text-left">
                <div className="inline-block border border-rule bg-wash px-4 py-2.5 text-[14px] italic text-graphite">
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="mb-3 text-sm text-flag">{error}</p>
          )}

          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this patient…"
              className="flex-1 border-b border-rule bg-transparent py-1.5 text-[15px] outline-none placeholder:text-rule focus:border-seal"
            />
            <button
              onClick={handleAsk}
              disabled={asking || !question.trim()}
              className="shrink-0 border border-seal px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-seal transition-colors hover:bg-seal hover:text-paper disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  )
}