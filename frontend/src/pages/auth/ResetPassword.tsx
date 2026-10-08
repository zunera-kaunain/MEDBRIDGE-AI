import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../../lib/api'
import { Button, CaseSheet, ErrorNotice, Field } from '../../components/ui'
import { BackButton } from '../../components/BackButton'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('The two passwords do not match')
      return
    }
    setBusy(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: password },
        auth: false,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute left-6 top-6 z-10">
        <BackButton fallback="/login" />
      </div>
      <CaseSheet
        eyebrow="MedBridge AI · Account"
        title="Choose a new password"
        subtitle="Pick something you haven't used before."
        footer={
          <>
            <Link to="/login" className="text-seal underline underline-offset-2">
              Doctor sign in
            </Link>
            {' · '}
            <Link to="/receptionist/login" className="text-seal underline underline-offset-2">
              Receptionist sign in
            </Link>
          </>
        }
      >
        {!token ? (
          <ErrorNotice message="This reset link is incomplete. Request a new one from the sign-in page." />
        ) : done ? (
          <p className="text-[15px] leading-relaxed text-graphite">
            Your password has been updated. You can sign in with it now.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorNotice message={error} />}
            <Field
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="At least 8 characters."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              label="Confirm new password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <div className="pt-2">
              <Button type="submit" loading={busy}>
                Update password
              </Button>
            </div>
          </form>
        )}
      </CaseSheet>
    </div>
  )
}
