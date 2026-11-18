# Project brief — Laced

Last updated: 2026-11-16. Laced is a gym management system, built first as a prototype for one real gym. Everything marked **(decided)** is confirmed. Everything marked **(proposed)** is a design choice that still needs confirmation from the gym owner.

## 1. Summary

A phone-first web app (PWA) for a real gym. The prototype is branded **Laced** only; no gym name or logo until the owner approves customization. The owner and about 4 staff (usually 1, sometimes 2 at the desk at once) use it to replace paper: handwritten check-in logbook, paper membership cards (monthly and annual), and untracked finances. Staff still do the work by hand, the system just keeps clean, searchable records and shows the owner real analytics. A separate member-facing app for tracking lifts and attendance is planned for later and will share the same backend.

## 2. Problem and current process

- Check-in: members **write their names by hand** in a logbook.
- Memberships: **paper cards** for monthly and annual plans. Expiry dates are easy to lose track of, and an expired member can walk in unnoticed.
- Finance: no single record of payments, so the owner cannot see revenue, renewals, or growth. This makes growth planning hard.
- Posted policy sign at the gym: **"Magbayad muna bago magbuhat"** (pay first before lifting). So a walk-in day pass is one action: take payment, then check in.

## 3. Goals and non-goals

**Goals**
1. Searchable record of every member and membership, with automatic status (Active, Expiring within 7 days, Expired).
2. Fast check-in at the front desk on a phone.
3. Every payment recorded (cash or GCash), attributable to the staff member who received it.
4. Owner dashboard with real analytics (revenue, renewals, retention, peak hours, plan mix, expenses, net).
5. Simple enough that a 30–40 year old gym owner is not overwhelmed: few buttons, big status, plain labels.
6. Portfolio-grade project for a remote developer job.

**Non-goals (decided)**
- **Not automating entry.** Check-in stays staff-operated and staff-confirmed. No turnstiles, no unattended door control.
- No online payment gateway. Payments are **recorded**, not processed, so no card data and no payment-card compliance scope.
- No member self-service in v1 (comes with the gym-goer app later).

## 4. Users and roles

| Role | Count | Can do | Cannot do |
|---|---|---|---|
| Owner | 1 | Everything, including revenue, expenses, dashboard, voiding payments, editing plans, managing staff accounts | — |
| Staff (front desk) | about 4 | Search and register members, create memberships, record payments, check members in, close the day | See revenue totals or expenses, void or delete payments, edit plans, see other staff's accounts |
| Member (later, gym-goer app) | many | See own membership, own attendance, own lift log | See anyone else's data |

Each staff member gets an **individual login**. No shared account, so every payment and edit has an author.

## 5. Decisions made so far

1. **(decided)** Keep entry manual; make records efficient. Staff confirm every check-in.
2. **(decided)** Owner uses a **phone**. Front-desk device is a phone; **Android vs iPhone is unknown.**
3. **(decided)** UI must be straightforward, few buttons.
4. **(decided)** Gym takes **cash and GCash**.
5. **(decided)** Wants a real analytics dashboard, not a basic summary.
6. **(decided)** Colors: monochrome, dark by default with a light mode toggle; color only for status and change. See `DESIGN_SYSTEM.md`.
7. **(decided)** Trainer monthly price is ₱4,950. **Promo rates already apply to students** (no separate student promo).
8. **(decided)** Considering NFC cards and QR scanning for identification, plus a separate gym-goer app compatible with this system.
9. **(proposed)** Check-in identification: search first, then QR, then NFC as a progressive enhancement. See section 8.4.
10. **(decided)** Supabase backend (hosted project, Postgres, Auth, row-level security); mobile-first PWA front end with React, TypeScript, Vite, and Tailwind CSS.
11. **(decided)** Desk phones are **both Android and iPhone**. Search and QR work on every phone; the NFC button appears only where Web NFC is supported (Android Chrome).
12. **(decided)** 4-month promo is **₱3,500** (confirmed, not a misprint).
13. **(decided)** End date is inclusive: a 1-month plan starting Nov 16 ends **Dec 15**.
14. **(decided)** Day-pass walk-ins give a **name**.
15. **(decided)** Trainer tracking (which trainer, sessions, commission) is **on standby**, not in v1.
16. **(decided)** **No grace period.** Expired means expired the day after the end date.
17. **(decided)** UI labels in **English**.
18. **(decided)** Usually 1, sometimes 2 staff at the desk at the same time.
19. **(decided)** The prototype uses the name **Laced** and the monochrome theme. The gym's own name, logo, and colors come later, as a customization step after the owner approves.
20. **(proposed)** GCash reconciliation method, see section 8.6. The method was left to the developer.

