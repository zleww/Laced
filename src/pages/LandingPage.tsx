import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CheckIcon, MinusCircleIcon, SearchIcon } from '../components/icons'
import { StatusBlock } from '../components/status'
import { addDays, manilaToday } from '../lib/dates'
import { formatPeso } from '../lib/format'
import type { Member } from '../lib/types'

// The public front page for signed-out visitors: what Laced is, for whom, and
// what it looks like. Every picture is the real app's screens, drawn with the
// app's own components. No customers, reviews, or figures are claimed.
//
// Plan (one idea per screen):
//   hero      what is sold, to whom, one fact; the check-in screen
//   desk      check-in that reads across the counter; the three statuses
//   money     every peso tied to a person; payments, a void, the blind count
//   owner     reports and payroll; monthly bars and one payslip
//   access    who sees what; staff view against owner view
//   close     the one action again

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim()
const demoLink = contactEmail
  ? `mailto:${contactEmail}?subject=${encodeURIComponent('Laced demo for my gym')}`
  : null

const wrap = 'mx-auto w-full max-w-6xl px-5 md:px-8'
const primaryLink =
  'inline-flex min-h-12 items-center justify-center rounded-control bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.97]'
const secondaryLink =
  'inline-flex min-h-12 items-center justify-center rounded-control border border-line bg-card px-5 text-[15px] font-semibold text-ink transition-[transform,border-color] duration-150 ease-out hover:border-ink-3 active:scale-[0.97]'

function sampleMember(name: string, plan: string, daysLeft: number, status: Member['status']): Member {
  return {
    id: name,
    memberNo: 0,
    fullName: name,
    phone: '',
    status,
    validUntil: addDays(manilaToday(), daysLeft),
    daysLeft,
    planId: null,
    planName: plan,
  }
}

function Actions() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {demoLink ? (
        <a href={demoLink} className={primaryLink}>
          Request a demo
        </a>
      ) : null}
      <Link to="/login" className={demoLink ? secondaryLink : primaryLink}>
        Sign in
      </Link>
    </div>
  )
}

