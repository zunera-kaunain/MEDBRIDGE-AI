/**
 * Shared UI primitives for the case-sheet design system.
 *
 * The STAMP is the signature element. It is used for verification status,
 * which is the product's most important honesty rule — credentials are
 * collected, never automatically verified. Making that visible rather than
 * hiding it in a settings page is deliberate.
 */

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

/* -------------------------------------------------------------------------
   Case sheet — a sheet of paper with a ruled header band
------------------------------------------------------------------------- */

export function CaseSheet({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="mb-fade-up w-full max-w-lg">
      <div className="rounded-2xl border border-rule/80 bg-white/90 overflow-hidden shadow-[0_1px_0_var(--color-rule),0_16px_40px_-24px_rgba(22,33,28,0.55)]">
        <div className="border-b border-rule bg-gradient-to-r from-wash to-[#e4eee8] px-7 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
            {eyebrow}
          </p>
        </div>

        <div className="px-7 py-7">
          <h1 className="font-display text-[28px] leading-tight font-medium">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-graphite">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>

      {footer && (
        <div className="mt-4 text-center text-sm text-graphite">{footer}</div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------
   Form controls
------------------------------------------------------------------------- */

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
}

export function Field({ label, hint, id, ...props }: FieldProps) {
  const fieldId = id ?? props.name
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block font-mono text-[11px] uppercase tracking-[0.14em] text-graphite"
      >
        {label}
      </label>
      <input
        id={fieldId}
        {...props}
        className="mt-1.5 w-full border-b border-rule bg-transparent pb-1.5 text-[15px]
                   outline-none transition-colors placeholder:text-graphite/70
                   focus:border-seal"
      />
      {hint && <p className="mt-1 text-xs text-graphite">{hint}</p>}
    </div>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

export function SelectField({
  label,
  id,
  children,
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? props.name
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block font-mono text-[11px] uppercase tracking-[0.14em] text-graphite"
      >
        {label}
      </label>
      <select
        id={fieldId}
        {...props}
        className="mt-1.5 w-full border-b border-rule bg-transparent pb-1.5 text-[15px]
                   outline-none transition-colors focus:border-seal"
      >
        {children}
      </select>
    </div>
  )
}

export function Button({
  children,
  loading,
  variant = 'primary',
  ...props
}: {
  children: ReactNode
  loading?: boolean
  variant?: 'primary' | 'quiet'
} & InputHTMLAttributes<HTMLButtonElement>) {
  const base =
    'w-full rounded-xl py-3 text-[13px] font-medium tracking-[0.08em] uppercase font-mono ' +
    'transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed'

  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-b from-[#14705b] to-seal text-paper hover:brightness-110 hover:-translate-y-px shadow-[0_8px_20px_-10px_rgba(15,92,74,0.75)]'
      : 'border border-rule bg-white/60 text-ink hover:bg-wash'

  return (
    <button
      {...(props as object)}
      disabled={loading || props.disabled}
      className={`${base} ${styles}`}
    >
      {loading ? 'Working…' : children}
    </button>
  )
}

/* -------------------------------------------------------------------------
   Notices
------------------------------------------------------------------------- */

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-l-2 border-flag bg-flag/5 px-3 py-2 text-sm text-flag"
    >
      {message}
    </div>
  )
}

/* -------------------------------------------------------------------------
   THE STAMP — signature element
------------------------------------------------------------------------- */

export function Stamp({
  status,
}: {
  status: 'pending' | 'verified' | 'rejected'
}) {
  const label = {
    pending: 'Verification pending',
    verified: 'Verified',
    rejected: 'Not accepted',
  }[status]

  const tone = {
    pending: 'border-caution text-caution',
    verified: 'border-seal text-seal',
    rejected: 'border-flag text-flag',
  }[status]

  return (
    <span
      className={`inline-block -rotate-2 border-2 ${tone} px-2.5 py-1
                  font-mono text-[10px] font-medium uppercase tracking-[0.16em]
                  shadow-[0_2px_6px_rgba(22,33,28,0.1)]`}
    >
      {label}
    </span>
  )
}

/* -------------------------------------------------------------------------
   CHIP — smaller accent tag, same family as the Stamp but for reuse
   anywhere a short status/label needs visual weight (e.g. "AI-assisted",
   "Live", "New", counts). Not rotated — the Stamp's rotation stays unique
   to verification so it keeps its meaning.
------------------------------------------------------------------------- */

export function Chip({
  children,
  tone = 'graphite',
  filled = false,
}: {
  children: ReactNode
  tone?: 'seal' | 'caution' | 'flag' | 'graphite'
  filled?: boolean
}) {
  const tones = {
    seal: filled ? 'bg-seal text-paper border-seal' : 'border-seal text-seal',
    caution: filled
      ? 'bg-caution text-paper border-caution'
      : 'border-caution text-caution',
    flag: filled ? 'bg-flag text-paper border-flag' : 'border-flag text-flag',
    graphite: filled
      ? 'bg-graphite text-paper border-graphite'
      : 'border-rule text-graphite',
  }[tone]

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px]
                  font-medium uppercase tracking-[0.14em] ${tones}`}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------
   STAT TILE — a real number with a label, raised card treatment.
   Use in a grid for dashboard-style summary rows.
------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  tone = 'ink',
}: {
  label: string
  value: string | number
  tone?: 'ink' | 'seal' | 'caution' | 'flag'
}) {
  const valueColor = {
    ink: 'text-ink',
    seal: 'text-seal',
    caution: 'text-caution',
    flag: 'text-flag',
  }[tone]

  return (
    <div className="rounded-2xl border border-rule/80 bg-white/90 overflow-hidden px-5 py-4 shadow-[0_10px_28px_-22px_rgba(22,33,28,0.5)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-graphite">
        {label}
      </p>
      <p className={`mt-1.5 font-display text-[28px] font-medium leading-none ${valueColor}`}>
        {value}
      </p>
    </div>
  )
}