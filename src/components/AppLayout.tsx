import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatWeekday, manilaToday } from '../lib/dates'
import { initials } from '../lib/format'
import { useTheme } from '../lib/theme'
import { CheckCircleIcon, GridIcon, LogOutIcon, MoonIcon, SunIcon, UsersIcon, WalletIcon } from './icons'
import { Loading } from './ui'

type Tab = { to: string; label: string; icon: (props: { className?: string }) => ReactNode; ownerOnly?: boolean }

const tabs: Tab[] = [
  { to: '/', label: 'Dashboard', icon: GridIcon },
  { to: '/check-in', label: 'Check in', icon: CheckCircleIcon },
  { to: '/members', label: 'Members', icon: UsersIcon },
  { to: '/money', label: 'Money', icon: WalletIcon, ownerOnly: true },
]

const allTabs = tabs

const iconButton =
  'grid size-10 flex-none place-items-center rounded-control border border-line bg-card text-ink-2 hover:text-ink'

// The frame around every signed-in screen. It also guards the door: no session, no screens.
//   Phone:  a slim header on top and a tab bar at the bottom.
//   Laptop: a sidebar on the left, like a dashboard.
export function AppLayout() {
  const { session, signOut } = useAuth()
  const [theme, toggleTheme] = useTheme()

  if (session === undefined) return <Loading />
  if (session === null) return <Navigate to="/login" replace />

  // Hiding the Money tab is a convenience. The database is what keeps staff out.
  const tabs = allTabs.filter((tab) => !tab.ownerOnly || session.role === 'owner')

  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={iconButton}
    >
      {theme === 'dark' ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </button>
  )
  const signOutButton = (
    <button type="button" onClick={signOut} aria-label="Sign out" className={iconButton}>
      <LogOutIcon className="size-5" />
    </button>
  )
  const account = (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid size-9 flex-none place-items-center rounded-full bg-raised text-[13px] font-medium text-ink-2"
      >
        {initials(session.fullName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{session.fullName}</span>
        <span className="block text-[12px] text-ink-3">{session.role === 'owner' ? 'Owner' : 'Staff'}</span>
      </span>
    </div>
  )

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      {/* Sidebar: laptop and wider */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-card px-3 py-4 md:flex">
        <p className="px-3 text-[17px] font-semibold tracking-tight">Laced</p>
        <p className="px-3 text-[12px] text-ink-3">{formatWeekday(manilaToday())}</p>

        <nav aria-label="Main" className="mt-6 grid gap-0.5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-2.5 rounded-control px-3 text-[14px] ${
                  isActive ? 'bg-raised font-medium text-ink' : 'text-ink-2 hover:text-ink'
                }`
              }
            >
              <tab.icon className="size-[18px]" />
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto grid gap-3 border-t border-line px-1 pt-3">
          {account}
          <div className="flex gap-2">
            {themeButton}
            {signOutButton}
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Header: phone only */}
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:hidden">
          {account}
          <div className="flex gap-2">
            {themeButton}
            {signOutButton}
          </div>
        </header>

        {api.mode === 'demo' && (
          <p className="border-b border-line bg-warn-bg px-4 py-1.5 text-center text-[12px] font-medium text-warn">
            Demo data. Changes reset on reload.
          </p>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
          <Outlet />
        </main>

        {/* Tab bar: phone only */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className={`mx-auto grid max-w-xl gap-1 p-1.5 ${tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-control text-[11px] ${
                    isActive ? 'bg-raised font-medium text-ink' : 'text-ink-3'
                  }`
                }
              >
                <tab.icon className="size-5" />
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
