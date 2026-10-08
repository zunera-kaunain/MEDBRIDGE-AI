import { Link } from 'react-router-dom'
import { BackButton } from '../components/BackButton'

import { PublicFooter } from '../components/PublicFooter'
import { PublicNav } from '../components/PublicNav'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <div className="mx-auto w-full max-w-5xl px-6 pt-8">
        <BackButton fallback="/" />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            Error 404
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium text-ink">
            Page not found
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-graphite">
            We could not find this page. Check the address for typos, make sure your
            internet connection is working, or go back to the home page.
          </p>
          <Link
            to="/"
            className="mt-8 inline-block bg-seal px-6 py-3 font-mono text-[12px] uppercase tracking-[0.14em] text-white hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
