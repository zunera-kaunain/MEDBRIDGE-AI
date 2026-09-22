import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

// Simple line-art icons matching the ink-on-paper aesthetic — thin strokes,
// no fill, drawn with currentColor so tone can be set per-doodle.
function Stethoscope({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14 6v10a8 8 0 0 0 16 0V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="6" r="2.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="30" cy="6" r="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M22 24v8a8 8 0 0 0 16 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="28" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
function Pulse({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M4 24h8l4-12 6 20 5-14 3 6h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function SpeechBubble({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M8 10h32a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H20l-8 8v-8h-4a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
function Pill({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="6" y="18" width="36" height="12" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M24 18v12" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
function Mic({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="18" y="6" width="12" height="20" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M12 22a12 12 0 0 0 24 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 34v8M18 42h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function Cross({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M24 8v32M8 24h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const ICONS = [Stethoscope, Pulse, SpeechBubble, Pill, Mic, Cross]

// Fixed, stable layout — generated once, not re-randomized on every render.
const DOODLES = Array.from({ length: 14 }).map((_, i) => ({
  Icon: ICONS[i % ICONS.length],
  left: (i * 37 + 5) % 96,
  top: (i * 53 + 8) % 92,
  size: 26 + ((i * 11) % 22),
  depth: 0.02 + ((i * 7) % 5) * 0.008,
  duration: 6 + (i % 4) * 2,
  delay: (i % 5) * -1.3,
  variant: i % 3,
  tone:
    i % 3 === 0
      ? 'var(--doodle-seal)'
      : i % 3 === 1
        ? 'var(--doodle-caution)'
        : 'var(--doodle-graphite)',
}))

export function DoodleBackground() {
  const fieldRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      target.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMove)

    let raf: number
    function tick() {
      const el = fieldRef.current
      const glow = glowRef.current
      if (el) {
        const dx = target.current.x - window.innerWidth / 2
        const dy = target.current.y - window.innerHeight / 2
        el.style.setProperty('--mx', `${dx}px`)
        el.style.setProperty('--my', `${dy}px`)
      }
      if (glow) {
        glow.style.transform = `translate(${target.current.x}px, ${target.current.y}px) translate(-50%, -50%)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={fieldRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={
        {
          '--doodle-seal': '#1f4d3f',
          '--doodle-caution': '#a8791a',
          '--doodle-graphite': '#6b7268',
        } as CSSProperties
      }
    >
      <style>{`
        @keyframes doodle-float-0 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(4deg); }
        }
        @keyframes doodle-float-1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(14px) rotate(-5deg); }
        }
        @keyframes doodle-float-2 {
          0%, 100% { transform: translateX(0px) rotate(0deg); }
          50% { transform: translateX(12px) rotate(3deg); }
        }
      `}</style>

      <div
        ref={glowRef}
        className="absolute left-0 top-0 h-[280px] w-[280px] rounded-full opacity-[0.08] blur-3xl transition-transform duration-300 ease-out"
        style={{ background: 'radial-gradient(circle, var(--doodle-seal), transparent 70%)' }}
      />

      {DOODLES.map((d, i) => (
        <div
          key={i}
          className="absolute transition-transform duration-500 ease-out"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            color: d.tone,
            opacity: 0.18,
            transform: `translate(calc(var(--mx, 0px) * ${d.depth}), calc(var(--my, 0px) * ${d.depth}))`,
          }}
        >
          <div
            style={{
              animation: `doodle-float-${d.variant} ${d.duration}s ease-in-out infinite`,
              animationDelay: `${d.delay}s`,
            }}
          >
            <d.Icon size={d.size} />
          </div>
        </div>
      ))}
    </div>
  )
}