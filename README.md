# Laced

A phone-first gym management system: member records, memberships, payments, front-desk check-in, and an owner analytics dashboard. Built as a working prototype for a real neighborhood gym that currently runs on a paper logbook and paper membership cards.

> **Status:** working prototype. Sign-in, an owner dashboard with charts, Check in, Members, selling and renewing plans, and day passes are built on top of a tested database schema. It also has an owner Money screen (revenue, expenses, net, voids, CSV export) and a blind end-of-day count. Discounts, QR and NFC cards, and deeper analytics are next.

## What it will do

- **Members and memberships** with an automatic status: Active, Expiring within 7 days, or Expired.
- **Fast check-in** at the front desk on a phone, with a large status that can be read across the counter.
- **Payments** in cash or GCash, recorded (not processed), each tied to the staff member who received it. Prices come from the server, and payments are voided with a reason, never deleted.
- **End-of-day close** that compares counted cash and GCash totals against the records.
- **Owner dashboard:** revenue, renewals due, retention, busiest hours, and revenue by plan. Staff cannot see revenue or expenses.

## Stack

- **Front end:** React, TypeScript, Vite, Tailwind CSS; mobile-first progressive web app
- **Back end:** Supabase (Postgres, Auth, row-level security)
- **Money** stored as integer centavos; all "today" and "this month" logic in `Asia/Manila` time

## Run it locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev                  # starts in demo mode
```

To use a real database, create a Supabase project, apply the files in `supabase/migrations/` in order, then:

```bash
cp .env.example .env.local   # fill in your Supabase URL and publishable key
```

## Demo mode

Without Supabase keys the app starts in demo mode: sample members held in memory, with an owner account and a staff account to try. Nothing is saved, and it resets on reload. The demo follows the same rules as the database, but the database is where the rules are enforced.

## Database

The schema is plain SQL in `supabase/migrations/`, applied in file-name order:

1. `schema`: tables and constraints
2. `functions`: the actions the app calls (register a member, sell or renew, day pass, check in)
3. `access_rules`: grants and row-level security
4. `seed_plans`: the starting price list
5. `analytics_daily`: daily revenue and check-ins for the owner dashboard
6. `money`: voiding payments and expenses, closing the day, and the owner's money totals

The browser never sends a price and never writes to the money tables directly. It calls a database function with ids, and the function looks up the price and writes the payment and membership in one transaction.

## Tests

```bash
npm test
```

The tests run the real migration files against [PGlite](https://pglite.dev), a Postgres that runs in memory, so no Docker or network is needed. They cover:

- **Access:** signed-out visitors get nothing; staff cannot read expenses, the audit log, or other staff's collections
- **Price integrity:** no direct writes to payments; the charged amount always comes from the plans table
- **Dates:** inclusive end dates, early renewal, and the Manila day boundary (11:30 PM counts as that day)
- **Check-in:** expired members are refused, and a double tap counts once
- **Money:** only the owner can void, a void cancels its membership, staff get no totals, and the day close hides the expected amounts from the person counting

## Documentation

- [Project brief](docs/PROJECT_BRIEF.md): problem, decisions, flows, data model, build phases
- [Design system](docs/DESIGN_SYSTEM.md): colors, contrast, screens, dashboard spec
- [Security and legal](docs/SECURITY_AND_LEGAL.md): access rules, launch checklist, Philippine Data Privacy Act notes
