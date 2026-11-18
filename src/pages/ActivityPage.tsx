import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { Empty, PageHeader, Panel, Pills, smallButton } from '../components/panels'
import { Loading, Notice } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { formatDateTime } from '../lib/dates'
import { errorMessage, formatPeso } from '../lib/format'
import type { ActivityItem, ActivityKind } from '../lib/types'

const PAGE = 50

const filters: Array<{ value: ActivityKind | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'sale', label: 'Sales' },
  { value: 'void', label: 'Voids' },
  { value: 'checkin', label: 'Check-ins' },
  { value: 'member', label: 'Members' },
  { value: 'expense', label: 'Expenses' },
  { value: 'close', label: 'Day closes' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'settings', label: 'Settings' },
]

const kindLabel: Record<ActivityKind, string> = {
  sale: 'Sale',
  void: 'Void',
  checkin: 'Check-in',
  member: 'New member',
  expense: 'Expense',
  close: 'Day close',
  payroll: 'Payroll',
  settings: 'Settings',
}

// Owner only. Who did what, newest first, built by the database from the records themselves.
export function ActivityPage() {
  const session = useSession()
  const isOwner = session.role === 'owner'
  const [kind, setKind] = useState<ActivityKind | 'all'>('all')
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(before?: string) {
    setLoading(true)
    setError(null)
    try {
      const page = await api.activity({ limit: PAGE, before, kind: kind === 'all' ? undefined : kind })
      setItems((current) => (before ? [...current, ...page] : page))
      setHasMore(page.length === PAGE)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOwner) return
    setItems([])
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, kind])

  if (!isOwner) return <Navigate to="/" replace />

  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="Activity" />
      <Pills label="Show" options={filters} value={kind} onChange={setKind} />
      {error && <Notice tone="bad">{error}</Notice>}

      <Panel title="What happened, newest first">
        {items.length === 0 ? (
          loading ? <Loading /> : <Empty>Nothing recorded here yet.</Empty>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {items.map((item, index) => (
                <li key={`${item.at}-${index}`} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] break-words">{item.summary}</p>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {kindLabel[item.kind]} · {item.actor} · {formatDateTime(item.at)}
                    </p>
                  </div>
                  {item.amountCentavos !== null && (
                    <p className="flex-none text-[14px] font-medium tabular-nums">{formatPeso(item.amountCentavos)}</p>
                  )}
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  className={smallButton}
                  disabled={loading}
                  onClick={() => load(items[items.length - 1].at)}
                >
                  {loading ? 'Loading…' : 'Show older'}
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
