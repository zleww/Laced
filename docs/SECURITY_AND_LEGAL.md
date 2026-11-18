# Security and legal — Laced

Last updated: 2026-11-16. This is not legal advice. Law notes say what the law generally says, flag the risk, and say when to ask a lawyer or the school. Laws change and details below marked "verify" came from general knowledge and must be checked against current sources before launch.

## 1. What is at stake

- **Personal data:** members' names and mobile numbers, visit history, and later (gym-goer app) lift logs.
- **Money records:** every payment, discount, void, and the owner's expenses and revenue.
- **Who could cause harm:** a staff member skimming cash or editing records; a member sharing a card; an outsider guessing URLs or abusing public endpoints; an accidental leak (keys in git, a public table); the developer's own mistakes.

## 2. Access control (row-level security matrix)

Enable RLS on **every** table. Default deny. Staff and owner identity comes from `staff.role` via `is_owner()` / `is_staff()` helper functions.

| Table | Owner | Staff | Member (later) |
|---|---|---|---|
| `members` | all | select, insert, update (no hard delete) | own row, read only |
| `plans` | all | select | select |
| `memberships` | all | select, insert (via RPC) | own rows, read only |
| `payments` | select all, void | insert via RPC only; select **only own today's** rows | none |
| `checkins` | all | insert via RPC; select today's | own rows, read only |
| `cards` | all | select, insert, deactivate | none |
| `expenses` | all | **none** | none |
| `daily_closes` | all | insert via RPC; select own | none |
| `audit_log` | select | none | none |
| `employees` | all | **none** | none |
| `payroll_entries` | select; write via RPC | **none** | none |
| `workouts`, `workout_sets` (later) | **none by default** | **none** | own rows, full |

Rules:
- **Staff cannot read revenue totals, expenses, other staff's collections, or the audit log.**
- Money-changing actions go through **RPC functions** (`security definer`, `set search_path = public`) that check the caller's role and compute the price on the server. Revoke `execute` from `public`; grant only to `authenticated`.
- A plain Postgres view runs with the view owner's rights and **bypasses RLS**. Use functions with an `is_owner()` check (or `security_invoker` views) for anything owner-only.
- The Supabase `service_role` key is **server-side only**, never in browser code, never in git. The `anon` key is public by design, so RLS is the real lock. A table without RLS is public.
- Disable public sign-up. The owner invites staff. Members (later) get logins only through a controlled flow.

## 3. Authentication

- Use Supabase Auth (passwords are hashed for you). Never roll your own.
- One account per staff member. Owner account has **MFA** (TOTP).
- Rate limiting on login (Supabase Auth limits; verify the current defaults). Strong password minimum. No password in any log.
- Session cookies: `HttpOnly`, `Secure`, `SameSite`. Short idle timeout on the shared desk phone; require re-login after inactivity.
- Offboarding: deactivate the staff row and revoke the session the same day.
- Any future public endpoint (self check-in by QR) needs rate limiting and bot protection, and must never reveal whether a phone number is registered.

## 4. Money integrity

- Price is **always looked up server-side** from `plans`. The browser sends ids, never amounts.
- Payments are **void-only**, with reason, actor, and time, written to `audit_log`.
- Discounts: owner only, with a reason.
- Audit log is append-only (no update or delete grants).
- Daily close compares expected and counted cash, and GCash totals, and stores the variance. Owner can see void counts, discount counts, and variance trends per staff member.
- Money as integer centavos. Payment and membership created in one transaction.

## 5. Application security checklist (OWASP-minded)

- **XSS:** render all user-supplied text (names, notes, GCash refs) as text. No `dangerouslySetInnerHTML` or `innerHTML` with data. Tooltips and tables use `textContent`.
- **Injection:** use the Supabase client and parameterised RPC arguments. No string-built SQL.
- **Validation twice:** in the UI for speed, and in the database (check constraints: phone format `^09\d{9}$`, `amount_centavos > 0`, `gcash_ref` required when `method = 'gcash'`).
- **Secrets:** `.env*` in `.gitignore`, `.env.example` with fake values, scan git history (for example with gitleaks) before the first push and in CI, rotate any key that ever touched git.
- **Transport and headers:** HTTPS only (Vercel/Supabase enforce it). Set a Content Security Policy, `X-Content-Type-Options`, `Referrer-Policy`, and frame protection.
- **Dependencies:** delete unused packages, run `npm audit`, pin versions, review new packages before adding.
- **Debug off** in production. Errors shown to users never include stack traces or raw database messages.
- **Uploads:** none in v1. If member photos are ever added: private storage bucket, signed URLs, limit file type and size, strip metadata, and get explicit consent.
- **CORS** restricted to the app's own origin.
- **Backups:** schedule a regular export of payments and members (CSV or `pg_dump`) to a place the owner controls. **Verify what backups the current Supabase plan includes**; do not assume. Test a restore once.
- **Logs** must not contain phone numbers or full names.

## 6. Data protection and privacy (Philippines)

