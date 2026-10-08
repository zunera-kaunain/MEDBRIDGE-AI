/**
 * Receptionist auth context.
 *
 * Deliberately separate from lib/auth.tsx (the doctor context) rather than
 * merged into it — keeps the doctor flow completely untouched while this
 * is still being built out. Uses its OWN token storage (api.ts's
 * getReceptionistToken/setReceptionistToken/clearReceptionistToken) and
 * every api() call here passes role: 'receptionist' — both contexts are
 * mounted together for every page, so sharing one token key meant one
 * context's failed session-restore would silently clear the other's valid
 * token (see api.ts for the full story). Two separate keys means that
 * can't happen.
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

import {
  ApiError,
  api,
  clearReceptionistToken,
  getReceptionistToken,
  setReceptionistToken,
  setSessionNotice,
} from './api'
import type { ReceptionistPublic, ReceptionistTokenResponse } from '../types'

interface ReceptionistAuthState {
  receptionist: ReceptionistPublic | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  signInWithGoogle: (credential: string) => Promise<void>
  signOut: () => void
}

const ReceptionistAuthContext = createContext<ReceptionistAuthState | null>(null)

export function ReceptionistAuthProvider({ children }: { children: ReactNode }) {
  const [receptionist, setReceptionist] = useState<ReceptionistPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getReceptionistToken()) {
      setLoading(false)
      return
    }
    api<ReceptionistPublic>('/auth/receptionist/me', { role: 'receptionist' })
      .then(setReceptionist)
      .catch((err) => {
        clearReceptionistToken()
        if (err instanceof ApiError && err.status === 401) setSessionNotice()
      })
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<ReceptionistTokenResponse>('/auth/receptionist/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    setReceptionistToken(res.access_token)
    setReceptionist(res.receptionist)
  }, [])

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const res = await api<ReceptionistTokenResponse>('/auth/receptionist/register', {
        method: 'POST',
        body: { email, password, full_name: fullName },
        auth: false,
      })
      setReceptionistToken(res.access_token)
      setReceptionist(res.receptionist)
    },
    [],
  )

  const signInWithGoogle = useCallback(async (credential: string) => {
    const res = await api<ReceptionistTokenResponse>('/auth/google', {
      method: 'POST',
      body: { credential, role: 'receptionist' },
      auth: false,
    })
    setReceptionistToken(res.access_token)
    setReceptionist(res.receptionist)
  }, [])

  const signOut = useCallback(() => {
    clearReceptionistToken()
    setReceptionist(null)
  }, [])

  const value = useMemo(
    () => ({ receptionist, loading, signIn, register, signInWithGoogle, signOut }),
    [receptionist, loading, signIn, register, signInWithGoogle, signOut],
  )

  return (
    <ReceptionistAuthContext.Provider value={value}>
      {children}
    </ReceptionistAuthContext.Provider>
  )
}

export function useReceptionistAuth(): ReceptionistAuthState {
  const ctx = useContext(ReceptionistAuthContext)
  if (!ctx) {
    throw new Error('useReceptionistAuth must be used inside ReceptionistAuthProvider')
  }
  return ctx
}
