import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { ActivityIcon, ChartIcon, ChevronRightIcon, PayrollIcon, SettingsIcon } from '../components/icons'
import { PageHeader } from '../components/panels'
import { useSession } from '../lib/auth'

const links: Array<{ to: string; label: string; note: string; icon: (props: { className?: string }) => ReactNode }> = [
  { to: '/reports', label: 'Reports', note: 'Month by month, and downloads', icon: ChartIcon },
  { to: '/payroll', label: 'Payroll', note: 'Employees and monthly pay', icon: PayrollIcon },
  { to: '/activity', label: 'Activity', note: 'Who did what, and when', icon: ActivityIcon },
  { to: '/settings', label: 'Settings', note: 'Backup and system', icon: SettingsIcon },
]

// The phone tab bar fits five tabs. The owner's other screens live here.
export function MorePage() {
  const session = useSession()
  if (session.role !== 'owner') return <Navigate to="/" replace />
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="More" />
      <ul className="divide-y divide-line rounded-card border border-line bg-card">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <span className="grid size-10 flex-none place-items-center rounded-control bg-raised text-ink-2">
                <link.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{link.label}</span>
                <span className="block text-[13px] text-ink-3">{link.note}</span>
              </span>
              <ChevronRightIcon className="size-5 text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
