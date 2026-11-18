import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import { formatDate } from '../lib/dates'
import { errorMessage, formatPeso } from '../lib/format'
import type { Member } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { emptyPayment, PaymentFields, PlanPicker } from './PaymentFields'

type SellSheetProps = {
  member: Member | null // null keeps the sheet closed
  onClose: () => void
  onSold: (message: string) => void
}

export function SellSheet({ member, onClose, onSold }: SellSheetProps) {
  return (
    <Sheet open={member !== null} title={member?.status === 'none' ? 'Sell plan' : 'Renew'} onClose={onClose}>
      {member && <SellForm member={member} onSold={onSold} />}
    </Sheet>
  )
}

function SellForm({ member, onSold }: { member: Member; onSold: (message: string) => void }) {
  const plans = useLoad(async () => (await api.listPlans()).filter((plan) => plan.durationMonths !== null), [])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [payment, setPayment] = useState(emptyPayment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!plans.data) return plans.error ? <Notice tone="bad">{plans.error}</Notice> : <Loading />

  // Start on the member's last plan when it is still offered, otherwise the first one.
  const selected =
    plans.data.find((plan) => plan.id === pickedId) ??
    plans.data.find((plan) => plan.id === member.planId) ??
    plans.data[0]

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const sale = await api.sellMembership({ memberId: member.id, planId: selected.id, ...payment })
      onSold(`Collected ${formatPeso(sale.amountCentavos)}. Valid until ${formatDate(sale.endDate!)}.`)
    } catch (reason) {
      setError(errorMessage(reason))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-[15px] text-ink-2">{member.fullName}</p>
      <PlanPicker plans={plans.data} selectedId={selected?.id ?? ''} onSelect={setPickedId} />
      <PaymentFields plan={selected} value={payment} onChange={setPayment} />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy} disabled={!selected}>
        Collect {selected ? formatPeso(selected.priceCentavos) : ''}
      </Button>
    </form>
  )
}
