/**
 * Auth context.
 *
 * Holds the signed-in doctor and exposes register / signIn / signOut.
 * The token lives in localStorage so a refresh keeps you signed in.
 *
 * Trade-off worth knowing: localStorage is readable by any script on the
 * page, so an XSS bug would expose the token. httpOnly cookies avoid that
 * but need CSRF handling and complicate the single-origin deploy. For a
 * locally deployed clinical tool this is an acceptable trade — record the
 * reasoning in DECISIONS.md.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { api, clearToken, getToken, setToken } from './api'
import type { DoctorProfileInput, DoctorPublic, TokenResponse } from '../types'

interface AuthState {
  doctor: DoctorPublic | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>
  saveProfile: (profile: DoctorProfileInput) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<DoctorPublic | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore the session on load. A stored token may be expired, so we ask
  // the server rather than trusting it.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api<DoctorPublic>('/auth/me')
      .then(setDoctor)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    setToken(res.access_token)
    setDoctor(res.doctor)
  }, [])

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const res = await api<TokenResponse>('/auth/register', {
        method: 'POST',
        body: { email, password, full_name: fullName },
        auth: false,
      })
      setToken(res.access_token)
      setDoctor(res.doctor)
    },
    [],
  )

  const saveProfile = useCallback(async (profile: DoctorProfileInput) => {
    const updated = await api<DoctorPublic>('/api/doctor/profile', {
      method: 'POST',
      body: profile,
    })
    setDoctor(updated)
  }, [])

  const signOut = useCallback(() => {
    clearToken()
    setDoctor(null)
  }, [])

  const value = useMemo(
    () => ({ doctor, loading, signIn, register, saveProfile, signOut }),
    [doctor, loading, signIn, register, saveProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}