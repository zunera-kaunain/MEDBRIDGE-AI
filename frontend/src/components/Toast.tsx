import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type ToastKind = 'error' | 'success' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  notify: (message: string, kind?: ToastKind) => void
  error: (message: string) => void
  success: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const STYLES: Record<ToastKind, string> = {
  error: 'border-flag bg-[#f6e9e3]',
  success: 'border-seal bg-[#e4ece8]',
  info: 'border-rule bg-white',
}

/** Small corner notifications for failed loads and finished actions. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++
      // Keep at most 4 on screen; drop duplicates of the newest message.
      setItems((list) => {
        if (list.length && list[list.length - 1].message === message) return list
        return [...list, { id, kind, message }].slice(-4)
      })
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      error: (m) => notify(m, 'error'),
      success: (m) => notify(m, 'success'),
    }),
    [notify],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 border-l-4 px-4 py-3 text-sm text-ink shadow-[0_8px_24px_-12px_rgba(22,33,28,0.4)] ${STYLES[t.kind]}`}
          >
            <p className="flex-1 leading-relaxed">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-graphite hover:text-ink"
            >
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
