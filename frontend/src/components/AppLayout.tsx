/**
 * App shell for signed-in pages.
 *
 * The header carries the practitioner's registration number because that
 * number appears on every report generated in this session — keeping it
 * visible is a small guard against a doctor working under the wrong account.
 */

import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '../lib/auth'

const navItem =
  'font-mono text-[11px] uppercase tracking-[0.14em] pb-1 border-b-2 transition-colors'

export function AppLayout({ children }: { children: ReactNode }) {
  const { doctor, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-8">
            <span className="font-display text-lg font-medium">MedBridge AI</span>
            <nav className="flex gap-6">
              <NavLink
                to="/app"
                end
                className={({ isActive }) =>
                  `${navItem} ${
                    isActive
                      ? 'border-seal text-ink'
                      : 'border-transparent text-graphite hover:text-ink'
                  }`
                }
              >
                Today
              </NavLink>
              <NavLink
                to="/app/patients"
                className={({ isActive }) =>
                  `${navItem} ${
                    isActive
                      ? 'border-seal text-ink'
                      : 'border-transparent text-graphite hover:text-ink'
                  }`
                }
              >
                Patients
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <span className="hidden font-mono text-[11px] text-graphite sm:inline">
              {doctor?.registration_number}
            </span>
            <button
              onClick={signOut}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  )
}