import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { AlertIcon, CheckIcon } from './icons'

// Small building blocks shared by every screen.

type Variant = 'primary' | 'secondary' | 'quiet'

const variants: Record<Variant, string> = {
  // One primary button per screen: the solid highlight (white in dark mode, black in light).
  primary: 'bg-accent text-on-accent',
  secondary: 'bg-card text-ink border border-line',
  quiet: 'text-ink-2',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }

export function Button({
  variant = 'primary',
  busy = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control px-4 text-[15px] font-semibold transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...props}
    >
      {busy ? 'Working…' : children}
    </button>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }

// 16px text on purpose: iPhones zoom the page when an input is smaller than that.
export function Field({ label, hint, className = '', ...props }: FieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <input
        id={id}
        className="block min-h-12 w-full rounded-control border border-line bg-card px-3.5 text-base text-ink placeholder:text-ink-3 disabled:opacity-60"
        {...props}
      />
      {hint && <p className="mt-1.5 text-[13px] text-ink-2">{hint}</p>}
    </div>
  )
}

type CheckboxProps = { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }

export function Checkbox({ checked, onChange, children }: CheckboxProps) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-control border border-line bg-card p-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 flex-none accent-(--ink)"
      />
      <span className="text-[14px] leading-snug text-ink">{children}</span>
    </label>
  )
}

/** A short message after an action: what happened, or what went wrong and what to do. */
export function Notice({ tone, children }: { tone: 'good' | 'bad'; children: ReactNode }) {
  const styles = tone === 'good' ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'
  return (
    <p
      role={tone === 'bad' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-control px-3.5 py-3 text-[14px] font-medium ${styles}`}
    >
      <span className="mt-0.5">{tone === 'good' ? <CheckIcon /> : <AlertIcon />}</span>
      <span>{children}</span>
    </p>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-card ${className}`}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-[13px] font-medium text-ink-2">{children}</h2>
}

/** Shown in place of content while it loads, so the layout does not jump. */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-[14px] text-ink-2">
      {label}…
    </p>
  )
}
