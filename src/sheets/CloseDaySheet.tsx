import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage, parsePeso } from '../lib/format'

type CloseDaySheetProps = { open: boolean; onClose: () => void; onClosed: () => void }

// A blind count: you type what you counted, and the system compares it with
// the records for the owner. The expected amounts are not shown here on purpose.
export function CloseDaySheet({ open, onClose, onClosed }: CloseDaySheetProps) {
  return (
    <Sheet open={open} title="Close today" onClose={onClose}>
      <CloseDayForm onClosed={onClosed} />
    </Sheet>
  )
}

function CloseDayForm({ onClosed }: { onClosed: () => void }) {
  const [cash, setCash] = useState('')
  const [gcash, setGcash] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const countedCashCentavos = parsePeso(cash)
    const countedGcashCentavos = parsePeso(gcash)
    if (countedCashCentavos === null || countedGcashCentavos === null) {
      setError('Enter both amounts as numbers, like 6840 or 6840.50. Use 0 if there was none.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.closeDay({ countedCashCentavos, countedGcashCentavos, note })
      onClosed()
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-[14px] text-ink-2">Count the drawer and check the GCash app, then enter both totals.</p>
      <Field
        label="Cash counted (₱)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="6840"
        required
        value={cash}
        onChange={(event) => setCash(event.target.value)}
      />
      <Field
        label="GCash received today (₱)"
        hint="The day's total from the GCash app's transaction history."
        inputMode="decimal"
        autoComplete="off"
        placeholder="1700"
        required
        value={gcash}
        onChange={(event) => setGcash(event.target.value)}
      />
      <Field
        label="Note (optional)"
        placeholder="Anything the owner should know"
        maxLength={200}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy}>
        Close today
      </Button>
    </form>
  )
}
