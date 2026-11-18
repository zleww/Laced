import { useState } from 'react'
import { Navigate } from 'react-router'
import { CheckIcon } from '../components/icons'
import { PageHeader, Panel } from '../components/panels'
import { SignInLimitsPanel } from '../components/SignInLimitsPanel'
import { StaffAccountsPanel } from '../components/StaffAccountsPanel'
import { TwoStepPanel } from '../components/TwoStepPanel'
import { Button, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { downloadBackup } from '../lib/exports'
import { errorMessage } from '../lib/format'
import { useTheme } from '../lib/theme'

const checklist = [
  'Turn on two-step sign-in for the owner account (the panel above).',
  'Give every desk staff member their own login. Never share the owner account.',
  'When someone stops working here, turn off their account the same day.',
  'Download a backup every week and keep it off the desk phone.',
  'Once, try opening a backup on another computer to be sure it works.',
  'Keep the desk phone locked with a PIN when no one is at the desk.',
]

// Owner only. Backups, what this copy of the app is connected to, and the habits that keep it safe.
export function SettingsPage() {
  const session = useSession()
  const [theme, toggleTheme] = useTheme()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  if (session.role !== 'owner') return <Navigate to="/" replace />

  async function backup() {
    setBusy(true)
    setMessage(null)
    try {
      const count = await downloadBackup()
      setMessage({ tone: 'good', text: `Backup downloaded: ${count.toLocaleString('en-PH')} records.` })
    } catch (cause) {
      setMessage({ tone: 'bad', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  const info: Array<[string, string]> = [
    ['Signed in as', session.fullName],
    ['Role', 'Owner'],
    ['Database', api.mode === 'live' ? 'Supabase (live)' : 'Demo data on this device'],
    ['App version', __APP_VERSION__],
    ['Theme', theme === 'dark' ? 'Dark' : 'Light'],
  ]

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="Settings" fromMore />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Backup">
          <p className="text-[14px] text-ink-2">
            Downloads every record (members, payments, check-ins, expenses, day closes, payroll) as one file. It holds
            personal data, so keep it private: on the owner's computer or a private drive, never in a group chat.
          </p>
          <p className="mt-2 text-[13px] text-ink-3">
            Supabase also keeps its own backups depending on the plan. Check Database, then Backups, in the Supabase
            dashboard. Your own weekly download is the copy you control.
          </p>
          {message && (
            <div className="mt-3">
              <Notice tone={message.tone}>{message.text}</Notice>
            </div>
          )}
          <Button className="mt-4 md:w-auto md:px-5" busy={busy} onClick={backup}>
            Download backup
          </Button>
        </Panel>

        <Panel title="System">
          <dl className="divide-y divide-line text-[14px]">
            {info.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-2">
                <dt className="text-ink-2">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={toggleTheme}
            className="mt-3 min-h-9 rounded-full border border-line px-3 text-[12px] font-medium text-ink-2 hover:text-ink"
          >
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </button>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TwoStepPanel />
        <SignInLimitsPanel />
      </div>

      <StaffAccountsPanel />

      <Panel title="Keeping the system safe">
        <ul className="grid gap-2 md:grid-cols-2">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-2 rounded-control border border-line p-3 text-[14px]">
              <span className="mt-0.5 text-ink-3">
                <CheckIcon />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
