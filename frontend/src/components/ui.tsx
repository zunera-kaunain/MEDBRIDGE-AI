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
    <div className="w-full max-w-lg">
      <div className="border border-rule bg-white shadow-[0_1px_0_var(--color-rule),0_12px_32px_-24px_rgba(22,33,28,0.5)]">
        {/* Header band — mirrors the metadata strip on a real OPD sheet */}
        <div className="border-b border-rule bg-wash px-7 py-3">
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
                   outline-none transition-colors placeholder:text-rule
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
    'w-full py-3 text-[13px] font-medium tracking-[0.08em] uppercase font-mono ' +
    'transition-opacity disabled:opacity-50 disabled:cursor-not-allowed'

  const styles =
    variant === 'primary'
      ? 'bg-seal text-paper hover:opacity-90'
      : 'border border-rule text-ink hover:bg-wash'

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
  // Errors state what happened and what to do. They do not apologise.
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
                  font-mono text-[10px] font-medium uppercase tracking-[0.16em]`}
    >
      {label}
    </span>
  )
}