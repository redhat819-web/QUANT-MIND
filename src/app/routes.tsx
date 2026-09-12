import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { DashboardPage } from '../pages/DashboardPage'
import { HoldingsPage } from '../pages/HoldingsPage'
import { JudgmentLogPage } from '../pages/JudgmentLogPage'
import { LoginPage } from '../pages/LoginPage'
import { ProtectedRoute } from './ProtectedRoute'

/** 대시보드(User Story 1), 계좌·종목 리스트(User Story 2), 판단 로그(User Story 3)를 라우팅한다. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/holdings"
        element={
          <ProtectedRoute>
            <AppShell>
              <HoldingsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/judgment-log"
        element={
          <ProtectedRoute>
            <AppShell>
              <JudgmentLogPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
