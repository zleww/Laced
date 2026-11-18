import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Field, Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage, formatPeso } from '../lib/format'
import type { Member } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { emptyPayment, PaymentFields, PlanPicker } from './PaymentFields'

type DayPassSheetProps = {
  open: boolean
  member?: Member | null // a registered member, or leave empty for a walk-in guest
  onClose: () => void
  onSold: (message: string) => void
}

// Pay first, then check in: one action records the payment and the visit.
export function DayPassSheet({ open, member = null, onClose, onSold }: DayPassSheetProps) {
  return (
    <Sheet open={open} title="Day pass" onClose={onClose}>
      <DayPassForm member={member} onSold={onSold} />
    </Sheet>
  )
}

function DayPassForm({ member, onSold }: { member: Member | null; onSold: (message: string) => void }) {
  const plans = useLoad(async () => (await api.listPlans()).filter((plan) => plan.durationDays !== null), [])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [payment, setPayment] = useState(emptyPayment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!plans.data) return plans.error ? <Notice tone="bad">{plans.error}</Notice> : <Loading />

  const selected = plans.data.find((plan) => plan.id === pickedId) ?? plans.data[0]
  const name = member?.fullName ?? guestName.trim()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const sale = await api.sellDayPass({
        planId: selected.id,
        ...payment,
        ...(member ? { memberId: member.id } : { guestName }),
      })
      onSold(`Collected ${formatPeso(sale.amountCentavos)}. ${name} is checked in.`)
    } catch (reason) {
      setError(errorMessage(reason))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {member ? (
        <p className="text-[15px] text-ink-2">{member.fullName}</p>
      ) : (
        <Field
          label="Guest's name"
          autoComplete="off"
          placeholder="Juan Dela Cruz"
          hint="The gym records this name with today's payment and visit."
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
      )}
      <PlanPicker plans={plans.data} selectedId={selected?.id ?? ''} onSelect={setPickedId} />
      <PaymentFields plan={selected} value={payment} onChange={setPayment} />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy} disabled={!selected}>
        Collect {selected ? formatPeso(selected.priceCentavos) : ''} and check in
      </Button>
    </form>
  )
}
