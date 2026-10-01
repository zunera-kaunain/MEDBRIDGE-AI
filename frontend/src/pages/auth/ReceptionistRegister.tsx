import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'
import { Button, CaseSheet, ErrorNotice, Field } from '../../components/ui'

export default function ReceptionistRegister() {
  const { register } = useReceptionistAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(email, password, fullName)
      // No credential onboarding for receptionists — straight to the desk.
      navigate('/receptionist')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <CaseSheet
        eyebrow="MedBridge AI · Front Desk"
        title="Create a receptionist account"
        subtitle="Register patients and route them to a doctor."
        footer={
          <>
            Already have an account?{' '}
            <Link to="/receptionist/login" className="text-seal underline underline-offset-2">
              Sign in
            </Link>
            <br />
            Doctor?{' '}
            <Link to="/register" className="text-seal underline underline-offset-2">
              Create your account here
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <ErrorNotice message={error} />}

          <Field
            label="Full name"
            name="full_name"
            required
            placeholder="Priya Shetty"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

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
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="pt-2">
            <Button type="submit" loading={busy}>
              Create account
            </Button>
          </div>
        </form>
      </CaseSheet>
    </div>
  )
}
