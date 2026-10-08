import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { api } from '../../lib/api'
import { Button, CaseSheet, ErrorNotice, Field } from '../../components/ui'
import { BackButton } from '../../components/BackButton'

export default function ForgotPassword() {
  const [params] = useSearchParams()
  const role = params.get('role') === 'receptionist' ? 'receptionist' : 'doctor'
  const loginPath = role === 'receptionist' ? '/receptionist/login' : '/login'

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: { email, role },
        auth: false,
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link')
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
        eyebrow={role === 'receptionist' ? 'MedBridge AI · Front Desk' : 'MedBridge AI · OPD Documentation'}
        title="Forgot your password?"
        subtitle="Enter your email and we'll send you a link to choose a new one."
        footer={
          <Link to={loginPath} className="text-seal underline underline-offset-2">
            Back to sign in
          </Link>
        }
      >
        {sent ? (
          <p className="text-[15px] leading-relaxed text-graphite">
            If an account exists for <strong>{email}</strong>, a reset link is on its
            way. It works for one hour. Check your spam folder if you don't see it.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <ErrorNotice message={error} />}
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="pt-2">
              <Button type="submit" loading={busy}>
                Send reset link
              </Button>
            </div>
          </form>
        )}
      </CaseSheet>
    </div>
  )
}
