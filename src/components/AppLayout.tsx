import type { ReactNode } from 'react'
import { useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatWeekday, manilaToday } from '../lib/dates'
import { CheckCircleIcon, HomeIcon, UsersIcon } from './icons'
import { Sheet } from './Sheet'
import { Button, Loading } from './ui'

type Tab = { to: string; label: string; icon: (props: { className?: string }) => ReactNode }

const tabs: Tab[] = [
  { to: '/', label: 'Today', icon: HomeIcon },
  { to: '/check-in', label: 'Check in', icon: CheckCircleIcon },
  { to: '/members', label: 'Members', icon: UsersIcon },
]

// The frame around every signed-in screen: top bar, content, bottom tabs.
// It also guards the door: no session, no screens.
export function AppLayout() {
  const { session, signOut } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)

  if (session === undefined) return <Loading />
  if (session === null) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bar text-on-bar">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
          <div>
            <p className="text-[17px] font-medium leading-tight tracking-tight">Laced</p>
            <p className="text-[12px] opacity-75">{formatWeekday(manilaToday())}</p>
          </div>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="-mr-2 min-h-11 rounded-control px-2 text-right text-[13px] focus-visible:outline-on-bar"
          >
            <span className="block font-medium leading-tight">{session.fullName}</span>
            <span className="block opacity-75">{session.role === 'owner' ? 'Owner' : 'Staff'}</span>
          </button>
        </div>
      </header>

      {api.mode === 'demo' && (
        <p className="bg-warn-bg px-4 py-1.5 text-center text-[12px] font-medium text-warn">
          Demo data. Changes reset on reload.
        </p>
      )}

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-5 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[12px] ${
                  isActive ? 'font-medium text-ink' : 'text-ink-3'
                }`
              }
            >
              <tab.icon className="size-6" />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Sheet open={accountOpen} title="Account" onClose={() => setAccountOpen(false)}>
        <p className="text-[15px]">{session.fullName}</p>
        <p className="mb-4 text-[14px] text-ink-2">Signed in as {session.role === 'owner' ? 'owner' : 'staff'}</p>
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </Sheet>
    </div>
  )
}
