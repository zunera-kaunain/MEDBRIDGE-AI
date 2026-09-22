import { useEffect, useState } from 'react'
import { AppLayout } from '../../components/AppLayout'
import { StatTile, Chip, ErrorNotice } from '../../components/ui'
import { api } from '../../lib/api'

interface FieldScore {
  precision: number
  recall: number
  f1: number
  tp: number
  fp: number
  fn: number
}
interface ExtractionEval {
  totals: Record<string, FieldScore>
  latency: { mean: number; min: number; max: number }
  per_clip: Array<{ clip_id: string; latency_sec: number }>
}
interface WerEval {
  per_clip: Array<{ clip_id: string; wer: number; cer: number }>
  mean_wer: number
  mean_cer: number
}

function Bar({ label, value, tone }: { label: string; value: number; tone: 'seal' | 'caution' | 'flag' }) {
  const pct = Math.round(value * 100)
  const barColor = { seal: 'bg-seal', caution: 'bg-caution', flag: 'bg-flag' }[tone]
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-graphite">{label}</span>
        <span className="font-mono text-sm text-ink">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-wash">
        <div className={`h-2 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function EvaluationPage() {
  const [extraction, setExtraction] = useState<ExtractionEval | null>(null)
  const [wer, setWer] = useState<WerEval | null>(null)
  const [error, setError] = useState('')

  const [runningExtraction, setRunningExtraction] = useState(false)
  const [runningWer, setRunningWer] = useState(false)
  const [runError, setRunError] = useState('')

  function load() {
    Promise.all([
      api<ExtractionEval>('/api/evaluation/extraction').catch(() => null),
      api<WerEval>('/api/evaluation/wer').catch(() => null),
    ]).then(([e, w]) => {
      setExtraction(e)
      setWer(w)
      if (!e && !w) setError('No evaluation results found. Run eval_extraction.py and eval_wer.py first.')
    })
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRerunExtraction() {
    setRunningExtraction(true)
    setRunError('')
    try {
      const result = await api<ExtractionEval>('/api/evaluation/extraction/run', { method: 'POST' })
      setExtraction(result)
      setError('')
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Could not re-run extraction evaluation')
    } finally {
      setRunningExtraction(false)
    }
  }

  async function handleRerunWer() {
    setRunningWer(true)
    setRunError('')
    try {
      const result = await api<WerEval>('/api/evaluation/wer/run', { method: 'POST' })
      setWer(result)
      setError('')
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Could not re-run WER evaluation')
    } finally {
      setRunningWer(false)
    }
  }

  return (
    <AppLayout>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        System Evaluation
      </p>
      <h1 className="mt-1.5 font-display text-3xl font-medium">Model Performance</h1>
      <p className="mt-1 text-sm text-graphite">
        Precomputed results from offline evaluation against a ground-truth clinical dataset.
      </p>

      {error && (
        <div className="mt-6 border-l-2 border-flag bg-flag/5 px-4 py-3 text-sm text-flag">
          {error}
        </div>
      )}
      {runError && (
        <div className="mt-6">
          <ErrorNotice message={runError} />
        </div>
      )}

      {extraction && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-medium">Entity Extraction Accuracy</h2>
              <Chip tone="seal">Claude Haiku</Chip>
            </div>
            <button
              onClick={handleRerunExtraction}
              disabled={runningExtraction}
              className="border border-rule px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite transition-colors hover:bg-wash disabled:opacity-50"
            >
              {runningExtraction ? 'Running… (~30s, real API calls)' : 'Re-run Extraction Eval'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Object.entries(extraction.totals).map(([field, score]) => (
              <div key={field} className="border border-rule bg-white p-5 shadow-[0_10px_28px_-22px_rgba(22,33,28,0.5)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite mb-3">
                  {field}
                </p>
                <Bar label="Precision" value={score.precision} tone="seal" />
                <Bar label="Recall" value={score.recall} tone="caution" />
                <Bar label="F1 Score" value={score.f1} tone={score.f1 > 0.8 ? 'seal' : 'flag'} />
                <p className="mt-2 font-mono text-[10px] text-graphite">
                  tp={score.tp} · fp={score.fp} · fn={score.fn}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Mean Latency" value={`${extraction.latency.mean.toFixed(2)}s`} />
            <StatTile label="Min Latency" value={`${extraction.latency.min.toFixed(2)}s`} tone="seal" />
            <StatTile label="Max Latency" value={`${extraction.latency.max.toFixed(2)}s`} tone="caution" />
          </div>
        </div>
      )}

      {wer && (
        <div className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-xl font-medium">Speech Recognition Accuracy</h2>
              <Chip tone="caution">Whisper ASR</Chip>
            </div>
            <button
              onClick={handleRerunWer}
              disabled={runningWer}
              className="border border-rule px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite transition-colors hover:bg-wash disabled:opacity-50"
            >
              {runningWer ? 'Running… (can take several minutes)' : 'Re-run WER Eval'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile label="Mean Word Error Rate" value={`${(wer.mean_wer * 100).toFixed(1)}%`} tone="caution" />
            <StatTile label="Mean Character Error Rate" value={`${(wer.mean_cer * 100).toFixed(1)}%`} tone="caution" />
          </div>

          <div className="mt-6 border border-rule bg-white">
            <div className="border-b border-rule bg-wash px-5 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite">
                Per-clip results
              </p>
            </div>
            <div className="divide-y divide-rule">
              {wer.per_clip.map((c) => (
                <div key={c.clip_id} className="flex items-center justify-between px-5 py-3">
                  <span className="font-mono text-sm text-ink">{c.clip_id}</span>
                  <span className="font-mono text-xs text-graphite">
                    WER {(c.wer * 100).toFixed(1)}% · CER {(c.cer * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}