## 6. Rates and hours (transcribed from a photo of the gym's whiteboard)

| Plan | Price (₱) | Notes |
|---|---|---|
| Regular, per day | 85 | |
| Regular, monthly | 950 | |
| Student, per day | 75 | needs a school ID check |
| Student, monthly | 850 | needs a school ID check |
| Monthly with trainer | 4,950 | confirmed |
| Per day with trainer | 385 | |
| Promo, 2 months | 1,700 | applies to everyone including students |
| Promo, 3 months | 2,550 | |
| Promo, 4 months | 3,500 | confirmed |
| Promo, 6 months | 5,100 | |
| Promo, 1 year | 9,000 | **plus 1 month free = 13 months** |

**Hours:** Monday–Saturday 7:00 AM–11:00 PM. Sunday 10:00 AM–8:00 PM only.

**Resolved:** 4 months at ₱3,500 (₱875 per month) is the real price, even though 3 and 6 months are cheaper per month. Seed it as ₱3,500.

Store these in a `plans` table, never in code. See section 9.

## 7. Inspiration

A TikTok by @adrianlunaaa16 about building a gym check-in system. What it shows:

- A QR check-in web page that asks for an 11-digit phone number ("Enter exactly 11 digits").
- A fixed entrance reader: ESP32 board, RFID reader (MFRC522-style), and a small OLED showing "Tap RFID" and the card UID.
- An owner dashboard with a member profile (Member and Active badges, phone number, "Not currently checked in"), an **"Assign card"** flow (staff confirms, then the next tap on the reader links the card to that person), a visit history table, and a "Print check-in QR" item. Cards are optional for members and guests.
- A banner noting automatic check-out after a long time without activity.

**What to borrow:** the assign-card enrollment flow, visit history on the profile, phone-number validation, and printable QR.
**What not to borrow (for now):** the fixed unattended reader. It is automatic entry, which was ruled out, and it adds hardware, firmware, and a device key to protect. It stays as a late stretch goal.

## 8. Core flows and business rules

### 8.1 Register a member
Staff enter full name and phone (`09XXXXXXXXX`). Consent line shown and ticked (see `SECURITY_AND_LEGAL.md`). Collect nothing else in v1. No photo, no address, no birthday.

### 8.2 Create or renew a membership
1. Staff pick the member and a plan.
2. The server looks up the price. The client sends only `member_id`, `plan_id`, method, and (for GCash) the reference number.
3. Student plans require a tick "School ID checked". Store the boolean and the date. Do **not** store an ID photo.
4. Payment row and membership row are created in **one database transaction** (a single RPC), or neither is.
5. End date: duration in months (1 year = 12 + 1 bonus = 13). **(decided)** Inclusive end date: start `Nov 16` + 1 month ends `Dec 15` (end = start + N months − 1 day). Test month-end edges (for example Jan 31 + 1 month) before seeding real data.
6. **Early renewal** (current membership not yet expired): new start = previous end + 1 day, so no paid days are lost. Otherwise start today.
7. `memberships.kind` is `new`, `renewal` (continues within 7 days of expiry or while active), or `returning` (lapsed 30+ days). Needed for retention analytics.

