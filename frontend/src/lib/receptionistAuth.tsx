/**
 * Receptionist auth context.
 *
 * Deliberately separate from lib/auth.tsx (the doctor context) rather than
 * merged into it — keeps the doctor flow completely untouched while this
 * is still being built out. Uses the same token storage as the doctor
 * context (api.ts's getToken/setToken/clearToken): only one role is ever
 * signed in in a given browser at a time, same as the doctor flow today.
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
import type { ReceptionistPublic, ReceptionistTokenResponse } from '../types'

interface ReceptionistAuthState {
  receptionist: ReceptionistPublic | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const ReceptionistAuthContext = createContext<ReceptionistAuthState | null>(null)

export function ReceptionistAuthProvider({ children }: { children: ReactNode }) {
  const [receptionist, setReceptionist] = useState<ReceptionistPublic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api<ReceptionistPublic>('/auth/receptionist/me')
      .then(setReceptionist)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<ReceptionistTokenResponse>('/auth/receptionist/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    })
    setToken(res.access_token)
    setReceptionist(res.receptionist)
  }, [])

  const signOut = useCallback(() => {
    clearToken()
    setReceptionist(null)
  }, [])

  const value = useMemo(
    () => ({ receptionist, loading, signIn, signOut }),
    [receptionist, loading, signIn, signOut],
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
