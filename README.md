# Laced

A phone-first gym management system for small gyms that still run on paper. The front desk checks members in, sells and renews plans, and records cash and GCash payments. The owner gets revenue reports, payroll, and a log of who did what.

**Live:** [laced-rho.vercel.app](https://laced-rho.vercel.app) (the public front page; the app itself needs an account)

> **Status:** live prototype, built for a local gym that runs on a handwritten logbook and paper membership cards. Every flow below works against a real database and is covered by tests. A trial run alongside the paper system is next; QR and NFC member cards and owner discounts come after.

## The problem

- Members sign a paper logbook, and paper membership cards make expiry dates easy to miss, so expired members walk in unnoticed.
- Payments are not recorded in one place, so the owner cannot see revenue, renewals, or growth.
- Several staff share the front desk, so money needs a name attached to every peso.

## What it does

**Front desk** (one phone, few buttons)

- **Check-in:** search by name or phone number. The member's status (Active, Expiring within 7 days, Expired) is the biggest thing on the screen, in words and an icon as well as colour. An expired member gets a Renew button instead of Check in.
- **Sell and renew:** prices come from the server's price list, never typed in. Early renewals start the day after the current plan ends, so no paid days are lost.
- **Day passes:** a walk-in pays and is checked in in one step.
- **Close the day:** a blind count. The desk types the cash and GCash it counted and never sees what the system expected; the owner sees the difference.

**Owner**

- **Dashboard and reports:** revenue and check-ins by day and month, revenue by plan, renewals due, and CSV downloads.
- **Money:** every payment with who received it. Mistakes are voided with a written reason, never deleted.
- **Payroll:** employees with a monthly rate. Each month's SSS, PhilHealth, Pag-IBIG, and withholding tax are worked out by the database (2026 rates), drafts are marked paid, and the register prints.
- **Activity log:** every sale, void, check-in, registration, expense, day close, payroll change, and setting change, with who did it and when.
- **Staff accounts:** add logins, reset passwords, and turn accounts off, through a server function that keeps Supabase's secret key off the browser.
- **Settings:** a one-click backup of every record, two-step sign-in, and the wrong-password limit.

## Security and privacy

The system holds members' names and phone numbers and the gym's money, so the rules live in the database, not only on the screen.

- **Row-level security on every table.** Signed-out visitors can read nothing. Front-desk accounts cannot see revenue, expenses, payroll, other staff's collections, or the audit log, even by calling the database directly.
- **Money is written only by database functions.** The browser sends ids, never amounts; payment and membership are saved in one transaction; amounts are integer centavos.
- **Two-step sign-in.** Once an account turns on an authenticator app, a password alone gives it no access at all.
- **Privacy (Philippine Data Privacy Act):** only a name and a mobile number are collected, with consent. The owner can delete a member's data on request; payments stay as "Deleted member" so the books still add up.
- **The shared desk phone** signs itself out after 15 minutes of no use, and asks people to wait after too many wrong passwords.
- **Hosting:** HTTPS only, a strict Content Security Policy (the page talks only to itself and Supabase), no framing, and plain error messages instead of raw database errors.

## Stack

- **Front end:** React, TypeScript, Vite, Tailwind CSS. Mobile first, with a dark and a light theme.
- **Back end:** Supabase (PostgreSQL, Auth with two-step sign-in, row-level security, an Edge Function for staff accounts).
- **Hosting and checks:** Vercel; GitHub Actions runs lint, type checks, tests, the build, and a dependency audit on every push.
- **Time:** every "today" and "this month" is worked out in `Asia/Manila`.

## Run it locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Without Supabase keys, `npm run dev` starts in **demo mode**: sample members in memory, with an owner and a staff account to try. Nothing is saved. Demo mode is left out of production builds, and a production build without keys refuses to start.

To use a real database, create a Supabase project, run the files in `supabase/migrations/` in order in the SQL Editor, deploy `supabase/functions/staff-admin`, then:

```bash
cp .env.example .env.local   # your Supabase URL and publishable key
```

## Deploy

On Vercel, import the repository and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (and optionally `VITE_CONTACT_EMAIL`, where the front page's "Request a demo" button writes to). `vercel.json` routes every path to the app and sets the security headers.

## Database

Plain SQL in `supabase/migrations/`, applied in file-name order:

1. `schema`: tables and constraints
2. `functions`: register a member, sell or renew, day pass, check in
3. `access_rules`: grants and row-level security
4. `seed_plans`: the starting price list
5. `analytics_daily`: daily revenue and check-ins for the dashboard
6. `money`: voids, the blind day close, and the owner's money totals
7. `payroll_activity_reports`: employees, payroll with government deductions, the activity log, monthly reports
8. `member_deletion`: deleting a member's data on request while keeping the payment records
9. `two_step_sign_in`: no access until the authenticator code is entered, once it is turned on
10. `sign_in_limits`: the owner's wrong-password limit

## Tests

```bash
npm test
```

136 tests. The database tests run the real migration files against [PGlite](https://pglite.dev), a Postgres that runs in memory, so no Docker or network is needed. They cover:

- **Access:** signed-out visitors get nothing; staff cannot read expenses, payroll, the audit log, or other staff's collections
- **Price integrity:** no direct writes to payments; the charged amount always comes from the price list
- **Dates:** inclusive end dates, early renewal, and the Manila day boundary (an 11:30 PM check-in counts on that day)
- **Check-in:** expired members are refused, and a double tap counts once
- **Money:** only the owner can void, a void cancels its membership, and the day close hides the expected amounts from the person counting
- **Payroll:** contributions and tax at the floors, ceilings, and brackets; a paid month is locked; the on-screen preview matches the database for 22 salary levels
- **Two-step sign-in, deletion, and sign-in limits:** a password alone opens nothing once two-step is on; deleted members lose their name and phone but keep their payments; only the owner changes the limits

## Documentation

- [Project brief](docs/PROJECT_BRIEF.md): problem, decisions, flows, data model, build phases
- [Design system](docs/DESIGN_SYSTEM.md): colours, contrast, screens, dashboard spec
- [Security and legal](docs/SECURITY_AND_LEGAL.md): access rules, launch checklist, Data Privacy Act notes
