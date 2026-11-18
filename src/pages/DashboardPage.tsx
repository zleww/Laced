import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Chart, ChartCard, type ChartPoint } from '../components/charts'
import { ArrowDownIcon, ArrowUpIcon } from '../components/icons'
import { MemberRow } from '../components/MemberRow'
import { Button, Card, Loading, Notice, SectionTitle } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { formatWeekday } from '../lib/dates'
import { formatPeso, formatPesoCompact } from '../lib/format'
import type { DayStat } from '../lib/types'
import { useLoad } from '../lib/useLoad'
import { CloseDaySheet } from '../sheets/CloseDaySheet'

const ranges = [7, 14, 30]

/** "Nov 16" from "Mon, Nov 16" */
const shortDay = (day: string) => formatWeekday(day).split(', ')[1] ?? day

export function DashboardPage() {
  const session = useSession()
  const navigate = useNavigate()
  const isOwner = session.role === 'owner'
  const [days, setDays] = useState(14)

  const [closing, setClosing] = useState(false)
  const [closedNotice, setClosedNotice] = useState(false)
  const dayClosed = useLoad(() => api.isDayClosed(), [])
  // The owner account holds the money and payroll, so it gets a reminder until two-step sign-in is on.
  const twoStep = useLoad(
    () => (isOwner && api.mode === 'live' ? api.twoStepStatus() : Promise.resolve({ on: true })),
    [isOwner],
  )

  const summary = useLoad(() => api.todaySummary(), [])
  // Staff are not shown the gym's totals, so the request is not even made for them.
  const stats = useLoad(() => (isOwner ? api.dailyStats(days) : Promise.resolve<DayStat[]>([])), [isOwner, days])

  if (!summary.data) return summary.error ? <Notice tone="bad">{summary.error}</Notice> : <Loading />
  const { collectedCentavos, checkins, expiring } = summary.data

  const history = stats.data ?? []
  const yesterday = history.length >= 2 ? history[history.length - 2] : undefined
  const revenuePoints: ChartPoint[] = history.map((item) => ({
    label: shortDay(item.day),
    longLabel: formatWeekday(item.day),
    value: item.revenueCentavos,
  }))
  const visitPoints: ChartPoint[] = history.map((item) => ({
    label: shortDay(item.day),
    longLabel: formatWeekday(item.day),
    value: item.checkins,
  }))
  const totalRevenue = history.reduce((sum, item) => sum + item.revenueCentavos, 0)
  const totalVisits = history.reduce((sum, item) => sum + item.checkins, 0)
  const busiest = history.reduce<DayStat | undefined>(
    (best, item) => (!best || item.checkins > best.checkins ? item : best),
    undefined,
  )

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Dashboard</h1>
        <div className="flex w-full gap-2 md:w-auto">
          <Button
            variant="secondary"
            className="md:w-auto md:px-5"
            disabled={dayClosed.data !== false}
            onClick={() => setClosing(true)}
          >
            {dayClosed.data ? 'Today is closed' : 'Close today'}
          </Button>
          <Button className="md:w-auto md:px-5" onClick={() => navigate('/check-in')}>
            Check in a member
          </Button>
        </div>
      </div>

      {twoStep.data?.on === false && (
        <p className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-warn/40 bg-warn-bg px-3.5 py-3 text-[14px] text-warn">
          <span>Protect the owner account: turn on two-step sign-in.</span>
          <Link to="/settings" className="font-semibold underline underline-offset-4">
            Set it up
          </Link>
        </p>
      )}

      {closedNotice && (
        <Notice tone="good">
          Today is closed. {isOwner ? 'See the comparison under Money.' : 'The owner can see the comparison.'}
        </Notice>
      )}
      {dayClosed.error && <Notice tone="bad">{dayClosed.error}</Notice>}

      <section className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${summary.loading ? 'opacity-60' : ''}`}>
        <StatCard
          wide
          label={isOwner ? 'Collected today' : 'You collected today'}
          value={formatPeso(collectedCentavos)}
          note={
            yesterday && (
              <Delta
                change={collectedCentavos - yesterday.revenueCentavos}
                text={formatPeso(Math.abs(collectedCentavos - yesterday.revenueCentavos))}
              />
            )
          }
        />
        <StatCard
          label="Check-ins today"
          value={String(checkins)}
          note={
            yesterday && (
              <Delta change={checkins - yesterday.checkins} text={String(Math.abs(checkins - yesterday.checkins))} />
            )
          }
        />
        <StatCard label="Expiring soon" value={String(expiring.length)} note="Within 7 days" />
      </section>

      {isOwner && (
        <>
          {/* One range filter scopes both charts below it. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-medium text-ink-2">Trends</h2>
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

          {stats.error ? (
            <Notice tone="bad">{stats.error}</Notice>
          ) : !stats.data ? (
            <Loading />
          ) : (
            <div className={`grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] ${stats.loading ? 'opacity-60' : ''}`}>
              <ChartCard
                title="Revenue"
                figure={formatPeso(totalRevenue)}
                caption={`Last ${days} days, voided payments left out`}
                points={revenuePoints}
                format={formatPeso}
                valueHeading="Collected"
              >
                <Chart
                  kind="area"
                  points={revenuePoints}
                  format={formatPeso}
                  formatTick={formatPesoCompact}
                  summary={`Revenue per day for the last ${days} days. Total ${formatPeso(totalRevenue)}.`}
                />
              </ChartCard>

              <ChartCard
                title="Check-ins"
                figure={String(totalVisits)}
                caption={
                  busiest && busiest.checkins > 0
                    ? `Busiest: ${formatWeekday(busiest.day)} with ${busiest.checkins}`
                    : `Last ${days} days`
                }
                points={visitPoints}
                format={String}
                valueHeading="Visits"
              >
                <Chart
                  kind="bars"
                  points={visitPoints}
                  format={(value) => `${value} ${value === 1 ? 'visit' : 'visits'}`}
                  formatTick={String}
                  summary={`Check-ins per day for the last ${days} days. Total ${totalVisits}.`}
                />
              </ChartCard>
            </div>
          )}
        </>
      )}

      <CloseDaySheet
        open={closing}
        onClose={() => setClosing(false)}
        onClosed={() => {
          setClosing(false)
          setClosedNotice(true)
          dayClosed.reload()
        }}
      />

      <section>
        <SectionTitle>Renewals due within 7 days</SectionTitle>
        {expiring.length === 0 ? (
          <Card className="p-4">
            <p className="text-[14px] text-ink-2">
              No renewals due this week.{' '}
              <Link to="/members" className="font-medium text-ink underline underline-offset-4">
                See all members
              </Link>
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {expiring.map((member) => (
              <MemberRow key={member.id} member={member} onSelect={() => navigate(`/members/${member.id}`)} />
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, note, wide }: { label: string; value: string; note?: ReactNode; wide?: boolean }) {
  return (
    <div className={`sheen rounded-card border border-line bg-card p-4 ${wide ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 min-h-4 text-[12px] text-ink-3">{note}</p>
    </div>
  )
}

/** Change against yesterday. Direction is shown by an arrow and a word, not by color alone. */
function Delta({ change, text }: { change: number; text: string }) {
  if (change === 0) return <>Same as yesterday</>
  const up = change > 0
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-0.5 font-medium ${up ? 'text-good' : 'text-bad'}`}>
        {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
        {text}
      </span>
      {up ? 'more' : 'less'} than yesterday
    </span>
  )
}