### 8.3 Check in
1. Staff identify the member (section 8.4).
2. Screen shows the name, plan, and a **large status**: Active until date / Expiring in N days / Expired N days ago. Status uses icon + text + color, never color alone.
3. Active or Expiring: one primary button **Check in**. Expired (no grace period, the day after the end date): the primary button becomes **Renew ₱{price}**, and a secondary "Check in anyway" requires an owner override reason (logged).
4. Success gives a small confirmation pulse; the check-in row stores method, staff id, and status at check-in.
5. Walk-in day pass: **Day pass ₱85 + check in** is one action (pay first). **(decided)** The guest gives a name. **(proposed)** Store it as `guest_name` on the check-in and payment rows (`member_id` null); no phone and no member record, so the member list stays clean. Show a short notice line on the day-pass sheet (see `SECURITY_AND_LEGAL.md`). A regular walk-in can be registered as a member later.
6. No check-out in v1. Attendance is arrival-based. Fewer buttons.

### 8.4 Identifying the member

All methods call the same `check_in(member_id, method)` function. Build in this order:

| # | Method | Works on | Notes |
|---|---|---|---|
| 1 | Search by name or phone | any phone | v1 and the permanent fallback |
| 2 | **Staff scans the member's QR card** with the phone camera | iPhone and Android | QR holds a random token, never the phone number |
| 3 | **Staff taps the member's NFC card** on the staff phone | **Android Chrome only** | Web NFC; feature-detect with `'NDEFReader' in window`; hide the button otherwise. iOS Safari does not support Web NFC |
| 4 | Member self check-in (desk QR or NFC tag) through the gym-goer app | later | Lands as "waiting for staff", staff confirm |
| 5 | Fixed ESP32 + RFID reader like the video | stretch | Needs hardware, firmware, device auth |

Rules for cards:
- A card is an **identifier, not a password**. Store a random token (`cards.token`), not personal data. Staff always see the name on screen before confirming.
- Lost card: deactivate the token and issue a new one.
- Assign-card flow: on the member profile tap **Assign card**, confirm, scan or tap once, done.
- A phone cannot act as an NFC card from a web page. The "member taps their phone on a card" idea does not work well; a static NFC tag at the desk is equivalent to a static QR (anyone can copy the URL).
- **The desk uses both Android and iPhone (decided).** Search and QR are the methods every device has. NFC is an extra on Android phones only, feature-detected and hidden elsewhere. A member with only an NFC card must still be findable by search on an iPhone.

### 8.5 Payments
- Methods: `cash`, `gcash`. GCash requires `gcash_ref`.
- Discounts: owner only, with a reason.
- **Void, never delete.** `voided_at`, `voided_by`, `void_reason`. Voids are audit-logged and visible to the owner.
- Every payment stores the **price at the time** (`amount_centavos`) so later price changes do not rewrite history.

### 8.6 End-of-day close
One button: "Close today: ₱X". Shows system totals separately for cash and GCash. Staff enter counted cash; GCash is compared against the GCash app total. Stores variance. Owner sees variance trends.

**GCash reconciliation (proposed; the owner left the method to the developer):**
1. Every GCash payment requires the reference number at the time it is recorded (already a rule). The database rejects a reference number already used on another non-voided payment, which catches double entry but still allows re-entering a payment after a void.
2. At close, the staff member enters the **GCash total received today** from the GCash app's transaction history. The system shows the difference from the sum of recorded GCash payments.
3. If there is a difference, the owner opens the day's GCash list (time, amount, reference number, staff) and matches it line by line against the GCash app history.
4. No screenshots are uploaded or stored. They would show other people's names and numbers and add an upload feature that v1 avoids.

### 8.7 Expenses (owner only)
Category, amount, date, note. Examples: rent, electricity, equipment, salaries. Voided, never deleted.

## 9. Data model (draft, to be finalised in Phase 1)

All ids are `uuid`. All money is `integer` centavos. `created_at` defaults to `now()`.

