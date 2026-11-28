import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ReasonSheet } from '../sheets/ReasonSheet'
import { AppAccessPanel } from '../components/AppAccessPanel'
import { ChevronLeftIcon } from '../components/icons'
import { MemberActions } from '../components/MemberActions'
import { Avatar } from '../components/MemberRow'
import { Card, Loading, Notice, SectionTitle } from '../components/ui'
import { api } from '../lib/api'
import { useSession } from '../lib/auth'
import { formatDate, formatTime, manilaToday } from '../lib/dates'
import type { MembershipRecord } from '../lib/types'
import { useLoad } from '../lib/useLoad'

const kindLabels: Record<MembershipRecord['kind'], string> = {
  new: 'New',
  renewal: 'Renewal',
  returning: 'Returning',
  day_pass: 'Day pass',
}

export function MemberPage() {
  const { id = '' } = useParams()
  const session = useSession()
  const detail = useLoad(() => api.getMember(id), [id])
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)

  const back = (
    <Link to="/members" className="-ml-1 inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-ink-2">
      <ChevronLeftIcon />
      Members
    </Link>
  )

  if (!detail.data) {
    return (
      <div className="grid gap-3">
        {back}
        {detail.error ? <Notice tone="bad">{detail.error}</Notice> : <Loading />}
      </div>
    )
  }

  const { member, memberships, visits, hasAppAccount } = detail.data
  const today = manilaToday()

  return (
    <div className="grid gap-5">
      {back}

      <div className="flex items-center gap-3">
        <Avatar name={member.fullName} large />
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight">{member.fullName}</h1>
          <p className="text-[14px] tabular-nums text-ink-2">
            {member.phone} · No. {member.memberNo}
          </p>
        </div>
      </div>

      <MemberActions member={member} onChanged={detail.reload} />

      <section>
        <SectionTitle>Memberships</SectionTitle>
        {memberships.length === 0 ? (
          <Card className="p-4">
            <p className="text-[14px] text-ink-2">No plan yet. Sell one to start their membership.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {memberships.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">{item.planName}</p>
                  <p className="text-[13px] tabular-nums text-ink-3">
                    {item.startDate === item.endDate
                      ? formatDate(item.startDate)
                      : `${formatDate(item.startDate)} to ${formatDate(item.endDate)}`}
                  </p>
                </div>
                <span className="text-[13px] text-ink-3">
                  {item.startDate > today ? 'Starts later' : kindLabels[item.kind]}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>{session.role === 'owner' ? 'Recent visits' : 'Visits today'}</SectionTitle>
        <Card className={visits.length === 0 ? 'p-4' : 'divide-y divide-line'}>
          {visits.length === 0 ? (
            <p className="text-[14px] text-ink-2">
              {session.role === 'owner' ? 'No visits recorded yet.' : 'Not checked in today.'}
            </p>
          ) : (
            visits.map((visit) => (
              <p key={visit.id} className="flex justify-between px-4 py-3 text-[14px] tabular-nums">
                <span>{formatDate(manilaToday(new Date(visit.checkedInAt)))}</span>
                <span className="text-ink-3">{formatTime(visit.checkedInAt)}</span>
              </p>
            ))
          )}
        </Card>
      </section>

      <AppAccessPanel member={member} hasAccount={hasAppAccount} />

      {session.role === 'owner' && (
        <section>
          <SectionTitle>Member's data</SectionTitle>
          <Card className="grid gap-3 p-4">
            <p className="text-[14px] text-ink-2">
              If {member.fullName} asks for their data to be deleted, this removes their name and phone number. Their
              payments and visits stay as "Deleted member" so the gym's records still add up.
            </p>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="min-h-11 w-fit rounded-control border border-line px-4 text-[14px] font-medium text-bad hover:border-bad"
            >
              Delete member's data
            </button>
          </Card>
        </section>
      )}

      <ReasonSheet
        open={deleting}
        title="Delete member's data"
        subject={`${member.fullName}'s name and phone number will be erased for good. This can't be undone.`}
        confirmLabel="Delete their data"
        hint="For example: Member asked. The reason is kept in the activity log."
        onClose={() => setDeleting(false)}
        onConfirm={async (reason) => {
          await api.deleteMemberData(member.id, reason)
          navigate('/members', { replace: true })
        }}
      />
    </div>
  )
}
