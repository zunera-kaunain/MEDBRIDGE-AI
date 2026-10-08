import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useReceptionistAuth } from '../../lib/receptionistAuth'
import { Button, CaseSheet, ErrorNotice, Field } from '../../components/ui'
import { clearSessionNotice, getSessionNotice } from '../../lib/api'
import { BackButton } from '../../components/BackButton'
import { GoogleSignInButton } from '../../components/GoogleSignInButton'

export default function ReceptionistLogin() {
  const { signIn, signInWithGoogle } = useReceptionistAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice] = useState(getSessionNotice)
  useEffect(() => clearSessionNotice(), [])

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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute left-6 top-6 z-10">
        <BackButton fallback="/" />
      </div>
      <CaseSheet
        eyebrow="MedBridge AI · Front Desk"
        title="Receptionist sign in"
        subtitle="Register patients and route them to a doctor."
        footer={
          <>
            New here?{' '}
            <Link to="/receptionist/register" className="text-seal underline underline-offset-2">
              Create an account
            </Link>
            <br />
            Doctor?{' '}
            <Link to="/login" className="text-seal underline underline-offset-2">
              Sign in here
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {notice && !error && (
          <div
            role="status"
            className="border-l-2 border-caution bg-[#f3ecd9] px-3 py-2 text-sm text-ink"
          >
            {notice}
          </div>
        )}
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

          <div className="-mt-2 text-right">
            <Link
              to="/forgot-password?role=receptionist"
              className="text-[13px] text-seal underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={busy}>
              Sign in
            </Button>
          </div>
        </form>

        <GoogleSignInButton
          onError={setError}
          onCredential={async (credential) => {
            await signInWithGoogle(credential)
            navigate('/receptionist')
          }}
        />
      </CaseSheet>
    </div>
  )
}
