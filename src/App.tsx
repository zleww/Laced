import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { AuthProvider } from './lib/auth'
import { ActivityPage } from './pages/ActivityPage'
import { CheckInPage } from './pages/CheckInPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { MemberPage } from './pages/MemberPage'
import { MembersPage } from './pages/MembersPage'
import { MoneyPage } from './pages/MoneyPage'
import { MorePage } from './pages/MorePage'
import { PayrollPage } from './pages/PayrollPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Everything inside AppLayout needs a signed-in staff account. */}
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            {/* Owner screens. Each one sends a staff account back to the Dashboard. */}
            <Route path="money" element={<MoneyPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* Desk screens stay in a narrow column, even on a wide screen. */}
            <Route
              element={
                <div className="mx-auto max-w-xl">
                  <Outlet />
                </div>
              }
            >
              <Route path="check-in" element={<CheckInPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/:id" element={<MemberPage />} />
              <Route path="more" element={<MorePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
