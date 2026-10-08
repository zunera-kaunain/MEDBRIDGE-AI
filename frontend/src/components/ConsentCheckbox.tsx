import { useState } from 'react'

import { LegalSections } from './LegalPage'
import { PRIVACY, TERMS } from './legalContent'
import { Modal } from './Modal'

/**
 * "I agree to the Terms and Privacy Policy" box shown on every sign-up form.
 * The two links open the text in a popup, so the person keeps what they
 * typed in the form.
 */
export function ConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const [open, setOpen] = useState<'terms' | 'privacy' | null>(null)
  const doc = open === 'terms' ? TERMS : PRIVACY

  const linkClass = 'text-seal underline underline-offset-2'

  return (
    <>
      <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-graphite">
        <input
          type="checkbox"
          required
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1F5C45]"
        />
        <span>
          I agree to the{' '}
          <button type="button" className={linkClass} onClick={() => setOpen('terms')}>
            Terms of Use
          </button>{' '}
          and{' '}
          <button type="button" className={linkClass} onClick={() => setOpen('privacy')}>
            Privacy Policy
          </button>
          .
        </span>
      </label>

      {open && (
        <Modal title={doc.title} onClose={() => setOpen(null)}>
          <p className="mb-6 text-[15px] leading-relaxed text-graphite">{doc.intro}</p>
          <LegalSections doc={doc} />
        </Modal>
      )}
    </>
  )
}
