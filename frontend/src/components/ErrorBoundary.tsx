import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  failed: boolean
}

/**
 * Catches render-time crashes so a bug in one page shows a readable message
 * instead of a blank white screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="w-full max-w-md rounded-2xl border border-rule/80 bg-white/90 shadow-[0_10px_30px_-22px_rgba(22,33,28,0.4)] overflow-hidden px-7 py-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-flag">
            Something broke
          </p>
          <h1 className="mt-3 font-display text-2xl font-medium text-ink">
            This page hit a problem
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-graphite">
            Nothing you saved has been lost. Try reloading the page, or go back to the start.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => window.location.reload()}
              className="border border-seal bg-seal px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-paper hover:opacity-90"
            >
              Reload page
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="border border-rule px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
            >
              Go to home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
