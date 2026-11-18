import type { ReactNode } from 'react'
import { formatDate } from '../lib/dates'
import type { Member, MemberStatus } from '../lib/types'
import { AlertIcon, CheckIcon, ClockIcon, MinusCircleIcon } from './icons'

// A status is always icon + text + color, never color alone.

type Look = { className: string; icon: (props: { className?: string }) => ReactNode }

const looks: Record<MemberStatus, Look> = {
  active: { className: 'bg-good-bg text-good', icon: CheckIcon },
  expiring: { className: 'bg-warn-bg text-warn', icon: ClockIcon },
  expired: { className: 'bg-bad-bg text-bad', icon: AlertIcon },
  none: { className: 'bg-bg text-ink-2', icon: MinusCircleIcon },
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** "Active", "Expires in 3 days", "Expired 2 days ago", "No membership" */
export function statusLabel(member: Member): string {
  const days = member.daysLeft ?? 0
  switch (member.status) {
    case 'active':
      return 'Active'
    case 'expiring':
      return days === 0 ? 'Expires today' : `Expires in ${plural(days, 'day')}`
    case 'expired':
      return `Expired ${plural(-days, 'day')} ago`
    default:
      return 'No membership'
  }
}

/** Small pill for lists. */
export function StatusBadge({ member }: { member: Member }) {
  const look = looks[member.status]
  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium ${look.className}`}
    >
      <look.icon />
      {statusLabel(member)}
    </span>
  )
}

/** The large block on the check-in screen and the profile, readable across a counter. */
export function StatusBlock({ member }: { member: Member }) {
  const look = looks[member.status]
  const detail =
    member.status === 'none'
      ? 'Sell a plan to get started'
      : `${member.planName} · ${member.status === 'expired' ? 'ended' : 'until'} ${formatDate(member.validUntil!)}`
  return (
    <div className={`flex items-center gap-3.5 rounded-card px-4 py-4 ${look.className}`}>
      <look.icon className="size-8" />
      <div className="min-w-0">
        <p className="text-[22px] font-medium leading-tight tracking-tight">{statusLabel(member)}</p>
        <p className="mt-0.5 text-[14px]">{detail}</p>
      </div>
    </div>
  )
}
