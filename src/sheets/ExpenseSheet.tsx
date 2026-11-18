import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { manilaToday } from '../lib/dates'
import { errorMessage, parsePeso } from '../lib/format'

type ExpenseSheetProps = { open: boolean; onClose: () => void; onAdded: () => void }

export function ExpenseSheet({ open, onClose, onAdded }: ExpenseSheetProps) {
  return (
    <Sheet open={open} title="Add expense" onClose={onClose}>
      <ExpenseForm onAdded={onAdded} />
    </Sheet>
  )
}

function ExpenseForm({ onAdded }: { onAdded: () => void }) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState(manilaToday())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const amountCentavos = parsePeso(amount)
    if (amountCentavos === null || amountCentavos === 0) {
      setError('Enter the amount as a number above zero, like 4500 or 4500.75.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.addExpense({ category, amountCentavos, spentOn, note })
      onAdded()
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field
        label="What was it for"
        placeholder="Electricity"
        required
        minLength={2}
        maxLength={40}
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      />
      <Field
        label="Amount (₱)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="4500"
        required
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <Field
        label="Date"
        type="date"
        required
        max={manilaToday()}
        value={spentOn}
        onChange={(event) => setSpentOn(event.target.value)}
      />
      <Field
        label="Note (optional)"
        maxLength={200}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy}>
        Add expense
      </Button>
    </form>
  )
}
