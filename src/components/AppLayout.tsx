import type { ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatWeekday, manilaToday } from '../lib/dates'
import { initials } from '../lib/format'
import { useIdleSignOut } from '../lib/idle'
import { useTheme } from '../lib/theme'
import { LandingPage } from '../pages/LandingPage'
import {
  ActivityIcon,
  ChartIcon,
  CheckCircleIcon,
  GridIcon,
  LogOutIcon,
  MoonIcon,
  MoreIcon,
  PayrollIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
  WalletIcon,
} from './icons'
import { Loading } from './ui'

type Tab = { to: string; label: string; icon: (props: { className?: string }) => ReactNode }

// Grouped the same way on every screen size. Hiding owner screens from staff is
// a convenience; the database is what keeps staff out of the numbers.
const deskTabs: Tab[] = [
  { to: '/', label: 'Dashboard', icon: GridIcon },
  { to: '/check-in', label: 'Check in', icon: CheckCircleIcon },
  { to: '/members', label: 'Members', icon: UsersIcon },
]
const businessTabs: Tab[] = [
  { to: '/money', label: 'Money', icon: WalletIcon },
  { to: '/reports', label: 'Reports', icon: ChartIcon },
  { to: '/payroll', label: 'Payroll', icon: PayrollIcon },
]
const workspaceTabs: Tab[] = [
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const iconButton =
  'grid size-10 flex-none place-items-center rounded-control border border-line bg-card text-ink-2 hover:text-ink'

// The frame around every signed-in screen. It also guards the door: no session, no screens.
//   Phone:  a slim header on top and a tab bar at the bottom.
//   Laptop: a sidebar on the left, like a dashboard.
export function AppLayout() {
  const { session, signOut } = useAuth()
  const [theme, toggleTheme] = useTheme()
  // The desk phone is shared: sign out after a while with no one using it.
  useIdleSignOut(Boolean(session), signOut)
  const { pathname } = useLocation()

  if (session === undefined) return <Loading />
  // Signed out: the front page is public, every other screen goes to sign-in.
  if (session === null) return pathname === '/' ? <LandingPage /> : <Navigate to="/login" replace />
  // Password accepted, authenticator code still missing: finish signing in first.
  if (session.needsCode) return <Navigate to="/login" replace />

  const isOwner = session.role === 'owner'
  const groups: Array<[string, Tab[]]> = isOwner
    ? [
        ['Desk', deskTabs],
        ['Business', businessTabs],
        ['Workspace', workspaceTabs],
      ]
    : [['Desk', deskTabs]]
  // The phone tab bar has room for five: the desk, Money, and More for the rest.
  const phoneTabs = isOwner
    ? [...deskTabs, businessTabs[0], { to: '/more', label: 'More', icon: MoreIcon }]
    : deskTabs
  // On a phone, Reports, Payroll, Activity, and Settings are opened from More,
  // so the More tab stays highlighted while one of them is open.
  const inMore = ['/more', ...[...businessTabs.slice(1), ...workspaceTabs].map((tab) => tab.to)].some(
    (path) => pathname === path || pathname.startsWith(path + '/'),
  )

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
        <span className="block text-[12px] text-ink-3">{isOwner ? 'Owner' : 'Staff'}</span>
      </span>
    </div>
  )

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr] print:block">
      {/* Sidebar: laptop and wider */}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-card px-3 py-4 md:flex print:hidden">
        <p className="px-3 text-[17px] font-semibold tracking-tight">Laced</p>
        <p className="px-3 text-[12px] text-ink-3">{formatWeekday(manilaToday())}</p>

        <nav aria-label="Main" className="mt-5 grid gap-4">
          {groups.map(([title, tabs]) => (
            <div key={title}>
              {isOwner && <p className="mb-1 px-3 text-[12px] text-ink-3">{title}</p>}
              <div className="grid gap-0.5">
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
              </div>
            </div>
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
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:hidden print:hidden">
          {account}
          <div className="flex gap-2">
            {themeButton}
            {signOutButton}
          </div>
        </header>

        {api.mode === 'demo' && (
          <p className="border-b border-line bg-warn-bg px-4 py-1.5 text-center text-[12px] font-medium text-warn print:hidden">
            Demo data. Changes reset on reload.
          </p>
        )}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10 print:p-0">
          <Outlet />
        </main>

        {/* Tab bar: phone only */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
        >
          <div
            className="mx-auto grid max-w-xl gap-1 p-1.5"
            style={{ gridTemplateColumns: `repeat(${phoneTabs.length}, minmax(0, 1fr))` }}
          >
            {phoneTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-control text-[11px] ${
                    isActive || (tab.to === '/more' && inMore) ? 'bg-raised font-medium text-ink' : 'text-ink-3'
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