/** One screen-tall section: heading and words on one side, the product on the other. */
function Section({
  id,
  title,
  children,
  visual,
  flip = false,
}: {
  id: string
  title: string
  children: ReactNode
  visual: ReactNode
  flip?: boolean
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex min-h-dvh items-center border-t border-line py-20">
      <div className={`${wrap} grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
        <div className={flip ? 'lg:order-2' : ''}>
          <h2 id={`${id}-title`} className="max-w-[18ch] text-[32px] font-semibold leading-[1.1] tracking-tight md:text-[44px]">
            {title}
          </h2>
          <div className="mt-5 grid max-w-[52ch] gap-4 text-[16px] leading-relaxed text-ink-2 md:text-[17px]">{children}</div>
        </div>
        <div className={`min-w-0 ${flip ? 'lg:order-1' : ''}`}>{visual}</div>
      </div>
    </section>
  )
}

/** A phone-shaped frame around a piece of the real app. */
function PhoneFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className="mx-auto w-full max-w-[380px] rounded-[32px] lg:max-w-[420px] border border-line bg-card p-2.5 shadow-2xl shadow-black/40">
      <div className="rounded-[24px] border border-line bg-bg p-4">{children}</div>
    </div>
  )
}

/** A wide frame for the owner's laptop screens. */
function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className="sheen rounded-card border border-line bg-card p-5 md:p-6">
      {children}
    </div>
  )
}

function CheckInScreen() {
  const member = sampleMember('Marco Reyes', 'Monthly', 21, 'active')
  return (
    <PhoneFrame label="The Laced check-in screen showing an active member and a Check in button">
      <p className="text-[20px] font-semibold tracking-tight">Check in</p>
      <div className="mt-3 flex min-h-11 items-center gap-2 rounded-control border border-line bg-card px-3 text-[15px]">
        <SearchIcon className="size-[18px] text-ink-3" />
        <span>Marco</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-full bg-raised text-[14px] font-medium text-ink-2">MR</span>
        <div>
          <p className="text-[15px] font-medium">Marco Reyes</p>
          <p className="text-[13px] text-ink-3">Member no. 1 · Monthly</p>
        </div>
      </div>
      <div className="mt-4">
        <StatusBlock member={member} />
      </div>
      <p className="mt-4 flex min-h-12 items-center justify-center rounded-control bg-accent text-[15px] font-semibold text-on-accent">
        Check in
      </p>
    </PhoneFrame>
  )
}

function StatusesScreen() {
  return (
    <PhoneFrame label="Three member statuses: active, expiring in 3 days, and expired 2 days ago">
      <div className="grid gap-3">
        <StatusBlock member={sampleMember('Liza Santos', '3 months', 40, 'active')} />
        <StatusBlock member={sampleMember('Paolo Cruz', 'Monthly', 3, 'expiring')} />
        <StatusBlock member={sampleMember('Carla Bautista', '2 months', -2, 'expired')} />
        <p className="flex min-h-12 items-center justify-center rounded-control bg-accent text-[15px] font-semibold text-on-accent">
          Renew {formatPeso(170000)}
        </p>
      </div>
    </PhoneFrame>
  )
}

function MoneyScreen() {
  const rows: Array<[string, string, string, number, string | null]> = [
    ['Liza Santos', '3 months · Cash', 'Rhea', 255000, null],
    ['Walk-in: Joel', 'Day pass · GCash 7012345678', 'Rhea', 8500, null],
    ['Paolo Cruz', 'Monthly · Cash', 'Jun', 95000, 'Entered twice'],
    ['Marco Reyes', 'Monthly · GCash 7019876543', 'Jun', 95000, null],
  ]
  return (
    <Panel label="The owner's payment list with one voided payment, and a day close where the counted cash matches">
      <p className="text-[13px] text-ink-2">Payments</p>
      <ul className="mt-2 divide-y divide-line">
        {rows.map(([payer, detail, by, amount, voided]) => (
          <li key={payer + detail} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[14px] font-medium ${voided ? 'text-ink-3 line-through' : ''}`}>{payer}</p>
              <p className="truncate text-[12px] text-ink-3">
                {detail} · {by}
              </p>
              {voided && <p className="text-[12px] text-bad">Voided: {voided}</p>}
            </div>
            <p className={`text-[14px] font-medium tabular-nums ${voided ? 'text-ink-3 line-through' : ''}`}>{formatPeso(amount)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-control border border-line p-4">
        <p className="text-[13px] text-ink-2">Day close · counted by Rhea</p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p className="text-ink-3">Cash: counted {formatPeso(255000)}, expected {formatPeso(255000)}</p>
            <p className="font-medium text-good">Matches</p>
          </div>
          <div>
            <p className="text-ink-3">GCash: counted {formatPeso(103500)}, expected {formatPeso(103500)}</p>
            <p className="font-medium text-good">Matches</p>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function OwnerScreen() {
  const months = [62, 71, 66, 80, 77, 92]
  const labels = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
  const payslip: Array<[string, number]> = [
    ['SSS', 90000],
    ['PhilHealth', 45000],
    ['Pag-IBIG', 20000],
    ['Withholding tax', 0],
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Panel label="A bar chart of revenue for the last six months">
        <p className="text-[13px] text-ink-2">Revenue by month</p>
        <div className="mt-4 flex h-44 gap-2" aria-hidden="true">
          {months.map((height, index) => (
            <div key={labels[index]} className="flex h-full flex-1 flex-col items-center gap-1.5">
              {/* The bar's height is a share of this area, which fills the column above the label. */}
              <div className="flex w-full flex-1 items-end justify-center border-b border-line">
                <div
                  className={`w-full max-w-6 rounded-t-[4px] ${index === months.length - 1 ? 'bg-mark' : 'bg-mark-soft'}`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-3">{labels[index]}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel label="A payslip for a front-desk employee with SSS, PhilHealth, Pag-IBIG and tax worked out">
        <p className="text-[13px] text-ink-2">Rhea Torres · Front desk</p>
        <dl className="mt-3 divide-y divide-line text-[13px]">
          <div className="flex justify-between py-1.5">
            <dt className="text-ink-2">Gross</dt>
            <dd className="tabular-nums">{formatPeso(1800000)}</dd>
          </div>
          {payslip.map(([label, amount]) => (
            <div key={label} className="flex justify-between py-1.5">
              <dt className="text-ink-2">{label}</dt>
              <dd className="tabular-nums">{amount ? `-${formatPeso(amount)}` : '₱0'}</dd>
            </div>
          ))}
          <div className="flex justify-between py-2 font-semibold">
            <dt>Take-home pay</dt>
            <dd className="tabular-nums">{formatPeso(1645000)}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  )
}

function AccessScreen() {
  const rows: Array<[string, boolean, boolean]> = [
    ['Check members in', true, true],
    ['Register members and sell plans', true, true],
    ['Close the day (blind count)', true, true],
    ['See revenue and expenses', false, true],
    ['Void a payment', false, true],
    ['Payroll and staff accounts', false, true],
  ]
  const mark = (allowed: boolean) =>
    allowed ? (
      <span className="inline-flex items-center gap-1 text-good">
        <CheckIcon /> Yes
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-ink-3">
        <MinusCircleIcon /> No
      </span>
    )
  return (
    <Panel label="What the front desk and the owner can each do">
      <table className="w-full text-[14px]">
        <thead className="text-left text-[13px] text-ink-2">
          <tr>
            <th className="pb-2 font-medium">Action</th>
            <th className="pb-2 font-medium">Front desk</th>
            <th className="pb-2 font-medium">Owner</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([label, desk, owner]) => (
            <tr key={label}>
              <td className="py-2.5 pr-3">{label}</td>
              <td className="py-2.5 pr-3">{mark(desk)}</td>
              <td className="py-2.5">{mark(owner)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <section aria-labelledby="hero-title" className="flex min-h-dvh flex-col">
        <header className={`${wrap} flex min-h-16 items-center justify-between`}>
          <p className="text-[18px] font-semibold tracking-tight">Laced</p>
          <Link to="/login" className="min-h-10 content-center text-[14px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Sign in
          </Link>
        </header>
        <div className={`${wrap} grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16`}>
          <div>
            <h1 id="hero-title" className="max-w-[16ch] text-[40px] font-semibold leading-[1.05] tracking-tight md:text-[56px] xl:text-[64px]">
              Gym management for small gyms still on paper
            </h1>
            <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-ink-2 md:text-[19px]">
              Check members in, sell plans, and record cash and GCash from the front-desk phone. The owner sees revenue,
              payroll, and who did what.
            </p>
            <p className="mt-4 flex items-center gap-2 text-[14px] text-ink-3">
              <CheckIcon className="size-4 text-good" />
              Runs in the browser on Android and iPhone. Nothing to install.
            </p>
            <div className="mt-8">
              <Actions />
            </div>
          </div>
          <CheckInScreen />
        </div>
      </section>

      <main>
        <Section id="desk" title="Check-in that reads across the counter" visual={<StatusesScreen />} flip>
          <p>
            Search by name or phone number. The member's status is the biggest thing on the screen, in words and an icon as
            well as colour, so staff know at a glance who has paid.
          </p>
          <p>
            An expired member gets a Renew button instead of Check in. Only the owner can let them in anyway, and has to
            write down why.
          </p>
        </Section>

        <Section id="money" title="Every peso tied to the person who took it" visual={<MoneyScreen />}>
          <p>
            Prices come from the gym's price list, never typed in, so the desk can't charge a different amount. Each
            payment records who received it, in cash or GCash with its reference number.
          </p>
          <p>
            Payments are never deleted. A mistake is voided with a reason the owner can read. At closing time the desk counts
            the cash without seeing what the system expects, and the owner sees any difference.
          </p>
        </Section>

        <Section id="owner" title="Reports and payroll for the owner" visual={<OwnerScreen />} flip>
          <p>
            Revenue, expenses, and check-ins by day and by month, with downloads for Excel or Google Sheets.
          </p>
          <p>
            Payroll works out SSS, PhilHealth, Pag-IBIG, and withholding tax from each salary and prints the month's
            register. An activity log lists every sale, void, and change with the name of whoever made it.
          </p>
        </Section>

        <Section id="access" title="Members' data stays with the gym" visual={<AccessScreen />}>
          <p>
            Every staff member signs in with their own account. The front desk never sees revenue, expenses, or payroll, and
            that rule is enforced by the database, not only hidden on the screen.
          </p>
          <p>
            The desk phone signs itself out after 15 minutes with no one using it, and the owner can download a full backup
            of every record at any time.
          </p>
        </Section>

        <section aria-labelledby="close-title" className="flex min-h-dvh flex-col border-t border-line">
          <div className={`${wrap} flex flex-1 flex-col justify-center py-20`}>
            <h2 id="close-title" className="max-w-[18ch] text-[36px] font-semibold leading-[1.1] tracking-tight md:text-[52px]">
              Move your gym off the paper logbook
            </h2>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-ink-2">
              {demoLink
                ? 'Send a message and get a walkthrough of Laced on your own phone, with your price list loaded in.'
                : 'Already set up? Sign in with the account the gym owner gave you.'}
            </p>
            <div className="mt-8">
              <Actions />
            </div>
          </div>
          <footer className={`${wrap} flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-[13px] text-ink-3`}>
            <p>Laced · Gym management</p>
            <p>Payments are recorded, not processed. No card details are collected.
            </p>
          </footer>
        </section>
      </main>
    </div>
  )
}
