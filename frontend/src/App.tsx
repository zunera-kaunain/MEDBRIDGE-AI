import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuth } from './lib/auth'
import { useReceptionistAuth } from './lib/receptionistAuth'
import Login from './pages/auth/Login'
import Landing from './pages/Landing'
import Register from './pages/auth/Register'
import CompleteProfile from './pages/auth/CompleteProfile'
import ReceptionistLogin from './pages/auth/ReceptionistLogin'
import ReceptionistDashboard from './pages/app/ReceptionistDashboard'
import ReceptionistRegisterPatient from './pages/app/ReceptionistRegisterPatient'
import Dashboard from './pages/app/Dashboard'
import Patients from './pages/app/Patients'
import PatientDetail from './pages/app/PatientDetail'
import ReportPage from './pages/app/Report'
import PatientCardPage from './pages/app/PatientCard'
import ReferralPage from './pages/app/Referral'
import { DoodleBackground } from './components/DoodleBackground'
import EvaluationPage from './pages/app/Evaluation'

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

function RequireReceptionist({ children }: { children: ReactNode }) {
  const { receptionist, loading } = useReceptionistAuth()
  if (loading) return <LoadingScreen />
  if (!receptionist) return <Navigate to="/receptionist/login" replace />
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
    <>
      <DoodleBackground />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/receptionist/login" element={<ReceptionistLogin />} />

        <Route
          path="/receptionist"
          element={
            <RequireReceptionist>
              <ReceptionistDashboard />
            </RequireReceptionist>
          }
        />
        <Route
          path="/receptionist/patients/new"
          element={
            <RequireReceptionist>
              <ReceptionistRegisterPatient />
            </RequireReceptionist>
          }
        />

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
        <Route
          path="/app/evaluation"
          element={
            <RequireProfile>
              <EvaluationPage />
            </RequireProfile>
          }
        />
        <Route
          path="/app/patients/:id"
          element={
            <RequireProfile>
              <PatientDetail />
            </RequireProfile>
          }
        />
        <Route
          path="/app/sessions/:sessionId/report"
          element={
            <RequireProfile>
              <ReportPage />
            </RequireProfile>
          }
        />
        <Route
          path="/app/sessions/:sessionId/card"
          element={
            <RequireProfile>
              <PatientCardPage />
            </RequireProfile>
          }
        />
        <Route
          path="/app/sessions/:sessionId/referral"
          element={
            <RequireProfile>
              <ReferralPage />
            </RequireProfile>
          }
        />

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  )
}