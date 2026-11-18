import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Checkbox, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage } from '../lib/format'

type RegisterSheetProps = { open: boolean; onClose: () => void; onRegistered: (memberId: string) => void }

export function RegisterSheet({ open, onClose, onRegistered }: RegisterSheetProps) {
  return (
    <Sheet open={open} title="Register member" onClose={onClose}>
      <RegisterForm onRegistered={onRegistered} />
    </Sheet>
  )
}

function RegisterForm({ onRegistered }: { onRegistered: (memberId: string) => void }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onRegistered(await api.registerMember({ fullName, phone, consent }))
    } catch (reason) {
      setError(errorMessage(reason))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field
        label="Full name"
        autoComplete="off"
        placeholder="Juan Dela Cruz"
        required
        minLength={2}
        maxLength={80}
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <Field
        label="Mobile number"
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        placeholder="09171234567"
        required
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      {/* Only a name and a number are collected. The gym's own name replaces "the gym" at launch. */}
      <Checkbox checked={consent} onChange={setConsent}>
        The member agrees that the gym may store their name and mobile number to manage their membership,
        visits, and payments. They can ask the front desk to see, correct, or delete it at any time.
      </Checkbox>
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy} disabled={!consent}>
        Register
      </Button>
    </form>
  )
}
