import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage } from '../lib/format'
import type { Role, StaffAccount } from '../lib/types'

type StaffAccountSheetProps = {
  open: boolean
  /** Null adds a new account; an account here means "set a new password". */
  account: StaffAccount | null
  onClose: () => void
  onSaved: (message: string) => void
}

export function StaffAccountSheet({ open, account, onClose, onSaved }: StaffAccountSheetProps) {
  return (
    <Sheet open={open} title={account ? `New password for ${account.fullName}` : 'Add staff account'} onClose={onClose}>
      {open && <StaffAccountForm key={account?.id ?? 'new'} account={account} onSaved={onSaved} />}
    </Sheet>
  )
}

function StaffAccountForm({ account, onSaved }: { account: StaffAccount | null; onSaved: (message: string) => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 10) {
      setError('Use a password of at least 10 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (account) {
        await api.setStaffPassword(account.id, password)
        onSaved(`New password set for ${account.fullName}. Give it to them in person.`)
      } else {
        await api.addStaffAccount({ fullName, email, password, role })
        onSaved(`${fullName.trim()} can now sign in with ${email.trim()}.`)
      }
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {!account && (
        <>
          <Field
            label="Full name"
            autoComplete="off"
            required
            minLength={2}
            maxLength={80}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <Field
            label="Email (used to sign in)"
            type="email"
            autoComplete="off"
            placeholder="ana@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </>
      )}
      <Field
        label={account ? 'New password' : 'Password'}
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. Tell it to them in person, not in a group chat."
        required
        minLength={10}
        maxLength={72}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {!account && (
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Access</legend>
          {(
            [
              ['staff', 'Front desk', 'Check in, members, selling, and closing the day. No revenue or expenses.'],
              ['owner', 'Owner', 'Everything, including money, payroll, and staff accounts.'],
            ] as const
          ).map(([value, label, note]) => (
            <label
              key={value}
              className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-control border p-3.5 ${
                role === value ? 'border-ink' : 'border-line'
              } bg-card`}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="mt-0.5 size-5 flex-none accent-(--ink)"
              />
              <span className="text-[14px] leading-snug">
                <span className="block font-medium">{label}</span>
                <span className="block text-ink-2">{note}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy}>
        {account ? 'Set password' : 'Add account'}
      </Button>
    </form>
  )
}
