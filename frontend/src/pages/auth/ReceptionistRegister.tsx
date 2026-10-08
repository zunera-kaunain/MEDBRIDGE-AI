import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'
import { Button, CaseSheet, ErrorNotice, Field } from '../../components/ui'
import { BackButton } from '../../components/BackButton'
import { ConsentCheckbox } from '../../components/ConsentCheckbox'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'

export default function ReceptionistRegister() {
  const { register, signInWithGoogle } = useReceptionistAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [agreed, setAgreed] = useState(false)

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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute left-6 top-6 z-10">
        <BackButton fallback="/" />
      </div>
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

          <ConsentCheckbox checked={agreed} onChange={setAgreed} />

          <div className="pt-2">
            <Button type="submit" loading={busy} disabled={!agreed}>
              Create account
            </Button>
          </div>
        </form>

        <GoogleSignInButton
          onError={setError}
          blockedMessage={agreed ? undefined : 'Tick the box to agree to the Terms and Privacy Policy first'}
          onCredential={async (credential) => {
            await signInWithGoogle(credential)
            navigate('/receptionist')
          }}
        />
      </CaseSheet>
    </div>
  )
}
