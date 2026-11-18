import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { AuthProvider } from './lib/auth'
import { CheckInPage } from './pages/CheckInPage'
import { LoginPage } from './pages/LoginPage'
import { MemberPage } from './pages/MemberPage'
import { MembersPage } from './pages/MembersPage'
import { TodayPage } from './pages/TodayPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Everything inside AppLayout needs a signed-in staff account. */}
          <Route element={<AppLayout />}>
            <Route index element={<TodayPage />} />
            <Route path="check-in" element={<CheckInPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="members/:id" element={<MemberPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
