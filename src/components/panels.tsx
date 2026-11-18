import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeftIcon } from './icons'

// Building blocks for the owner's data screens (Money, Reports, Payroll, Activity, Settings).

export const smallButton =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-medium text-ink-2 hover:text-ink disabled:opacity-50'

type PageHeaderProps = {
  title: string
  /** On a phone, show a back link to the More page this screen was opened from. */
  fromMore?: boolean
  children?: ReactNode
}

export function PageHeader({ title, fromMore = false, children }: PageHeaderProps) {
  return (
    <div className="grid gap-1">
      {fromMore && (
        <Link
          to="/more"
          className="-ml-1.5 inline-flex min-h-10 w-fit items-center gap-1 rounded-control pr-2 text-[14px] text-ink-2 hover:text-ink md:hidden print:hidden"
        >
          <ChevronLeftIcon className="size-5" />
          More
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  )
}

type PillsProps<T extends string | number> = {
  label: string
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

/** One row of filter pills. The selected one uses the solid highlight. */
export function Pills<T extends string | number>({ label, options, value, onChange }: PillsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-[20px] border border-line bg-card p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-8 rounded-full px-3 text-[12px] font-medium ${
            value === option.value ? 'bg-accent text-on-accent' : 'text-ink-2 hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, note, wide }: { label: string; value: string; note: string; wide?: boolean }) {
  return (
    <div className={`sheen rounded-card border border-line bg-card p-4 ${wide ? 'col-span-2 md:col-span-1' : ''}`}>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-[12px] text-ink-3">{note}</p>
    </div>
  )
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-card border border-line bg-card p-4 md:p-5">
      <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] text-ink-2">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[14px] text-ink-2">{children}</p>
}

/** A thin horizontal bar: rounded at the data end, square at the start. */
export function Bar({ share }: { share: number }) {
  return (
    <div className="mt-1.5 h-2 rounded-r-full bg-raised">
      <div className="h-2 rounded-r-full bg-mark-soft" style={{ width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%` }} />
    </div>
  )
}

/** "-₱1,200" for a negative amount, "₱1,200" otherwise. */
export function signed(format: (value: number) => string, centavos: number): string {
  return (centavos < 0 ? '-' : '') + format(Math.abs(centavos))
}
