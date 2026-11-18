-- Laced schema: tables, constraints, indexes.
-- Money is integer centavos. Timestamps are timestamptz. "Today" is always Asia/Manila.
-- Access rules (row-level security) are in a later migration; nothing here is readable
-- by the app until those policies exist.

-- ---------------------------------------------------------------------------
-- Date helpers
-- ---------------------------------------------------------------------------

-- The calendar date in Manila for a moment in time. 11:30 PM in Manila is still
-- "today" there, even though it is already tomorrow in UTC terms for some zones.
create function public.manila_date(ts timestamptz)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (ts at time zone 'Asia/Manila')::date
$$;

create function public.manila_today()
returns date
language sql
stable
set search_path = ''
as $$
  select public.manila_date(now())
$$;

-- Inclusive end date: a 1-month plan starting Nov 16 ends Dec 15.
create function public.membership_end(p_start date, p_months integer)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (p_start + make_interval(months => p_months))::date - 1
$$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per person who can sign in to the desk app. The id is the Supabase
-- Auth user id, so a login without a row here can do nothing.
create table public.staff (
  id         uuid primary key references auth.users (id) on delete restrict,
  full_name  text not null check (char_length(btrim(full_name)) between 2 and 80),
  role       text not null check (role in ('owner', 'staff')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.members (
  id           uuid primary key default gen_random_uuid(),
  member_no    bigint generated always as identity unique,
  full_name    text not null check (char_length(btrim(full_name)) between 2 and 80),
  phone        text check (phone ~ '^09[0-9]{9}$'),
  consent_at   timestamptz not null,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_by   uuid references public.staff (id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- A phone is required for a live member. Only an anonymised (deleted) member may have none.
  constraint members_phone_required check (deleted_at is not null or phone is not null)
);

create unique index members_phone_key on public.members (phone);

-- ---------------------------------------------------------------------------
-- Plans and memberships
-- ---------------------------------------------------------------------------

-- Prices live here, never in app code. A plan is either a day pass
-- (duration_days) or a membership (duration_months, plus optional bonus months).
create table public.plans (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  category        text not null check (category in ('regular', 'student', 'trainer', 'promo')),
  duration_days   integer check (duration_days > 0),
  duration_months integer check (duration_months > 0),
  bonus_months    integer not null default 0 check (bonus_months >= 0),
  price_centavos  integer not null check (price_centavos > 0),
  active          boolean not null default true,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  constraint plans_one_duration check (num_nonnulls(duration_days, duration_months) = 1)
);

create table public.memberships (
  id                    uuid primary key default gen_random_uuid(),
  member_id             uuid not null references public.members (id),
  plan_id               uuid not null references public.plans (id),
  start_date            date not null,
  end_date              date not null,
  kind                  text not null check (kind in ('new', 'renewal', 'returning', 'day_pass')),
  student_id_checked    boolean not null default false,
  student_id_checked_on date,
  created_by            uuid not null references public.staff (id),
  created_at            timestamptz not null default now(),
  -- Set when the payment behind this membership is voided; a voided membership grants no access.
  voided_at             timestamptz,
  constraint memberships_dates check (end_date >= start_date)
);

create index memberships_member_end_idx on public.memberships (member_id, end_date desc);
create index memberships_end_idx on public.memberships (end_date);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

-- Payments are never deleted. A mistake is voided with a reason.
-- amount_centavos is the plan price at the time of sale, so later price changes
-- do not rewrite history. Collected = amount_centavos - discount_centavos.
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  member_id            uuid references public.members (id),
  membership_id        uuid references public.memberships (id),
  guest_name           text check (char_length(btrim(guest_name)) between 2 and 80),
  plan_id              uuid not null references public.plans (id),
  amount_centavos      integer not null check (amount_centavos > 0),
  discount_centavos    integer not null default 0,
  discount_reason      text,
  discount_approved_by uuid references public.staff (id),
  method               text not null check (method in ('cash', 'gcash')),
  gcash_ref            text check (gcash_ref ~ '^[A-Za-z0-9]{6,30}$'),
  received_by          uuid not null references public.staff (id),
  paid_at              timestamptz not null default now(),
  voided_at            timestamptz,
  voided_by            uuid references public.staff (id),
  void_reason          text,
  -- Paid by a member or by a named walk-in guest, never both, never neither.
  constraint payments_one_payer check (num_nonnulls(member_id, guest_name) = 1),
  constraint payments_discount_range check (discount_centavos >= 0 and discount_centavos < amount_centavos),
  constraint payments_discount_needs_reason check (
    discount_centavos = 0 or (discount_reason is not null and discount_approved_by is not null)
  ),
  -- A GCash payment must carry its reference number; a cash payment must not.
  constraint payments_gcash_ref check ((method = 'gcash') = (gcash_ref is not null)),
  constraint payments_void_complete check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and char_length(btrim(void_reason)) >= 3)
  )
);

