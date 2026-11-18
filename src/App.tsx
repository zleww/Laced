import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { AuthProvider } from './lib/auth'
import { DashboardPage } from './pages/DashboardPage'
import { CheckInPage } from './pages/CheckInPage'
import { LoginPage } from './pages/LoginPage'
import { MemberPage } from './pages/MemberPage'
import { MembersPage } from './pages/MembersPage'
import { MoneyPage } from './pages/MoneyPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Everything inside AppLayout needs a signed-in staff account. */}
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="money" element={<MoneyPage />} />
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
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
