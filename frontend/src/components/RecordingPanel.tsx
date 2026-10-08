// components/RecordingPanel.tsx
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui'
import { api, getToken } from '../lib/api'

// Browsers can't set an Authorization header on a WebSocket handshake, so
// the same JWT used everywhere else travels as a query param here instead.
//
// In development the backend is on port 8000 next to the Vite dev server. In
// a deployed build FastAPI serves the page itself, so the socket goes to the
// same host over wss:// (needed behind an HTTPS tunnel).
const WS_URL = (sessionId: string, token: string) => {
  const host = import.meta.env.DEV
    ? `${window.location.hostname}:8000`
    : window.location.host
  const scheme = !import.meta.env.DEV && window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${host}/ws/session/${sessionId}?token=${encodeURIComponent(token)}`
}

type TranscriptEvent =
  | { type: 'partial'; text: string }
  | { type: 'final'; segment: { text: string } }
  | { type: 'status'; status: string }
  | { type: 'error'; message: string }

export function RecordingPanel({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const [recording, setRecording] = useState(false)
  const [partialText, setPartialText] = useState('')
  const [finalLines, setFinalLines] = useState<string[]>([])
  const [elapsed, setElapsed] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)

  async function startRecording() {
    setPartialText('')
    setFinalLines([])
    setElapsed(0)

    const token = getToken()
    if (!token) {
      console.error('Not signed in — cannot start recording.')
      return
    }

    const ws = new WebSocket(WS_URL(sessionId, token))
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onmessage = (event) => {
      const data: TranscriptEvent = JSON.parse(event.data)
      if (data.type === 'partial') {
        setPartialText(data.text)
      } else if (data.type === 'final') {
        setFinalLines((prev) => [...prev, data.segment.text])
        setPartialText('')
      } else if (data.type === 'error') {
        console.error('Transcription error:', data.message)
      }
    }

    ws.onclose = (event) => {
      if (event.code === 1008) {
        console.error('Recording connection was rejected — please sign in again.')
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    const audioCtx = new AudioContext({ sampleRate: 16000 })
    audioCtxRef.current = audioCtx

    const source = audioCtx.createMediaStreamSource(stream)
    const processor = audioCtx.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor

    let pcmBuffer: number[] = []
    const samplesPerSecond = audioCtx.sampleRate

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      for (let i = 0; i < input.length; i++) pcmBuffer.push(input[i])

      if (pcmBuffer.length >= samplesPerSecond) {
        const chunk = pcmBuffer.slice(0, samplesPerSecond)
        pcmBuffer = pcmBuffer.slice(samplesPerSecond)

        const int16 = new Int16Array(chunk.length)
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(int16.buffer)
        }
      }
    }

    source.connect(processor)
    processor.connect(audioCtx.destination)

    timerRef.current = window.setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    setRecording(true)
  }

  function stopRecording() {
    wsRef.current?.send('stop')
    wsRef.current?.close()

    processorRef.current?.disconnect()
    audioCtxRef.current?.close()
    streamRef.current?.getTracks().forEach((track) => track.stop())

    if (timerRef.current) window.clearInterval(timerRef.current)

    setRecording(false)
    navigate(`/app/sessions/${sessionId}/report`)
  }

  async function discardConsultation() {
    if (!window.confirm('Discard this consultation? This cannot be undone.')) return

    wsRef.current?.send('stop')
    wsRef.current?.close()
    processorRef.current?.disconnect()
    audioCtxRef.current?.close()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (timerRef.current) window.clearInterval(timerRef.current)
    setRecording(false)

    try {
      await api(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    } catch {
      // Session may already be gone — proceed regardless.
    }
    navigate('/app/patients')
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-rule bg-wash px-7 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
          Live Transcript
        </p>
        {recording && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-flag">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flag" />
            Rec {mm}:{ss}
          </span>
        )}
      </div>

      <div className="px-7 py-7">
        <div className="flex gap-3">
          <div className="flex-1">
            <Button
              onClick={recording ? stopRecording : startRecording}
              variant={recording ? 'quiet' : 'primary'}
            >
              {recording ? 'Stop Recording' : 'Start Recording'}
            </Button>
          </div>
          <button
            onClick={discardConsultation}
            className="shrink-0 border border-flag px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-flag transition-colors hover:bg-flag hover:text-paper"
          >
            Discard
          </button>
        </div>

        <div className="mt-7 min-h-[120px] space-y-3 border-t border-rule pt-6">
          {finalLines.length === 0 && !partialText && (
            <p className="text-sm text-graphite italic">
              Transcript will appear here once recording begins.
            </p>
          )}

          {finalLines.map((line, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-ink">
              {line}
            </p>
          ))}

          {partialText && (
            <p className="text-[15px] leading-relaxed text-graphite italic">
              {partialText}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}