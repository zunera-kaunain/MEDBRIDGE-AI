import { Link, useLocation } from 'react-router-dom'

/**
 * Shared nav for the public-facing pages (Landing, About, Contact) — kept
 * as one component so all three stay in sync instead of drifting.
 */
const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export function PublicNav() {
  const location = useLocation()

  return (
    <div className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link to="/" className="font-display text-xl font-medium text-ink">
          MedBridge AI
        </Link>
        <div className="flex flex-wrap items-center gap-6">
          <nav className="flex items-center gap-6">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                  location.pathname === l.to
                    ? 'text-seal'
                    : 'text-graphite hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            ))}
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
