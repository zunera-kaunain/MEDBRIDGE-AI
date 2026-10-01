import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'
import { Button, CaseSheet, ErrorNotice, Field } from '../../components/ui'

export default function ReceptionistLogin() {
  const { signIn } = useReceptionistAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/receptionist')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <CaseSheet
        eyebrow="MedBridge AI · Front Desk"
        title="Receptionist sign in"
        subtitle="Register patients and route them to a doctor."
        footer={
          <>
            Doctor?{' '}
            <Link to="/login" className="text-seal underline underline-offset-2">
              Sign in here
            </Link>
          </>
        }
      >
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

          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="pt-2">
            <Button type="submit" loading={busy}>
              Sign in
            </Button>
          </div>
        </form>
      </CaseSheet>
    </div>
  )
}
