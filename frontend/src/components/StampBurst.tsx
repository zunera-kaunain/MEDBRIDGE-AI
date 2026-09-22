import { useEffect, useState } from 'react'

export function StampBurst({
  trigger,
  label = 'CONFIRMED',
}: {
  trigger: number
  label?: string
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (trigger === 0) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 950)
    return () => clearTimeout(t)
  }, [trigger])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <style>{`
        @keyframes stamp-drop {
          0% { transform: translateY(-60px) scale(1.4) rotate(-8deg); opacity: 0; }
          55% { transform: translateY(6px) scale(0.96) rotate(-2deg); opacity: 1; }
          70% { transform: translateY(-3px) scale(1.02) rotate(-3deg); }
          100% { transform: translateY(0) scale(1) rotate(-2deg); opacity: 1; }
        }
        @keyframes stamp-fade {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes ink-ring {
          0% { transform: scale(0.3); opacity: 0.5; }
          100% { transform: scale(2.6); opacity: 0; }
        }
      `}</style>

      <div
        className="absolute h-40 w-40 rounded-full border-4 border-seal"
        style={{ animation: 'ink-ring 0.7s ease-out 0.15s both' }}
      />

      <div
        className="relative border-4 border-seal bg-paper px-8 py-4 shadow-[0_20px_50px_-20px_rgba(31,77,63,0.6)]"
        style={{
          animation:
            'stamp-drop 0.5s cubic-bezier(.34,1.56,.64,1) both, stamp-fade 0.95s ease-in both',
        }}
      >
        <span className="font-mono text-2xl font-bold uppercase tracking-[0.2em] text-seal">
          {label}
        </span>
      </div>
    </div>
  )
}