### Data Privacy Act of 2012 (RA 10173)
- In general, the gym owner decides why and how member data is used (the **personal information controller**), and the developer who builds and maintains the system acts for him (a **processor**). Put the roles, what data is stored, who can access it, and security duties in a **short written agreement** with the owner. Ask a lawyer or the school to review it.
- **Collect only what is needed:** full name and mobile number. No address, birthday, ID photo, or health details in v1. Day-pass guests: **name only (decided)**, stored as `guest_name` on the payment and check-in rows. No phone. Show a one-line notice on the day-pass sheet (see starter text below).
- **Consent and notice:** show a consent line and a short privacy notice at registration; store `consent_at`.
- **Data subject rights:** members can ask to see, correct, and delete their data. Provide a way: **soft-delete and anonymise** the member (keep payment rows for accounting, replace the name and phone with a placeholder). Ask a lawyer about how long financial records must be kept.
- **Sensitive personal information** includes health information. Lift logs plus body metrics may count. Keep them in separate member-owned tables, off by default for staff and owner, consent-based, and deletable.
- **Security measures** must be organizational, physical, and technical. This document is the technical part; also decide who has the desk phone and where it sits.
- **Breach duty:** the law has breach-notification duties to the National Privacy Commission and affected people with short deadlines (generally cited as 72 hours). **Verify current NPC rules and registration thresholds** before launch.
- Do not use member data for marketing without separate consent. Texts or emails need an unsubscribe route.

### Cybercrime Prevention Act of 2012 (RA 10175)
- Do not access, probe, or test any system without ownership or written permission. This includes the gym's own Wi-Fi and other businesses' systems.
- Keep production credentials limited. Do not share the owner or staff passwords. Do not keep admin access you do not need.

### Intellectual Property Code (RA 8293) and licensing
- Check licenses of libraries, fonts, icons, and any images. Prefer permissive licenses. Do not use the gym's or a brand's logo without permission.
- Agree in writing who owns the code (the developer, for portfolio use) and who owns the data (the owner). Ask before putting the project in a public repo or portfolio: no real member data, no real prices if the owner objects, no screenshots with real names.

### Consumer protection and terms
- Charged prices must match posted prices. No hidden fees, no dark patterns. Show the plan, price, and validity dates before collecting payment.
- Decide and display a refund and membership-freeze policy. Consumer protection rules (for example the Consumer Act, RA 7394) may apply; **verify** and ask a lawyer.
- Gym waiver or liability forms are the owner's legal matter, not this system's; do not draft them as legal advice.

### Starter text (a starting point, not final; check against the Data Privacy Act before launch)

Consent line at registration:
> I agree that {Gym name} may store my name and mobile number to manage my membership, record my gym visits, and record my payments. I can ask to see, correct, or delete my information at any time by asking the front desk.

Notice line on the day-pass sheet (staff read or show it to the guest):
> {Gym name} records your name with today's payment and visit. Ask the front desk to see or correct it.

`{Gym name}` must be the gym's real name before launch, because the gym (not the app) is responsible for the data. The prototype can show a placeholder.

Privacy notice outline (one short screen): what we collect; why; who can see it (the owner and front-desk staff); how long we keep it; how to ask for access, correction, or deletion; who to contact.

## 7. Pre-launch checklist (run before any real member uses it)

Report each item as done, missing, or not applicable, then help fix the missing ones.

**Security**
- [ ] All passwords handled by Supabase Auth; owner MFA on
- [ ] Public sign-up disabled
- [ ] HTTPS forced; secure, HttpOnly cookies
- [ ] XSS blocked: user input rendered as text everywhere
- [ ] Login rate limiting confirmed
- [ ] Uploads limited by type and size (or none exist)
- [ ] Debug mode off; no stack traces shown
- [ ] Unused packages removed; `npm audit` reviewed
- [ ] Git history scanned for leaked keys; no `.env` committed
- [ ] `service_role` and other keys server-side only
- [ ] RLS enabled on every table; staff-cannot-read-revenue test passes
- [ ] Prices validated on the server; browser tampering test passes
- [ ] Voids, discounts, and edits are audit-logged

**Paid API cost protection**
- [ ] Not applicable in v1 (no paid APIs). If SMS, email, or any paid API is added later: usage limits per user, capped retries, alerts for abnormal usage, bot protection on the endpoint, and an estimate of the worst-case daily cost.

**Legal and compliance**
- [ ] Privacy notice and consent line at registration
- [ ] Terms of use for staff accounts, refund and membership policy posted
- [ ] Collect only needed data; third-party SDKs and services audited
- [ ] Data deletion route works (soft-delete and anonymise)
- [ ] No dark patterns, no hidden fees, no unsupported claims, no fake reviews
- [ ] Licensed fonts, icons, images only
- [ ] Business details shown (gym name)
- [ ] Unsubscribe route if any messaging is added
- [ ] Written agreement with the owner on data and code ownership and hosting
- [ ] Reviewed against the Data Privacy Act by a lawyer or the school

**Accessibility**
- [ ] Alt text, color contrast (see `DESIGN_SYSTEM.md`), keyboard navigation, status not color-only

**Payments and flow**
- [ ] Full flow tested: register, sell (cash and GCash), renew early, expired renewal, day pass, check in, void, close day
- [ ] Database state checked after each flow; Manila timezone boundary test passes
- [ ] 2-week parallel run with paper planned; active members imported

## 8. If something goes wrong

- Staff account suspected compromised: deactivate it, rotate the keys, review the audit log, tell the owner.
- Key leaked in git: rotate immediately (removing the commit is not enough), then clean history.
- Data exposure: note what, when, and whose; tell the owner the same day; follow the breach-notification duties (verify the deadline) and get legal advice.
