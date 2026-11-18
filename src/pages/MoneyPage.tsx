import { useState } from 'react'
import { Navigate } from 'react-router'
import { PlusIcon } from '../components/icons'
import { Bar, Empty, Panel, Stat, smallButton } from '../components/panels'
import { Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatDate, formatTime, formatWeekday, manilaToday } from '../lib/dates'
import { formatDifference, formatPeso } from '../lib/format'
import type { ExpenseRecord, PaymentRecord } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { ExpenseSheet } from '../sheets/ExpenseSheet'
import { ReasonSheet } from '../sheets/ReasonSheet'

const ranges = [7, 14, 30]

// The owner's money screen. Everything here comes from owner-only database
// functions and tables; a staff account that lands here is sent back.
export function MoneyPage() {
  const session = useSession()
  const [days, setDays] = useState(14)
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [voidingPayment, setVoidingPayment] = useState<PaymentRecord | null>(null)
  const [voidingExpense, setVoidingExpense] = useState<ExpenseRecord | null>(null)
  const [addingExpense, setAddingExpense] = useState(false)

  const isOwner = session.role === 'owner'
  // Every panel reads the same range, so the numbers always agree.
  const data = useLoad(
    async () => {
      if (!isOwner) return null
      const [summary, plans, payments, expenses, closes] = await Promise.all([
        api.moneySummary(days),
        api.planRevenue(days),
        api.listPayments(days),
        api.listExpenses(days),
        api.listCloses(),
      ])
      return { summary, plans, payments, expenses, closes }
    },
    [isOwner, days, version],
  )

  if (!isOwner) return <Navigate to="/" replace />

  function changed(message: string) {
    setVoidingPayment(null)
    setVoidingExpense(null)
    setAddingExpense(false)
    setNotice(message)
    setVersion((value) => value + 1)
  }

  function exportPayments(payments: PaymentRecord[]) {
    const csv = toCsv(
      ['Date', 'Time', 'Paid by', 'Plan', 'Amount (PHP)', 'Method', 'GCash reference', 'Received by', 'Voided', 'Void reason'],
      payments.map((item) => [
        manilaToday(new Date(item.paidAt)),
        formatTime(item.paidAt),
        item.payer,
        item.planName,
        (item.amountCentavos / 100).toFixed(2),
        item.method,
        item.gcashRef ?? '',
        item.receivedBy,
        item.voidedAt ? 'yes' : 'no',
        item.voidReason ?? '',
      ]),
    )
    downloadCsv(`laced-payments-${manilaToday()}.csv`, csv)
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[22px] font-semibold tracking-tight">Money</h1>
      <div role="group" aria-label="Date range" className="flex gap-1 rounded-full border border-line bg-card p-1">
        {ranges.map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={days === range}
            onClick={() => setDays(range)}
            className={`min-h-8 rounded-full px-3 text-[12px] font-medium ${
              days === range ? 'bg-accent text-on-accent' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {range} days
          </button>
        ))}
      </div>
    </div>
  )

  if (!data.data) {
    return (
      <div className="grid grid-cols-1 gap-5">
        {header}
        {data.error ? <Notice tone="bad">{data.error}</Notice> : <Loading />}
      </div>
    )
  }

  const { summary, plans, payments, expenses, closes } = data.data
  const net = summary.revenueCentavos - summary.expensesCentavos
  const topPlan = Math.max(...plans.map((plan) => plan.revenueCentavos), 1)
  const paidTotal = Math.max(summary.cashCentavos + summary.gcashCentavos, 1)

  return (
    <div className={`grid grid-cols-1 gap-5 ${data.loading ? 'opacity-60' : ''}`}>
      {header}
      {notice && <Notice tone="good">{notice}</Notice>}
      {data.error && <Notice tone="bad">{data.error}</Notice>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat wide label="Revenue" value={formatPeso(summary.revenueCentavos)} note={`Last ${days} days`} />
        <Stat label="Expenses" value={formatPeso(summary.expensesCentavos)} note={`${expenses.filter((item) => !item.voidedAt).length} recorded`} />
        <Stat
          label="Net"
          value={(net < 0 ? '-' : '') + formatPeso(Math.abs(net))}
          note={net < 0 ? 'Spent more than collected' : 'Revenue minus expenses'}
        />
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Revenue by plan">
          {plans.length === 0 ? (
            <Empty>No sales in this range yet.</Empty>
          ) : (
            <ul className="grid gap-3">
              {plans.map((plan) => (
                <li key={plan.planName}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate">{plan.planName}</span>
                    <span className="flex-none tabular-nums">
                      <span className="font-medium">{formatPeso(plan.revenueCentavos)}</span>
                      <span className="text-ink-3"> · {plan.sales} sold</span>
                    </span>
                  </div>
                  <Bar share={plan.revenueCentavos / topPlan} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Paid with">
          <ul className="grid gap-3">
            {(
              [
                ['Cash', summary.cashCentavos],
                ['GCash', summary.gcashCentavos],
              ] as const
            ).map(([label, amount]) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span>{label}</span>
                  <span className="font-medium tabular-nums">{formatPeso(amount)}</span>
                </div>
                <Bar share={amount / paidTotal} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-ink-3">
            {summary.voidCount === 0
              ? 'No voided payments in this range.'
              : `${summary.voidCount} voided ${summary.voidCount === 1 ? 'payment' : 'payments'} left out.`}
          </p>
        </Panel>
      </div>

      <Panel
        title="Payments"
        action={
          payments.length > 0 && (
            <button type="button" className={smallButton} onClick={() => exportPayments(payments)}>
              Export CSV
            </button>
          )
        }
      >
        {payments.length === 0 ? (
          <Empty>No payments in this range yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14px] font-medium ${item.voidedAt ? 'text-ink-3 line-through' : ''}`}>
                    {item.payer}
                  </p>
                  <p className="truncate text-[12px] text-ink-3">
                    {item.planName} · {item.method === 'gcash' ? `GCash ${item.gcashRef}` : 'Cash'} · {item.receivedBy}
                  </p>
                  <p className="text-[12px] text-ink-3">
                    {formatWeekday(manilaToday(new Date(item.paidAt)))}, {formatTime(item.paidAt)}
                  </p>
                  {item.voidedAt && <p className="mt-0.5 text-[12px] text-bad">Voided: {item.voidReason}</p>}
                </div>
                <p className={`flex-none text-[14px] font-medium tabular-nums ${item.voidedAt ? 'text-ink-3 line-through' : ''}`}>
                  {formatPeso(item.amountCentavos)}
                </p>
                {!item.voidedAt && (
                  <button type="button" className={smallButton} onClick={() => setVoidingPayment(item)}>
                    Void
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel
          title="Expenses"
          action={
            <button type="button" className={smallButton} onClick={() => setAddingExpense(true)}>
              <PlusIcon />
              Add
            </button>
          }
        >
          {expenses.length === 0 ? (
            <Empty>No expenses recorded in this range. Add rent, electricity, or salaries to see the net.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {expenses.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[14px] font-medium ${item.voidedAt ? 'text-ink-3 line-through' : ''}`}>
                      {item.category}
                    </p>
                    <p className="truncate text-[12px] text-ink-3">
                      {formatDate(item.spentOn)}
                      {item.note ? ` · ${item.note}` : ''}
                      {item.voidedAt ? ' · Voided' : ''}
                    </p>
                  </div>
                  <p className={`flex-none text-[14px] font-medium tabular-nums ${item.voidedAt ? 'text-ink-3 line-through' : ''}`}>
                    {formatPeso(item.amountCentavos)}
                  </p>
                  {!item.voidedAt && (
                    <button type="button" className={smallButton} onClick={() => setVoidingExpense(item)}>
                      Void
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Day closes">
          {closes.length === 0 ? (
            <Empty>No day has been closed yet. The desk closes the day from the Dashboard.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {closes.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[14px] font-medium">{formatDate(item.closeDate)}</p>
                    <p className="text-[12px] text-ink-3">{item.closedBy}</p>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-2 gap-3 text-[12px]">
                    <Difference label="Cash" counted={item.countedCashCentavos} expected={item.expectedCashCentavos} />
                    <Difference label="GCash" counted={item.countedGcashCentavos} expected={item.expectedGcashCentavos} />
                  </dl>
                  {item.note && <p className="mt-1.5 text-[12px] text-ink-2">Note: {item.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ReasonSheet
        open={voidingPayment !== null}
        title="Void payment"
        subject={
          voidingPayment
            ? `${formatPeso(voidingPayment.amountCentavos)} from ${voidingPayment.payer} for ${voidingPayment.planName}. Their membership from this payment is cancelled too.`
            : ''
        }
        confirmLabel="Void payment"
        onClose={() => setVoidingPayment(null)}
        onConfirm={async (reason) => {
          await api.voidPayment(voidingPayment!.id, reason)
          changed('Payment voided.')
        }}
      />
      <ReasonSheet
        open={voidingExpense !== null}
        title="Void expense"
        subject={voidingExpense ? `${formatPeso(voidingExpense.amountCentavos)} for ${voidingExpense.category}.` : ''}
        confirmLabel="Void expense"
        onClose={() => setVoidingExpense(null)}
        onConfirm={async (reason) => {
          await api.voidExpense(voidingExpense!.id, reason)
          changed('Expense voided.')
        }}
      />
      <ExpenseSheet open={addingExpense} onClose={() => setAddingExpense(false)} onAdded={() => changed('Expense added.')} />
    </div>
  )
}

/** Counted against expected. The sign and the word carry the meaning, not only the color. */
function Difference({ label, counted, expected }: { label: string; counted: number; expected: number }) {
  const difference = counted - expected
  return (
    <div>
      <dt className="text-ink-3">
        {label}: counted {formatPeso(counted)}, expected {formatPeso(expected)}
      </dt>
      <dd className={`font-medium tabular-nums ${difference === 0 ? 'text-good' : 'text-bad'}`}>
        {formatDifference(difference)}
        {difference !== 0 && (difference > 0 ? ' over' : ' short')}
      </dd>
    </div>
  )
}
