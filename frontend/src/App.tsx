import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './lib/auth'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import CompleteProfile from './pages/auth/CompleteProfile'
import Dashboard from './pages/app/Dashboard'
import Patients from './pages/app/Patients'

function RequireAuth({ children }: { children: ReactNode }) {
  const { doctor, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!doctor) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireProfile({ children }: { children: ReactNode }) {
  const { doctor, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!doctor) return <Navigate to="/login" replace />
  if (!doctor.profile_complete) return <Navigate to="/complete-profile" replace />
  return <>{children}</>
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-graphite">
        Loading
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/complete-profile"
        element={
          <RequireAuth>
            <CompleteProfile />
          </RequireAuth>
        }
      />

      <Route
        path="/app"
        element={
          <RequireProfile>
            <Dashboard />
          </RequireProfile>
        }
      />
      <Route
        path="/app/patients"
        element={
          <RequireProfile>
            <Patients />
          </RequireProfile>
        }
      />

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}