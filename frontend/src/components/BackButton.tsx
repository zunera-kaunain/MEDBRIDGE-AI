import { useNavigate } from 'react-router-dom'

/**
 * "← Back" button. Goes to the previous page, or to `fallback` when there
 * is no previous page (for example the page was opened from a bookmark or
 * a pasted link).
 */
export function BackButton({
  fallback = '/',
  className = '',
}: {
  fallback?: string
  className?: string
}) {
  const navigate = useNavigate()

  function goBack() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`font-mono text-[11px] uppercase tracking-[0.14em] text-graphite hover:text-ink ${className}`}
    >
      ← Back
    </button>
  )
}
