import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../lib/auth'
import { useReceptionistAuth } from '../lib/receptionistAuth'

/**
 * Shared header for About/Contact (and Landing) — session-aware so signing
 * in doesn't make those pages feel like you've left the app. A signed-in
 * doctor or receptionist gets their own nav + sign out here; a signed-out
 * visitor gets the marketing nav with Sign In / Get Started.
 */
function navItemClass(active: boolean) {
  return `font-mono text-[11px] uppercase tracking-[0.14em] ${
    active ? 'text-seal' : 'text-graphite hover:text-ink'
  }`
}

export function PublicNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { doctor, signOut: doctorSignOut } = useAuth()
  const { receptionist, signOut: receptionistSignOut } = useReceptionistAuth()

  if (receptionist) {
    return (
      <div className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-baseline gap-8">
            <Link
              to="/receptionist/profile"
              className="font-display text-xl font-medium text-ink transition-opacity hover:opacity-75"
              title="Your profile"
            >
              MedBridge AI
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/receptionist" className={navItemClass(location.pathname === '/receptionist')}>
                Front desk
              </Link>
              <Link to="/about" className={navItemClass(location.pathname === '/about')}>
                About
              </Link>
              <Link to="/contact" className={navItemClass(location.pathname === '/contact')}>
                Contact
              </Link>
            </nav>
          </div>
          <button
            onClick={() => {
              receptionistSignOut()
              navigate('/receptionist/login')
            }}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (doctor) {
    return (
      <div className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-baseline gap-8">
            <Link
              to="/app/profile"
              className="font-display text-xl font-medium text-ink transition-opacity hover:opacity-75"
              title="Your profile"
            >
              MedBridge AI
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/app" className={navItemClass(location.pathname === '/app')}>
                Today
              </Link>
              <Link to="/about" className={navItemClass(location.pathname === '/about')}>
                About
              </Link>
              <Link to="/contact" className={navItemClass(location.pathname === '/contact')}>
                Contact
              </Link>
            </nav>
          </div>
          <button
            onClick={() => {
              doctorSignOut()
              navigate('/login')
            }}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  // Signed-out visitor — the marketing nav.
  return (
    <div className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link to="/" className="font-display text-xl font-medium text-ink">
          MedBridge AI
        </Link>
        <div className="flex flex-wrap items-center gap-6">
          <nav className="flex items-center gap-6">
            <Link to="/" className={navItemClass(location.pathname === '/')}>
              Home
            </Link>
            <Link to="/about" className={navItemClass(location.pathname === '/about')}>
              About
            </Link>
            <Link to="/contact" className={navItemClass(location.pathname === '/contact')}>
              Contact
            </Link>
          </nav>
          <span className="hidden h-4 w-px bg-rule sm:inline-block" />
          <Link
            to="/login"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="border border-seal px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-seal transition-colors hover:bg-seal hover:text-paper"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  )
}
