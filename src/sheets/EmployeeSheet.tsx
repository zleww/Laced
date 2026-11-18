import type { FormEvent } from 'react'
import { useState } from 'react'
import { Sheet } from '../components/Sheet'
import { Button, Checkbox, Field, Notice } from '../components/ui'
import { api } from '../lib/api'
import { errorMessage, parsePeso } from '../lib/format'
import type { Employee } from '../lib/types'

type EmployeeSheetProps = {
  open: boolean
  /** Null adds a new employee. */
  employee: Employee | null
  onClose: () => void
  onSaved: () => void
}

export function EmployeeSheet({ open, employee, onClose, onSaved }: EmployeeSheetProps) {
  return (
    <Sheet open={open} title={employee ? 'Edit employee' : 'Add employee'} onClose={onClose}>
      <EmployeeForm key={employee?.id ?? 'new'} employee={employee} onSaved={onSaved} />
    </Sheet>
  )
}

function EmployeeForm({ employee, onSaved }: { employee: Employee | null; onSaved: () => void }) {
  const [fullName, setFullName] = useState(employee?.fullName ?? '')
  const [jobTitle, setJobTitle] = useState(employee?.jobTitle ?? '')
  const [rate, setRate] = useState(employee ? String(employee.monthlyRateCentavos / 100) : '')
  const [withContributions, setWithContributions] = useState(employee?.withContributions ?? true)
  const [active, setActive] = useState(employee?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const monthlyRateCentavos = parsePeso(rate)
    if (!monthlyRateCentavos) {
      setError('Enter the monthly rate as a number above zero, like 18000.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.saveEmployee({ fullName, jobTitle, monthlyRateCentavos, withContributions, active }, employee?.id)
      onSaved()
    } catch (cause) {
      setError(errorMessage(cause))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
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
        label="Position"
        placeholder="Coach"
        required
        minLength={2}
        maxLength={40}
        value={jobTitle}
        onChange={(event) => setJobTitle(event.target.value)}
      />
      <Field
        label="Monthly rate (₱)"
        inputMode="decimal"
        autoComplete="off"
        placeholder="18000"
        required
        value={rate}
        onChange={(event) => setRate(event.target.value)}
      />
      <Checkbox checked={withContributions} onChange={setWithContributions}>
        Deduct SSS, PhilHealth, and Pag-IBIG
        <span className="block text-[13px] text-ink-2">Turn off for workers the gym does not register with them.</span>
      </Checkbox>
      {employee && (
        <Checkbox checked={active} onChange={setActive}>
          Still working here
        </Checkbox>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <Button type="submit" busy={busy}>
        {employee ? 'Save changes' : 'Add employee'}
      </Button>
    </form>
  )
}
