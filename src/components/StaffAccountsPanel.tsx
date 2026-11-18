import { useState } from 'react'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { errorMessage } from '../lib/format'
import type { StaffAccount } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { StaffAccountSheet } from '../sheets/StaffAccountSheet'
import { PlusIcon } from './icons'
import { Empty, Panel, smallButton } from './panels'
import { Loading, Notice } from './ui'

// Owner only: who can sign in to the app. Each person gets their own login,
// so every payment and check-in shows who did it.
export function StaffAccountsPanel() {
  const session = useSession()
  const [version, setVersion] = useState(0)
  const [sheet, setSheet] = useState<StaffAccount | 'new' | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const accounts = useLoad(() => api.listStaffAccounts(), [version])

  async function toggle(account: StaffAccount) {
    const wasActive = account.active
    setBusyId(account.id)
    setMessage(null)
    try {
      await api.setStaffActive(account.id, !wasActive)
      setMessage({
        tone: 'good',
        text: wasActive
          ? `${account.fullName} can no longer sign in.`
          : `${account.fullName} can sign in again.`,
      })
      setVersion((value) => value + 1)
    } catch (cause) {
      setMessage({ tone: 'bad', text: errorMessage(cause) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel
      title="Staff accounts"
      action={
        <button type="button" className={smallButton} onClick={() => setSheet('new')}>
          <PlusIcon />
          Add
        </button>
      }
    >
      {message && (
        <div className="mb-3">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
      {accounts.error && <Notice tone="bad">{accounts.error}</Notice>}
      {!accounts.data ? (
        !accounts.error && <Loading />
      ) : accounts.data.length === 0 ? (
        <Empty>No accounts yet.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {accounts.data.map((account) => {
            const isMe = account.id === session.userId
            return (
              <li key={account.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14px] font-medium ${account.active ? '' : 'text-ink-3'}`}>
                    {account.fullName}
                    {isMe && <span className="font-normal text-ink-3"> (you)</span>}
                  </p>
                  <p className="text-[12px] text-ink-3">
                    {account.role === 'owner' ? 'Owner' : 'Front desk'}
                    {!account.active && ' · Turned off'}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {account.active && (
                    <button type="button" className={smallButton} onClick={() => setSheet(account)}>
                      New password
                    </button>
                  )}
                  {!isMe && (
                    <button
                      type="button"
                      className={smallButton}
                      disabled={busyId === account.id}
                      onClick={() => toggle(account)}
                    >
                      {busyId === account.id ? 'Saving…' : account.active ? 'Turn off' : 'Turn on'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-ink-3">
        When someone stops working here, turn their account off the same day. Their past records stay.
      </p>

      <StaffAccountSheet
        open={sheet !== null}
        account={sheet === 'new' ? null : sheet}
        onClose={() => setSheet(null)}
        onSaved={(text) => {
          setSheet(null)
          setMessage({ tone: 'good', text })
          setVersion((value) => value + 1)
        }}
      />
    </Panel>
  )
}
