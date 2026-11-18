import { initials } from '../lib/format'
import type { Member } from '../lib/types'
import { StatusBadge } from './status'

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid flex-none place-items-center rounded-full bg-bg font-medium text-ink-2 ${
        large ? 'size-12 text-[16px]' : 'size-10 text-[14px]'
      }`}
    >
      {initials(name)}
    </span>
  )
}

/** One tappable member in a list. */
export function MemberRow({ member, onSelect }: { member: Member; onSelect: (member: Member) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
    >
      <Avatar name={member.fullName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{member.fullName}</span>
        <span className="block text-[13px] tabular-nums text-ink-3">{member.phone}</span>
      </span>
      <StatusBadge member={member} />
    </button>
  )
}
