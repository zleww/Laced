import { useState } from 'react'
import { Navigate } from 'react-router'
import { Chart, ChartCard, type ChartPoint } from '../components/charts'
import { Empty, PageHeader, Panel, Pills, Stat, signed, smallButton } from '../components/panels'
import { Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { formatMonth } from '../lib/dates'
import { exportTableCsv } from '../lib/exports'
import { errorMessage, formatPeso, formatPesoCompact } from '../lib/format'
import type { ExportTable } from '../lib/types'
import { useLoad } from '../lib/useLoad'

const ranges = [
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
]

const exportsList: Array<{ table: ExportTable; label: string }> = [
  { table: 'members', label: 'Members' },
  { table: 'payments', label: 'Payments' },
  { table: 'memberships', label: 'Memberships' },
  { table: 'checkins', label: 'Check-ins' },
  { table: 'expenses', label: 'Expenses' },
  { table: 'payroll_entries', label: 'Payroll' },
]

// Owner only. Month by month: what came in, what went out, and how busy it was.
export function ReportsPage() {
  const session = useSession()
  const isOwner = session.role === 'owner'
  const [months, setMonths] = useState(12)
  const [exporting, setExporting] = useState<ExportTable | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const report = useLoad(() => (isOwner ? api.monthlyReport(months) : Promise.resolve(null)), [isOwner, months])

  if (!isOwner) return <Navigate to="/" replace />

  async function runExport(table: ExportTable, label: string) {
    setExporting(table)
    setMessage(null)
    try {
      const count = await exportTableCsv(table)
      setMessage({ tone: 'good', text: `${label}: ${count} ${count === 1 ? 'row' : 'rows'} downloaded.` })
    } catch (cause) {
      setMessage({ tone: 'bad', text: errorMessage(cause) })
    } finally {
      setExporting(null)
    }
  }

  const header = (
    <PageHeader title="Reports" fromMore>
      <Pills label="Range" options={ranges} value={months} onChange={setMonths} />
    </PageHeader>
  )

  if (!report.data) {
    return (
      <div className="grid grid-cols-1 gap-5">
        {header}
        {report.error ? <Notice tone="bad">{report.error}</Notice> : <Loading />}
      </div>
    )
  }

  const rows = report.data
  const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0)
  const revenue = sum((row) => row.revenueCentavos)
  const spent = sum((row) => row.expensesCentavos + row.payrollCentavos)
  const visits = sum((row) => row.checkins)
  const best = [...rows].sort((a, b) => b.revenueCentavos - a.revenueCentavos)[0]
  const points: ChartPoint[] = rows.map((row) => ({
    label: formatMonth(row.month, true).slice(0, 3),
    longLabel: formatMonth(row.month),
    value: row.revenueCentavos,
  }))

  return (
    <div className={`grid grid-cols-1 gap-5 ${report.loading ? 'opacity-60' : ''}`}>
      {header}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue" value={formatPeso(revenue)} note={`Last ${months} months`} />
        <Stat label="Expenses and payroll" value={formatPeso(spent)} note="Payroll counts paid entries" />
        <Stat label="Net" value={signed(formatPeso, revenue - spent)} note="Revenue minus spending" />
        <Stat label="Check-ins" value={visits.toLocaleString('en-PH')} note={`${sum((row) => row.newMembers)} new members`} />
      </section>

      <ChartCard
        title="Revenue by month"
        figure={formatPeso(revenue)}
        caption={best && best.revenueCentavos > 0 ? `Best month: ${formatMonth(best.month)}` : `Last ${months} months`}
        points={points}
        format={formatPeso}
        valueHeading="Revenue"
        labelHeading="Month"
      >
        <Chart
          kind="bars"
          points={points}
          format={formatPeso}
          formatTick={formatPesoCompact}
          summary={`Revenue per month for the last ${months} months. Total ${formatPeso(revenue)}.`}
        />
      </ChartCard>

      <Panel title="Month by month">
        {rows.length === 0 ? (
          <Empty>No data yet.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-5 md:px-5">
            <table className="w-full min-w-[560px] text-[13px] tabular-nums">
              <thead className="text-left text-ink-3">
                <tr>
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 text-right font-medium">Revenue</th>
                  <th className="py-2 pr-3 text-right font-medium">Expenses</th>
                  <th className="py-2 pr-3 text-right font-medium">Payroll</th>
                  <th className="py-2 pr-3 text-right font-medium">Net</th>
                  <th className="py-2 pr-3 text-right font-medium">Check-ins</th>
                  <th className="py-2 text-right font-medium">New members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...rows].reverse().map((row) => {
                  const net = row.revenueCentavos - row.expensesCentavos - row.payrollCentavos
                  return (
                    <tr key={row.month}>
                      <td className="py-2 pr-3">{formatMonth(row.month)}</td>
                      <td className="py-2 pr-3 text-right">{formatPeso(row.revenueCentavos)}</td>
                      <td className="py-2 pr-3 text-right">{formatPeso(row.expensesCentavos)}</td>
                      <td className="py-2 pr-3 text-right">{formatPeso(row.payrollCentavos)}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${net < 0 ? 'text-bad' : ''}`}>{signed(formatPeso, net)}</td>
                      <td className="py-2 pr-3 text-right">{row.checkins}</td>
                      <td className="py-2 text-right">{row.newMembers}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Download for a spreadsheet">
        <p className="mb-3 text-[13px] text-ink-2">
          CSV files open in Excel or Google Sheets. Amounts are in centavos (₱950 is 95000). These files hold members'
          names and phone numbers, so keep them private.
        </p>
        {message && (
          <div className="mb-3">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {exportsList.map(({ table, label }) => (
            <button
              key={table}
              type="button"
              className={smallButton}
              disabled={exporting !== null}
              onClick={() => runExport(table, label)}
            >
              {exporting === table ? 'Preparing…' : label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  )
}
