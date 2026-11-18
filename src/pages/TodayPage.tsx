import { Link, useNavigate } from 'react-router'
import { MemberRow } from '../components/MemberRow'
import { Button, Card, Loading, Notice, SectionTitle } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { formatPeso } from '../lib/format'
import { useLoad } from '../lib/useLoad'

export function TodayPage() {
  const session = useSession()
  const navigate = useNavigate()
  const summary = useLoad(() => api.todaySummary(), [])

  if (!summary.data) return summary.error ? <Notice tone="bad">{summary.error}</Notice> : <Loading />
  const { collectedCentavos, checkins, expiring } = summary.data

  return (
    <div className={`grid gap-6 transition-opacity ${summary.loading ? 'opacity-60' : ''}`}>
      <section>
        <p className="text-[13px] font-medium text-ink-2">
          {session.role === 'owner' ? 'Collected today' : 'You collected today'}
        </p>
        <p className="mt-1 text-[44px] font-medium leading-none tracking-tight">{formatPeso(collectedCentavos)}</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[13px] text-ink-3">Check-ins</p>
          <p className="mt-1 text-[26px] font-medium leading-none">{checkins}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[13px] text-ink-3">Expiring soon</p>
          <p className="mt-1 text-[26px] font-medium leading-none">{expiring.length}</p>
        </Card>
      </section>

      <Button onClick={() => navigate('/check-in')}>Check in a member</Button>

      <section>
        <SectionTitle>Renewals due within 7 days</SectionTitle>
        {expiring.length === 0 ? (
          <Card className="p-4">
            <p className="text-[14px] text-ink-2">
              No renewals due this week. <Link to="/members" className="font-medium text-ink underline">See all members</Link>
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
