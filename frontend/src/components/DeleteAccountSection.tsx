import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useReceptionistAuth } from '../lib/receptionistAuth'
import { Modal } from './Modal'
import { Button, ErrorNotice, Field } from './ui'

/**
 * "Delete account" block for the profile pages. Opens a popup that asks for
 * the password and for the word DELETE, then removes the account and signs
 * the person out.
 */
export function DeleteAccountSection({ role }: { role: 'doctor' | 'receptionist' }) {
  const navigate = useNavigate()
  const doctorAuth = useAuth()
  const receptionistAuth = useReceptionistAuth()

  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isDoctor = role === 'doctor'

  function close() {
    if (busy) return
    setOpen(false)
    setPassword('')
    setConfirmText('')
    setError('')
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api(isDoctor ? '/auth/me' : '/auth/receptionist/me', {
        method: 'DELETE',
        body: { password: password || null },
        role,
      })
      if (isDoctor) doctorAuth.signOut()
      else receptionistAuth.signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account')
      setBusy(false)
    }
  }

  return (
    <div className="mt-10 border border-flag/40 bg-white px-6 py-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-flag">
        Danger zone
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-graphite">
        {isDoctor
          ? 'Deleting your account permanently removes you, and every patient, consultation, report, patient card and referral that belongs to you. This cannot be undone.'
          : 'Deleting your account permanently removes your sign-in. Patients you registered stay with their doctors. This cannot be undone.'}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 border border-flag px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-flag hover:bg-flag hover:text-white"
      >
        Delete account
      </button>

      {open && (
        <Modal title="Delete account" onClose={close}>
          <form onSubmit={handleDelete} className="space-y-5">
            <p className="text-[15px] leading-relaxed text-graphite">
              {isDoctor
                ? 'This permanently deletes your account and all of your patients and consultation records. There is no way to get them back.'
                : 'This permanently deletes your account. There is no way to get it back.'}
            </p>

            {error && <ErrorNotice message={error} />}

            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              hint="Leave blank if you sign in with Google."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              label="Type DELETE to confirm"
              name="confirm"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="quiet" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={busy}
                disabled={confirmText.trim() !== 'DELETE'}
              >
                Delete forever
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
