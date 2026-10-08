import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SUFFIX = 'MedBridge AI'

// Exact paths first, then patterns for routes that carry an id.
const TITLES: Record<string, string> = {
  '/about': 'About',
  '/contact': 'Contact',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Use',
  '/login': 'Sign in',
  '/register': 'Create account',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
  '/complete-profile': 'Complete your profile',
  '/receptionist/login': 'Receptionist sign in',
  '/receptionist/register': 'Receptionist sign up',
  '/receptionist': 'Front desk',
  '/receptionist/patients/new': 'Register patient',
  '/receptionist/patients': 'Patients',
  '/receptionist/referrals': 'Referrals',
  '/receptionist/profile': 'Profile',
  '/app': 'Dashboard',
  '/app/patients': 'Patients',
  '/app/evaluation': 'Evaluation',
  '/app/profile': 'Profile',
  '/app/activity': 'Activity',
}

const PATTERNS: [RegExp, string][] = [
  [/^\/app\/patients\/[^/]+$/, 'Patient'],
  [/^\/app\/sessions\/[^/]+\/report$/, 'Case Sheet'],
  [/^\/app\/sessions\/[^/]+\/card$/, 'Patient card'],
  [/^\/app\/sessions\/[^/]+\/referral$/, 'Referral'],
]

function titleFor(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/') return `${SUFFIX} · Multilingual OPD documentation`
  const exact = TITLES[path]
  if (exact) return `${exact} · ${SUFFIX}`
  for (const [re, title] of PATTERNS) {
    if (re.test(path)) return `${title} · ${SUFFIX}`
  }
  return `Page not found · ${SUFFIX}`
}

/** Sets document.title from the current route. Call once, inside the Router. */
export function usePageTitle(): void {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])
}
