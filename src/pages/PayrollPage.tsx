import { useState } from 'react'
import { Navigate } from 'react-router'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, PlusIcon } from '../components/icons'
import { Empty, PageHeader, Panel, Stat, smallButton } from '../components/panels'
import { Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { addMonths, formatMonth, thisMonth } from '../lib/dates'
import { errorMessage, formatPeso } from '../lib/format'
import { employerShare } from '../lib/payroll'
import type { Employee, PayrollEntry } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { EmployeeSheet } from '../sheets/EmployeeSheet'
import { PayrollSheet } from '../sheets/PayrollSheet'
import { ReasonSheet } from '../sheets/ReasonSheet'

// Owner only. Employees, and one payroll entry per employee per month:
// draft first, then marked paid. A paid entry is voided, never edited.
export function PayrollPage() {
  const session = useSession()
  const isOwner = session.role === 'owner'
  const [month, setMonth] = useState(thisMonth())
  const [version, setVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingEmployee, setEditingEmployee] = useState<Employee | 'new' | null>(null)
  const [paying, setPaying] = useState<Employee | null>(null)
  const [voiding, setVoiding] = useState<PayrollEntry | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const data = useLoad(
    async () => {
      if (!isOwner) return null
      const [employees, entries] = await Promise.all([api.listEmployees(), api.listPayroll(month)])
      return { employees, entries }
    },
    [isOwner, month, version],
  )

  if (!isOwner) return <Navigate to="/" replace />

  function changed(message: string) {
    setEditingEmployee(null)
    setPaying(null)
    setVoiding(null)
    setActionError(null)
    setNotice(message)
    setVersion((value) => value + 1)
  }

  async function markPaid(entry: PayrollEntry) {
    setBusyId(entry.id)
    setActionError(null)
    try {
      await api.markPayrollPaid(entry.id)
      changed(`${entry.employeeName} marked as paid.`)
    } catch (cause) {
      setActionError(errorMessage(cause))
    } finally {
      setBusyId(null)
    }
  }

  const monthNav = (
    <div className="flex items-center gap-1 print:hidden">
      <button type="button" aria-label="Previous month" className={smallButton} onClick={() => setMonth(addMonths(month, -1))}>
        <ChevronLeftIcon />
      </button>
      <p className="min-w-36 text-center text-[14px] font-medium">{formatMonth(month)}</p>
      <button
        type="button"
        aria-label="Next month"
        className={smallButton}
        disabled={month >= thisMonth()}
        onClick={() => setMonth(addMonths(month, 1))}
      >
        <ChevronRightIcon />
      </button>
    </div>
  )

  if (!data.data) {
    return (
      <div className="grid grid-cols-1 gap-5">
        <PageHeader title="Payroll" fromMore>{monthNav}</PageHeader>
        {data.error ? <Notice tone="bad">{data.error}</Notice> : <Loading />}
      </div>
    )
  }

  const { employees, entries } = data.data
  const entryFor = new Map(entries.map((entry) => [entry.employeeId, entry]))
  // Everyone still working here, plus anyone who left but was paid this month.
  const rows = employees.filter((employee) => employee.active || entryFor.has(employee.id))
  const takeHome = entries.reduce((sum, entry) => sum + entry.netCentavos, 0)
  const gymCost = entries.reduce((sum, entry) => sum + entry.grossCentavos + employerShare(entry.deductions), 0)
  const paidCount = entries.filter((entry) => entry.status === 'paid').length
  const payingEntry = paying ? (entryFor.get(paying.id) ?? null) : null

  return (
    <div className={`grid grid-cols-1 gap-5 ${data.loading ? 'opacity-60' : ''}`}>
      <PageHeader title="Payroll" fromMore>
        <div className="flex flex-wrap items-center gap-2">
          {monthNav}
          <button type="button" className={`${smallButton} print:hidden`} onClick={() => window.print()} disabled={entries.length === 0}>
            Print register
          </button>
        </div>
      </PageHeader>
      <p className="hidden text-[14px] print:block">Payroll register, {formatMonth(month)}</p>

      {notice && <Notice tone="good">{notice}</Notice>}
      {(data.error || actionError) && <Notice tone="bad">{data.error ?? actionError}</Notice>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
        <Stat label="Employees" value={String(employees.filter((employee) => employee.active).length)} note="Still working here" />
        <Stat label="Take-home pay" value={formatPeso(takeHome)} note={`${entries.length} computed`} />
        <Stat label="Cost to the gym" value={formatPeso(gymCost)} note="Gross plus the gym's contributions" />
        <Stat label="Paid" value={`${paidCount} of ${rows.length}`} note={paidCount === rows.length && rows.length > 0 ? 'Everyone is paid' : 'Mark each one when paid'} />
      </section>

      <Panel title={`Payroll register, ${formatMonth(month)}`}>
        {rows.length === 0 ? (
          <Empty>No employees yet. Add the people the gym pays below.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="text-left text-ink-3">
                <tr>
                  <th className="py-2 pr-3 font-medium">Employee</th>
                  <th className="py-2 pr-3 text-right font-medium">Gross</th>
                  <th className="py-2 pr-3 text-right font-medium">SSS</th>
                  <th className="py-2 pr-3 text-right font-medium">PhilHealth</th>
                  <th className="py-2 pr-3 text-right font-medium">Pag-IBIG</th>
                  <th className="py-2 pr-3 text-right font-medium">Tax</th>
                  <th className="py-2 pr-3 text-right font-medium">Other</th>
                  <th className="py-2 pr-3 text-right font-medium">Net</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium print:hidden">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {rows.map((employee) => {
                  const entry = entryFor.get(employee.id)
                  const cell = (centavos: number | undefined) => (
                    <td className="py-2.5 pr-3 text-right">{entry ? formatPeso(centavos ?? 0) : '—'}</td>
                  )
                  return (
                    <tr key={employee.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{employee.fullName}</p>
                        <p className="text-[12px] text-ink-3">{employee.jobTitle}</p>
                      </td>
                      {cell(entry?.grossCentavos)}
                      {cell(entry?.deductions.sssEe)}
                      {cell(entry?.deductions.philhealthEe)}
                      {cell(entry?.deductions.pagibigEe)}
                      {cell(entry?.deductions.tax)}
                      {cell(entry?.otherCentavos)}
                      <td className="py-2.5 pr-3 text-right font-semibold">{entry ? formatPeso(entry.netCentavos) : '—'}</td>
                      <td className="py-2.5 pr-3">
                        {!entry ? (
                          <span className="text-ink-3">Not computed</span>
                        ) : entry.status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-[12px] font-medium text-good">
                            <CheckIcon /> Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[12px] font-medium text-warn">
                            <ClockIcon /> Draft
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 print:hidden">
                        <div className="flex justify-end gap-1.5">
                          {!entry && employee.active && (
                            <button type="button" className={smallButton} onClick={() => setPaying(employee)}>
                              Compute pay
                            </button>
                          )}
                          {entry?.status === 'draft' && (
                            <>
                              <button type="button" className={smallButton} onClick={() => setPaying(employee)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                className={smallButton}
                                disabled={busyId === entry.id}
                                onClick={() => markPaid(entry)}
                              >
                                {busyId === entry.id ? 'Saving…' : 'Mark paid'}
                              </button>
                            </>
                          )}
                          {entry && (
                            <button type="button" className={smallButton} onClick={() => setVoiding(entry)}>
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {entries.length > 0 && (
                <tfoot className="border-t border-line font-semibold tabular-nums">
                  <tr>
                    <td className="py-2.5 pr-3">Total</td>
                    <td className="py-2.5 pr-3 text-right">{formatPeso(entries.reduce((sum, entry) => sum + entry.grossCentavos, 0))}</td>
                    <td colSpan={5} />
                    <td className="py-2.5 pr-3 text-right">{formatPeso(takeHome)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Panel>

      <div className="print:hidden">
        <Panel
          title="Employees"
          action={
            <button type="button" className={smallButton} onClick={() => setEditingEmployee('new')}>
              <PlusIcon />
              Add
            </button>
          }
        >
          {employees.length === 0 ? (
            <Empty>Add the gym's staff, coaches, and cleaners. They don't need a login.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {employees.map((employee) => (
                <li key={employee.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[14px] font-medium ${employee.active ? '' : 'text-ink-3'}`}>{employee.fullName}</p>
                    <p className="truncate text-[12px] text-ink-3">
                      {employee.jobTitle} · {formatPeso(employee.monthlyRateCentavos)} a month
                      {!employee.withContributions && ' · No contributions'}
                      {!employee.active && ' · No longer working here'}
                    </p>
                  </div>
                  <button type="button" className={smallButton} onClick={() => setEditingEmployee(employee)}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <EmployeeSheet
        open={editingEmployee !== null}
        employee={editingEmployee === 'new' ? null : editingEmployee}
        onClose={() => setEditingEmployee(null)}
        onSaved={() => changed(editingEmployee === 'new' ? 'Employee added.' : 'Employee saved.')}
      />
      <PayrollSheet
        open={paying !== null}
        employee={paying}
        periodMonth={month}
        entry={payingEntry}
        onClose={() => setPaying(null)}
        onSaved={() => changed(`Pay for ${paying?.fullName} saved as a draft.`)}
      />
      <ReasonSheet
        open={voiding !== null}
        title="Void payroll entry"
        subject={
          voiding
            ? `${formatPeso(voiding.netCentavos)} take-home pay for ${voiding.employeeName}, ${formatMonth(voiding.periodMonth)}. You can compute it again after.`
            : ''
        }
        confirmLabel="Void entry"
        onClose={() => setVoiding(null)}
        onConfirm={async (reason) => {
          await api.voidPayroll(voiding!.id, reason)
          changed('Payroll entry voided.')
        }}
      />
    </div>
  )
}
