import { Link } from 'react-router-dom'

export function PublicFooter() {
  return (
    <footer className="border-t border-rule bg-wash py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite">
          MedBridge AI · Final-year capstone, VTU
        </p>
        <div className="flex flex-wrap items-center justify-center gap-5">
          <Link
            to="/about"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            About
          </Link>
          <Link
            to="/contact"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Contact
          </Link>
          <Link
            to="/privacy"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            Terms
          </Link>
          <a
            href="mailto:medbridgeai@gmail.com"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink"
          >
            medbridgeai@gmail.com
          </a>
        </div>
      </div>
    </footer>
  )
}
