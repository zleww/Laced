import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { formatMonth } from '../lib/dates'
import { errorMessage, formatPeso, parsePeso } from '../lib/format'
import { computeDeductions, employerShare, netPay } from '../lib/payroll'
import type { Employee, PayrollEntry } from '../lib/types'

type PayrollSheetProps = {
  open: boolean
  employee: Employee | null
  periodMonth: string
  /** The draft being changed, if there is one. */
  entry: PayrollEntry | null
  onClose: () => void
  onSaved: () => void
}

export function PayrollSheet({ open, employee, periodMonth, entry, onClose, onSaved }: PayrollSheetProps) {
  return (
    <Sheet open={open} title={employee ? `Pay ${employee.fullName}` : 'Pay'} onClose={onClose}>
      {employee && (
        <PayrollForm
          key={`${employee.id}-${periodMonth}`}
          employee={employee}
          periodMonth={periodMonth}
          entry={entry}
          onSaved={onSaved}
        />
      )}
    </Sheet>
  )
}

function PayrollForm({
  employee,
  periodMonth,
  entry,
  onSaved,
}: {
  employee: Employee
  periodMonth: string
  entry: PayrollEntry | null
  onSaved: () => void
}) {
  const [gross, setGross] = useState(String((entry?.grossCentavos ?? employee.monthlyRateCentavos) / 100))
  const [other, setOther] = useState(entry && entry.otherCentavos > 0 ? String(entry.otherCentavos / 100) : '')
  const [otherNote, setOtherNote] = useState(entry?.otherNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grossCentavos = parsePeso(gross)
  const otherCentavos = other.trim() === '' ? 0 : parsePeso(other)
  // A preview only. The database works the amounts out again when this is saved.
  const preview =
    grossCentavos && otherCentavos !== null ? computeDeductions(grossCentavos, employee.withContributions) : null
  const net = preview && grossCentavos ? netPay(grossCentavos, preview, otherCentavos ?? 0) : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!grossCentavos) {
      setError('Enter the gross pay as a number above zero.')
      return
    }
    if (otherCentavos === null) {
      setError('Enter other deductions as a number, or leave it empty.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.savePayroll({ employeeId: employee.id, periodMonth, grossCentavos, otherCentavos, otherNote })
      onSaved()
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  const line = (label: string, centavos: number) => (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular-nums">{centavos === 0 ? '₱0' : `-${formatPeso(centavos)}`}</dd>
    </div>
  )

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-[14px] text-ink-2">
        {employee.jobTitle} · {formatMonth(periodMonth)}
        {!employee.withContributions && ' · No government contributions'}
      </p>
      <Field
        label="Gross pay for the month (₱)"
        hint="Starts at the monthly rate. Change it for absences or extra work."
        inputMode="decimal"
        autoComplete="off"
        required
        value={gross}
        onChange={(event) => setGross(event.target.value)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Other deductions (₱)"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={other}
          onChange={(event) => setOther(event.target.value)}
        />
        <Field
          label="For"
          placeholder="Cash advance"
          maxLength={120}
          value={otherNote}
          onChange={(event) => setOtherNote(event.target.value)}
        />
      </div>

      {preview && grossCentavos && net !== null && (
        <dl className="divide-y divide-line rounded-control border border-line px-3.5 text-[14px]">
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">Gross</dt>
            <dd className="tabular-nums">{formatPeso(grossCentavos)}</dd>
          </div>
          {line('SSS', preview.sssEe)}
          {line('PhilHealth', preview.philhealthEe)}
          {line('Pag-IBIG', preview.pagibigEe)}
          {line('Withholding tax', preview.tax)}
          {(otherCentavos ?? 0) > 0 && line('Other', otherCentavos ?? 0)}
          <div className="flex justify-between gap-3 py-2 font-semibold">
            <dt>Take-home pay</dt>
            <dd className={`tabular-nums ${net < 0 ? 'text-bad' : ''}`}>{net < 0 ? `-${formatPeso(-net)}` : formatPeso(net)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5 text-[13px] text-ink-3">
            <dt>Gym's share of contributions</dt>
            <dd className="tabular-nums">{formatPeso(employerShare(preview))}</dd>
          </div>
        </dl>
      )}
      <p className="text-[12px] text-ink-3">
        Uses the 2026 SSS, PhilHealth, Pag-IBIG, and BIR rates. Have the gym's accountant check the first payroll.
      </p>

      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy} disabled={net === null || net < 0}>
        {entry ? 'Recalculate draft' : 'Save draft'}
      </Button>
    </form>
  )
}
