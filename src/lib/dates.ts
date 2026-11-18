// Date helpers. A "day" is always a Manila calendar day, written YYYY-MM-DD.

const MANILA = 'Asia/Manila'

function toUtc(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

function toDay(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** The current date in Manila, whatever time zone the phone is set to. */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** The first moment of a Manila day, for "since midnight" queries. Manila is always UTC+8. */
export function manilaDayStart(day: string): string {
  return `${day}T00:00:00+08:00`
}

export function addDays(day: string, count: number): string {
  const value = toUtc(day)
  value.setUTCDate(value.getUTCDate() + count)
  return toDay(value)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
}

/**
 * Inclusive end date, matching public.membership_end in the database:
 * Nov 16 + 1 month ends Dec 15.
 */
export function membershipEnd(start: string, months: number): string {
  const [year, month, date] = start.split('-').map(Number)
  const lastDayOfTarget = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate()
  const sameDayLater = new Date(Date.UTC(year, month - 1 + months, Math.min(date, lastDayOfTarget)))
  return addDays(toDay(sameDayLater), -1)
}

/** "Dec 15, 2026" */
export function formatDate(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(toUtc(day))
}

/** "Mon, Nov 16" */
export function formatWeekday(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(toUtc(day))
}

/** The first day of the Manila month: "2026-11-01". */
export function thisMonth(): string {
  return manilaToday().slice(0, 8) + '01'
}

/** Moves a YYYY-MM-01 month forward or back. */
export function addMonths(month: string, count: number): string {
  const value = toUtc(month)
  value.setUTCMonth(value.getUTCMonth() + count)
  return toDay(value)
}

/** "November 2026", or "Nov 2026" when short. */
export function formatMonth(month: string, short = false): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: short ? 'short' : 'long',
    year: 'numeric',
  }).format(toUtc(month))
}

/** "Mon, Nov 16, 6:02 PM" in Manila time, from a full timestamp. */
export function formatDateTime(timestamp: string): string {
  return `${formatWeekday(manilaToday(new Date(timestamp)))}, ${formatTime(timestamp)}`
}

/** "6:02 PM" in Manila time, from a full timestamp. */
export function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}
