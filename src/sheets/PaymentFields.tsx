import { Checkbox, Field } from '../components/ui'
import { formatPeso } from '../lib/format'
import type { PaymentMethod, Plan } from '../lib/types'

// Form parts shared by "Sell plan" and "Day pass".

export type PaymentState = { method: PaymentMethod; gcashRef: string; studentIdChecked: boolean }

export const emptyPayment: PaymentState = { method: 'cash', gcashRef: '', studentIdChecked: false }

type PlanPickerProps = { plans: Plan[]; selectedId: string; onSelect: (id: string) => void }

/** The price is shown but can't be edited: it comes from the plans table. */
export function PlanPicker({ plans, selectedId, onSelect }: PlanPickerProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Plan</legend>
      <div className="divide-y divide-line overflow-hidden rounded-control border border-line bg-card">
        {plans.map((plan) => (
          <label key={plan.id} className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2.5">
            <input
              type="radio"
              name="plan"
              checked={plan.id === selectedId}
              onChange={() => onSelect(plan.id)}
              className="size-5 flex-none accent-(--ink)"
            />
            <span className="flex-1 text-[15px]">{plan.name}</span>
            <span className="text-[15px] font-medium tabular-nums">{formatPeso(plan.priceCentavos)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

type PaymentFieldsProps = { plan: Plan | undefined; value: PaymentState; onChange: (value: PaymentState) => void }

export function PaymentFields({ plan, value, onChange }: PaymentFieldsProps) {
  const methods: Array<[PaymentMethod, string]> = [
    ['cash', 'Cash'],
    ['gcash', 'GCash'],
  ]
  return (
    <>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Paid with</legend>
        <div className="grid grid-cols-2 gap-2">
          {methods.map(([method, label]) => {
            const selected = value.method === method
            return (
              <label
                key={method}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-control border text-[15px] font-medium ${
                  selected ? 'border-ink bg-ink text-bg' : 'border-line bg-card text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  className="sr-only"
                  checked={selected}
                  onChange={() => onChange({ ...value, method })}
                />
                {label}
              </label>
            )
          })}
        </div>
      </fieldset>

      {value.method === 'gcash' && (
        <Field
          label="GCash reference number"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1002345678901"
          value={value.gcashRef}
          onChange={(event) => onChange({ ...value, gcashRef: event.target.value })}
        />
      )}

      {plan?.category === 'student' && (
        <Checkbox
          checked={value.studentIdChecked}
          onChange={(studentIdChecked) => onChange({ ...value, studentIdChecked })}
        >
          School ID checked
        </Checkbox>
      )}
    </>
  )
}