-- The same GCash reference cannot be recorded twice, unless the first was voided.
create unique index payments_gcash_ref_key on public.payments (gcash_ref) where voided_at is null;
create index payments_paid_at_idx on public.payments (paid_at);
create index payments_received_by_idx on public.payments (received_by, paid_at);
create index payments_member_idx on public.payments (member_id);

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (char_length(btrim(category)) between 2 and 40),
  amount_centavos integer not null check (amount_centavos > 0),
  spent_on        date not null,
  note            text,
  recorded_by     uuid not null references public.staff (id),
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references public.staff (id),
  void_reason     text
);

create table public.daily_closes (
  id                      uuid primary key default gen_random_uuid(),
  close_date              date not null unique,
  expected_cash_centavos  integer not null check (expected_cash_centavos >= 0),
  counted_cash_centavos   integer not null check (counted_cash_centavos >= 0),
  expected_gcash_centavos integer not null check (expected_gcash_centavos >= 0),
  counted_gcash_centavos  integer not null check (counted_gcash_centavos >= 0),
  closed_by               uuid not null references public.staff (id),
  note                    text,
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------

create table public.checkins (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid references public.members (id),
  membership_id     uuid references public.memberships (id),
  guest_name        text check (char_length(btrim(guest_name)) between 2 and 80),
  checked_in_at     timestamptz not null default now(),
  -- The Manila calendar day of the visit, worked out by the database.
  visit_date        date generated always as (public.manila_date(checked_in_at)) stored,
  method            text not null check (method in ('search', 'qr', 'nfc', 'self')),
  staff_id          uuid not null references public.staff (id),
  status_at_checkin text not null check (status_at_checkin in ('active', 'expiring', 'expired', 'day_pass')),
  override_reason   text,
  constraint checkins_one_visitor check (num_nonnulls(member_id, guest_name) = 1),
  -- Letting an expired member in is allowed only with a written reason.
  constraint checkins_expired_needs_reason check (
    status_at_checkin <> 'expired' or char_length(btrim(override_reason)) >= 3
  )
);

-- One check-in per member per day, so a double tap on two desk phones cannot count twice.
create unique index checkins_member_day_key on public.checkins (member_id, visit_date) where member_id is not null;
create index checkins_visit_date_idx on public.checkins (visit_date);

-- Cards are identifiers, not passwords: a random token, no personal data.
create table public.cards (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.members (id),
  token          text not null unique
                 default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  kind           text not null check (kind in ('qr', 'nfc')),
  active         boolean not null default true,
  issued_at      timestamptz not null default now(),
  deactivated_at timestamptz
);

create index cards_member_idx on public.cards (member_id);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

-- Append-only record of every change to money, plans, and staff accounts.
create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid not null,
  action     text not null check (action in ('insert', 'update', 'delete')),
  old        jsonb,
  new        jsonb,
  actor      uuid,
  at         timestamptz not null default now()
);

create index audit_log_row_idx on public.audit_log (table_name, row_id);
