import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Field, Notice } from '../components/ui'
import { errorMessage } from '../lib/format'

type ReasonSheetProps = {
  open: boolean
  title: string
  /** What is about to be voided, in plain words. */
  subject: string
  confirmLabel: string
  /** Shown under the reason field. */
  hint?: string
  onClose: () => void
  /** Does the work. If it throws, the message is shown and the sheet stays open. */
  onConfirm: (reason: string) => Promise<void>
}

// Voiding always asks for a written reason. Nothing is ever deleted.
export function ReasonSheet({ open, title, subject, confirmLabel, hint, onClose, onConfirm }: ReasonSheetProps) {
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <ReasonForm subject={subject} confirmLabel={confirmLabel} hint={hint} onConfirm={onConfirm} />
    </Sheet>
  )
}

function ReasonForm({
  subject,
  confirmLabel,
  hint = "The record is kept and marked as voided. This can't be undone.",
  onConfirm,
}: Pick<ReasonSheetProps, 'subject' | 'confirmLabel' | 'hint' | 'onConfirm'>) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onConfirm(reason)
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-[14px] text-ink-2">{subject}</p>
      <Field
        label="Reason"
        hint={hint}
        placeholder="Entered twice"
        required
        minLength={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy}>
        {confirmLabel}
      </Button>
    </form>
  )
}