- `staff(id = auth.users.id, full_name, role in ('owner','staff'), active)`
- `members(id, member_no, full_name, phone unique, consent_at, auth_user_id unique null, deleted_at)`
- `plans(id, code, name, category in ('regular','student','trainer','promo'), duration_days null, duration_months null, bonus_months default 0, price_centavos, active, sort)`
- `memberships(id, member_id, plan_id, start_date, end_date, kind in ('new','renewal','returning','day_pass'), student_id_checked, student_id_checked_on, created_by)`
- `payments(id, member_id null, membership_id null, guest_name null, plan_id, amount_centavos, discount_centavos default 0, discount_reason, discount_approved_by, method in ('cash','gcash'), gcash_ref null (unique among non-voided payments, via a partial unique index), received_by, paid_at, voided_at, voided_by, void_reason)`
- `checkins(id, member_id null, membership_id null, guest_name null, checked_in_at, method in ('search','qr','nfc','self'), staff_id, status_at_checkin in ('active','expiring','expired','day_pass'), override_reason)`. A day-pass row has `guest_name` and no `member_id`; every other row has `member_id`.
- `cards(id, member_id, token unique, kind in ('qr','nfc'), active, issued_at, deactivated_at)`
- `expenses(id, category, amount_centavos, spent_on date, note, recorded_by, voided_at)`
- `daily_closes(id, close_date unique, expected_cash, counted_cash, gcash_total, variance_cash, closed_by, note)`
- `audit_log(id, table_name, row_id, action, old jsonb, new jsonb, actor, at)` append-only

