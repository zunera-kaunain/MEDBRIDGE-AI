/**
 * App shell for signed-in pages.
 *
 * The header carries the practitioner's registration number because that
 * number appears on every case sheet generated in this session — keeping it
 * visible is a small guard against a doctor working under the wrong account.
 */

import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { BackButton } from './BackButton'

const navItem =
  'font-mono text-[11px] uppercase tracking-[0.14em] pb-1 border-b-2 transition-colors'

/**
 * back="none" is for pages that draw their own, more specific back button
 * (for example "Back to patient").
 */
export function AppLayout({
  children,
  back = 'auto',
}: {
  children: ReactNode
  back?: 'auto' | 'none'
}) {
  const { doctor, signOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sm:sticky sm:top-0 z-20 border-b border-rule/70 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 sm:gap-x-8">
            <Link
              to="/app/profile"
              className="whitespace-nowrap font-display text-lg font-medium text-ink transition-opacity hover:opacity-75"
              title="Your profile"
            >
              MedBridge AI
            </Link>
            <nav className="flex gap-4 sm:gap-6">
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
              <NavLink
                to="/app/evaluation"
                className={({ isActive }) =>
                  `${navItem} ${
                    isActive
                      ? 'border-seal text-ink'
                      : 'border-transparent text-graphite hover:text-ink'
                  }`
                }
              >
                Evaluation
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-4 sm:gap-5">
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

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {back === 'auto' && (
          <BackButton fallback={pathname === '/app' ? '/' : '/app'} className="mb-5 block" />
        )}
        {children}
      </div>
    </div>
  )
}