import { useEffect, useRef, useState } from 'react'

import { api } from '../lib/api'

interface GoogleIdApi {
  accounts: {
    id: {
      initialize: (opts: {
        client_id: string
        callback: (res: { credential: string }) => void
      }) => void
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdApi
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('Could not load Google')))
    if (!existing) {
      script.src = SCRIPT_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })
}

/**
 * "Continue with Google" button. Renders nothing unless the server has a
 * GOOGLE_CLIENT_ID configured, so the app works the same without it.
 *
 * onCredential receives Google's ID token; the caller exchanges it with our
 * backend. `blockedMessage` stops the sign-in (and shows that message) when
 * something must happen first, such as ticking the terms checkbox.
 */
export function GoogleSignInButton({
  onCredential,
  onError,
  blockedMessage,
}: {
  onCredential: (credential: string) => Promise<void>
  onError: (message: string) => void
  blockedMessage?: string
}) {
  const holder = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(false)

  // The Google callback is registered once, so it reads the latest props
  // through a ref instead of capturing stale ones.
  const latest = useRef({ onCredential, onError, blockedMessage })
  latest.current = { onCredential, onError, blockedMessage }

  useEffect(() => {
    let cancelled = false
    async function setup() {
      try {
        const cfg = await api<{ client_id: string | null }>('/auth/google/config', {
          auth: false,
        })
        if (!cfg.client_id || cancelled) return
        await loadGoogleScript()
        if (cancelled || !window.google || !holder.current) return

        window.google.accounts.id.initialize({
          client_id: cfg.client_id,
          callback: async ({ credential }) => {
            const { onCredential, onError, blockedMessage } = latest.current
            if (blockedMessage) {
              onError(blockedMessage)
              return
            }
            try {
              await onCredential(credential)
            } catch (err) {
              onError(err instanceof Error ? err.message : 'Google sign-in failed')
            }
          },
        })
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: 320,
        })
        setAvailable(true)
      } catch {
        // No Google button is better than a broken page.
      }
    }
    setup()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={available ? 'flex flex-col items-center gap-3 pt-1' : 'hidden'}>
      <div className="flex w-full items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
          or
        </span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <div ref={holder} />
    </div>
  )
}