Functions (RPC, `security definer`, `set search_path = public`, each checks the caller's role):
- `is_owner()`, `is_staff()`
- `record_membership_payment(member_id, plan_id, method, gcash_ref)` creates payment + membership atomically with server-side price
- `check_in(member_id, method)`
- `void_payment(payment_id, reason)` owner only
- `close_day(date, counted_cash)`
- `analytics_*` functions, owner only (section 11)

Seed `plans` from section 6 (4-month promo confirmed at ₱3,500).

### 9.1 As built (2026-11-16)

The schema lives in `supabase/migrations/` and is the source of truth. Where it differs from the draft above:

- **One check-in per member per day.** `checkins.visit_date` is the Manila calendar day, worked out by the database, and `(member_id, visit_date)` is unique. A second tap returns the first check-in instead of counting twice. **(proposed)** Confirm with the owner that a member who comes back the same evening does not need a second record.
- **Expired means refused.** Staff cannot check in an expired member. Only the owner account can, and only with a written reason.
- **`renewal` vs `returning`.** Buying while active or within 7 days after expiry is a `renewal`; anything later is `returning`.
- **Month ends.** End date = start + N months − 1 day. Nov 16 → Dec 15, Mar 1 → Mar 31, Jan 31 → Feb 27.
- **Day pass** is its own action, `sell_day_pass`, for a named guest or for a registered member whose plan has lapsed. It takes the payment and checks in together.
- **`register_member`** is the only way to add a member. It normalises the phone number and stamps consent.
- **`member_overview`** is a view of members with a live status (`active`, `expiring`, `expired`, `none`) for the member list and check-in screen.
- **`memberships.voided_at`** exists so that voiding a payment can cancel the membership it paid for.
- **`daily_closes`** stores expected and counted amounts for both cash and GCash.
- **Audit log** covers payments, memberships, plans, staff, expenses, and daily closes. Members are left out so that names and phone numbers do not survive a deletion request.
- **`analytics_daily(days)`** returns revenue and check-ins per Manila day for the owner dashboard. Staff get no rows.
- **`void_payment(payment, reason)`** (owner only) keeps the row, records who and why, and cancels the membership that payment paid for. A voided GCash reference can be entered again.
- **`close_day(counted cash, counted GCash, note)`** is a **blind count**: the desk types what it counted and is told only that the day is closed. The expected amounts and the difference are stored for the owner. Staff cannot read `daily_closes` at all. **(proposed)** This differs from section 8.6, which showed the totals to staff; confirm with the owner. One close per day; payments recorded after the close are not in that close.
- **`void_expense`**, **`analytics_money(days)`** (revenue, cash, GCash, expenses, void count) and **`analytics_plans(days)`** (revenue per plan) are owner only.
- **Money screen** (owner): revenue, expenses, net, revenue by plan, cash against GCash, the payment list with Void and CSV export, expenses, and day closes.
- **Payroll** (owner only): `employees` (anyone the gym pays, with or without a login) and `payroll_entries` (one per employee per month). `payroll_deductions(gross, with_contributions)` works out SSS, PhilHealth, Pag-IBIG, and BIR withholding tax with the 2026 rates; `save_payroll_entry` stores a draft with the amounts copied in, `mark_payroll_paid` locks it, `void_payroll_entry` cancels it with a reason. Rates must be checked every January and changed in a new migration. **(proposed)** The gym's accountant should check the first payroll run.
- **`activity_feed(limit, before, kind)`** (owner only) lists sales, voids, check-ins, registrations, expenses, day closes, payroll changes, and plan, staff, and employee changes, newest first, with who did each.
- **`analytics_monthly(months)`** (owner only): revenue, expenses, paid payroll (gross plus the gym's share of contributions), check-ins, and new members per Manila month.
- **Screens:** Reports (monthly table and chart, CSV downloads), Payroll (register, employees, print), Activity, and Settings (full backup download, system info, safety habits). On a phone the owner's extra screens sit under **More**.
- **Two-step sign-in** (Settings): an authenticator-app code after the password. Once on, `is_staff()` and `is_owner()` return false until the session has the code (`aal2`), so every table and action is covered. The Dashboard reminds the owner until it is on. The staff-admin function checks `is_owner()` as the caller, so it follows the same rule.
- **Wrong-password wait:** after the owner's limit (default 5 tries) on a device, the sign-in screen asks the person to wait (default 10 minutes). The limits live in `app_settings` (owner edits them in Settings; `sign_in_limits()` is readable before sign-in). This is a speed bump in the browser, not an account lock; a true per-account lock needs Supabase's password verification hook, which is on the Team plan only.
- **Idle sign-out:** after 15 minutes with no taps or typing, the app signs out (shared desk phone).
- **`delete_member_data(member, reason)`** (owner only): replaces the name with "Deleted member", erases the phone, unlinks any login, turns off cards, and keeps payments, memberships, and visits. The activity log records the deletion and reason without the name.
- **Not built yet:** discounts, card assignment (QR and NFC), deleting a day-pass guest's name, and the remaining analytics (renewal rate, busiest-hours heatmap, per-staff collections).

**Tests.** `npm test` runs the real migration files against an in-memory Postgres and checks access rules, price integrity, date rules, and the Manila day boundary.

## 10. Build phases

**Phase 0 (before coding, 1–2 days).** Answered on 2026-11-16: ₱3,500 plan, end-date convention, Android and iPhone, guest day-pass rule, trainer handling (standby), English, no grace period. **Still to do with the owner:** show the mockup; agree **in writing** who owns the data (the owner), who owns the code (the developer, for portfolio use), and who pays hosting; get permission before the gym's name, logo, or prices appear in a public repo or portfolio.

**Phase 1, MVP (about 7 days).**
- Days 1–2: Supabase project, schema, auth, roles, RLS, seed plans. Member list with search.
- Days 3–4: create memberships with automatic end dates; record payments via the RPC.
- Day 5: check-in screen with the large status and the expired path.
- Days 6–7: "Today" screen and the **renewals due** list; basic revenue total.
- Exit test: staff can run a full day (register, sell, renew, check in) on a phone.

**Phase 2.** Expenses, Money screen, end-of-day close, void with reason, audit log, owner-only analytics v1, CSV export.

**Phase 3.** Printable QR cards and QR scan check-in, then NFC with the Assign-card flow (if Android).

**Phase 4.** Gym-goer PWA (section 12).

**Stretch.** ESP32 + RFID desk reader; renewal reminders by SMS or email (staff-triggered); at-risk member list.

## 11. Analytics and dashboard

Each panel answers one owner question.

| Question | Panel |
|---|---|
| Am I growing? | Hero: revenue for the selected range, change vs the previous equal period, net after expenses |
| Who should I call? | Renewals due this week with ₱ at stake; later "active but no visit in 14 days" |
| When am I crowded? | Weekday × hour heatmap of average visits (for staffing, maintenance, promos) |
| Where does money come from? | Revenue by plan, stacked cash vs GCash revenue over time |
| Is cash matching? | Daily-close variance and collections per staff member |

**Definitions (agree with the owner):**
- Active = `end_date >= today`. Expiring = within 7 days.
- Renewal rate = of memberships that ended in the period, the share renewed within 7 days.
- Churned = lapsed 30+ days with no renewal.
- ₱ at stake = sum of the plan prices of members expiring in the next 7 days.
- At risk = active but no check-in in 14 days.
- Retention cohorts = join month vs % still active after 1, 2, 3 months.
- Net = revenue (voids excluded) minus expenses.

**Implementation rules**
- Compute in Postgres functions that call `is_owner()`. A plain view runs with the view owner's rights and **bypasses RLS**, so do not use plain views for owner-only totals.
- Group by `at time zone 'Asia/Manila'`.
- The heatmap shows **average** visits per slot: total visits divided by how many times that weekday occurred in the range. Sunday is only open 10:00–20:00.
- Charts are only as good as the data: tag every membership `new`/`renewal`/`returning`, and expect thin charts for the first weeks.
- Date range filter: last 7 days, last 30 days, last 12 weeks. Every panel re-renders against the same range.
- Every chart has a table view and tooltips; see `DESIGN_SYSTEM.md`.

A sample dashboard mockup was built in the chat (hero revenue, three stat tiles, stacked cash/GCash columns, heatmap, ranked plan bars, renewals list with one primary button). Its data was fake sample data. The layout and colors are specified in `DESIGN_SYSTEM.md`.

## 12. Gym-goer app (later; separate from the owner system)

- Separate front end (PWA), **same Supabase backend**. Not a second database.
- `members.auth_user_id` links a member to a login. Row-level security: a member reads only their own rows.
- v1: membership status, expiry, attendance history (read-only from `checkins`).
- v2: lift tracker in its own tables (`exercises`, `workouts`, `workout_sets`). **Owner and staff do not see lift data by default.** Body-related data can be sensitive under the Data Privacy Act, so make it consent-based and deletable.
- With the app installed, the member is already signed in, so a desk QR or NFC scan becomes a one-tap check-in request that staff confirm.
- Build only after Phase 2 of the owner system works.

## 13. Open questions

Answered on 2026-11-16:

1. Desk phone: **both Android and iPhone.** NFC is Android-only, extra; search and QR everywhere.
2. 4-month promo: **₱3,500.**
3. End date: a 1-month card from Nov 16 is valid **through Dec 15.**
4. Day-pass walk-ins: **with a name.** (Storage proposed in section 8.3.)
5. Trainer tracking: **standby**, not in v1.
6. Grace period: **none.**
7. GCash reconciliation: developer's choice. Proposed method in section 8.6.
8. Labels: **English.**
9. Staff at the desk at once: **usually 1, sometimes 2.** Current member count: depends, **still unknown** (ask the owner for a rough number before the import).
10. Brand: the gym has its own name and logo, but the **prototype stays unbranded as "Laced"**. Gym branding is a later customization step, after the owner approves it.
11. Hosting costs and the written data/code agreement: **still open**, to discuss with the owner.

## 14. Rollout, acceptance, and test plan

**Rollout.** Run **paper and system in parallel for about 2 weeks.** Before day 1, enter every currently active member with their existing expiry date, so the Expiring list works from the start. Train the 4 staff on three actions only: check in, renew or sell, close the day.

**MVP acceptance**
- A staff member can register, sell a plan (cash and GCash), and check in a member, each in under 30 seconds on a phone.
- The expired path offers Renew and never lets an expired member in silently.
- The owner sees today's collected total and renewals due.
- A staff account cannot read revenue totals, expenses, or void a payment (tested).
- Changing the price in the browser dev tools changes nothing (tested).
- A check-in at 11:30 PM Manila time counts on that day (tested).

**Manual test checklist.** Seed 3 members (active, expiring, expired). Run each flow. Void a payment as owner; confirm audit row and that totals update. Try the same void as staff; confirm it is refused.
