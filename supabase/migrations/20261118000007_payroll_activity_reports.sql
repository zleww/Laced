-- Phase 2b: payroll, the activity log, and monthly reports. All owner only.

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------

-- Everyone the gym pays: desk staff, coaches, cleaners. An employee does not
-- need a login, so this is separate from the staff table.
create table public.employees (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null check (char_length(btrim(full_name)) between 2 and 80),
  job_title             text not null check (char_length(btrim(job_title)) between 2 and 40),
  monthly_rate_centavos integer not null check (monthly_rate_centavos > 0),
  -- Off for workers the gym does not register with SSS, PhilHealth, and Pag-IBIG.
  with_contributions    boolean not null default true,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Government contributions and withholding tax
-- ---------------------------------------------------------------------------

-- Works out one month's deductions from a monthly gross pay, in centavos.
-- Rates as of 2026. Check them every January against SSS, PhilHealth,
-- Pag-IBIG, and BIR announcements, and change them here in a new migration.
--   SSS: 15% of the monthly salary credit (MSC), employee 5%, employer 10%.
--        MSC is the pay rounded to the nearest 500, from 5,000 to 35,000.
--        Employer also pays EC: 10 below an MSC of 15,000, otherwise 30.
--   PhilHealth: 5% of pay (floor 10,000, ceiling 100,000), split evenly.
--   Pag-IBIG: 2% each of pay up to 10,000 (employee 1% when pay is 1,500 or less).
--   Withholding tax: BIR monthly table in force since 2023 (TRAIN law), on
--        pay minus the employee's contributions.
create function public.payroll_deductions(p_gross_centavos integer, p_with_contributions boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_gross   numeric := p_gross_centavos / 100.0;
  v_msc     numeric;
  v_ph_base numeric;
  v_pi_base numeric;
  v_sss_ee  numeric := 0;
  v_sss_er  numeric := 0;
  v_sss_ec  numeric := 0;
  v_ph_ee   numeric := 0;
  v_ph_er   numeric := 0;
  v_pi_ee   numeric := 0;
  v_pi_er   numeric := 0;
  v_taxable numeric;
  v_tax     numeric;
begin
  if p_gross_centavos is null or p_gross_centavos <= 0 then
    raise exception 'Enter the gross pay';
  end if;

  if p_with_contributions then
    v_msc := least(greatest(500 * floor((v_gross + 250) / 500), 5000), 35000);
    v_sss_ee := v_msc * 0.05;
    v_sss_er := v_msc * 0.10;
    v_sss_ec := case when v_msc < 15000 then 10 else 30 end;

    v_ph_base := least(greatest(v_gross, 10000), 100000);
    v_ph_ee := round(v_ph_base * 0.025, 2);
    v_ph_er := round(v_ph_base * 0.025, 2);

    v_pi_base := least(v_gross, 10000);
    v_pi_ee := round(v_pi_base * case when v_gross <= 1500 then 0.01 else 0.02 end, 2);
    v_pi_er := round(v_pi_base * 0.02, 2);
  end if;

  v_taxable := greatest(v_gross - v_sss_ee - v_ph_ee - v_pi_ee, 0);
  v_tax := round(case
    when v_taxable <= 20833  then 0
    when v_taxable <  33333  then (v_taxable - 20833) * 0.15
    when v_taxable <  66667  then 1875.00   + (v_taxable - 33333) * 0.20
    when v_taxable <  166667 then 8541.80   + (v_taxable - 66667) * 0.25
    when v_taxable <  666667 then 33541.80  + (v_taxable - 166667) * 0.30
    else                          183541.80 + (v_taxable - 666667) * 0.35
  end, 2);

  return jsonb_build_object(
    'sss_ee', (v_sss_ee * 100)::integer,
    'sss_er', (v_sss_er * 100)::integer,
    'sss_ec', (v_sss_ec * 100)::integer,
    'philhealth_ee', (v_ph_ee * 100)::integer,
    'philhealth_er', (v_ph_er * 100)::integer,
    'pagibig_ee', (v_pi_ee * 100)::integer,
    'pagibig_er', (v_pi_er * 100)::integer,
    'tax', (v_tax * 100)::integer
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Payroll entries
-- ---------------------------------------------------------------------------

-- One entry per employee per month. Amounts are copied in when the entry is
-- saved, so a later rate change does not rewrite past payslips.
create table public.payroll_entries (
  id                       uuid primary key default gen_random_uuid(),
  employee_id              uuid not null references public.employees (id),
  period_month             date not null check (extract(day from period_month) = 1),
  gross_centavos           integer not null check (gross_centavos > 0),
  sss_ee_centavos          integer not null default 0 check (sss_ee_centavos >= 0),
  philhealth_ee_centavos   integer not null default 0 check (philhealth_ee_centavos >= 0),
  pagibig_ee_centavos      integer not null default 0 check (pagibig_ee_centavos >= 0),
  tax_centavos             integer not null default 0 check (tax_centavos >= 0),
  other_deductions_centavos integer not null default 0 check (other_deductions_centavos >= 0),
  other_note               text,
  net_centavos             integer not null,
  sss_er_centavos          integer not null default 0,
  sss_ec_centavos          integer not null default 0,
  philhealth_er_centavos   integer not null default 0,
  pagibig_er_centavos      integer not null default 0,
  status                   text not null default 'draft' check (status in ('draft', 'paid')),
  paid_at                  timestamptz,
  created_by               uuid not null references public.staff (id),
  created_at               timestamptz not null default now(),
  voided_at                timestamptz,
  voided_by                uuid references public.staff (id),
  void_reason              text,
  constraint payroll_net_matches check (
    net_centavos = gross_centavos - sss_ee_centavos - philhealth_ee_centavos
                   - pagibig_ee_centavos - tax_centavos - other_deductions_centavos
  ),
  constraint payroll_paid_complete check ((status = 'paid') = (paid_at is not null)),
  constraint payroll_void_complete check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and char_length(btrim(void_reason)) >= 3)
  )
);

create unique index payroll_one_per_month_key
  on public.payroll_entries (employee_id, period_month) where voided_at is null;

create trigger audit_employees after insert or update or delete on public.employees
  for each row execute function public.audit_row();
create trigger audit_payroll after insert or update or delete on public.payroll_entries
  for each row execute function public.audit_row();

-- Creates or recalculates a draft payroll entry. A paid entry cannot be changed;
-- void it first.
create function public.save_payroll_entry(
  p_employee_id    uuid,
  p_period_month   date,
  p_gross_centavos integer,
  p_other_centavos integer default 0,
  p_other_note     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_month    date := date_trunc('month', p_period_month)::date;
  v_d        jsonb;
  v_other    integer := coalesce(p_other_centavos, 0);
  v_net      integer;
  v_existing public.payroll_entries%rowtype;
  v_id       uuid;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can manage payroll' using errcode = '42501';
  end if;
  select * into v_employee from public.employees e where e.id = p_employee_id;
  if not found then
    raise exception 'Employee not found';
  end if;
  if v_other < 0 then
    raise exception 'Other deductions cannot be negative';
  end if;

  v_d := public.payroll_deductions(p_gross_centavos, v_employee.with_contributions);
  v_net := p_gross_centavos - (v_d->>'sss_ee')::int - (v_d->>'philhealth_ee')::int
           - (v_d->>'pagibig_ee')::int - (v_d->>'tax')::int - v_other;
  if v_net < 0 then
    raise exception 'Deductions are more than the gross pay';
  end if;

  select * into v_existing from public.payroll_entries pe
  where pe.employee_id = p_employee_id and pe.period_month = v_month and pe.voided_at is null
  for update;

  if found and v_existing.status = 'paid' then
    raise exception 'This month is already paid. Void it first to change it.';
  end if;

  if found then
    update public.payroll_entries set
      gross_centavos = p_gross_centavos,
      sss_ee_centavos = (v_d->>'sss_ee')::int,
      philhealth_ee_centavos = (v_d->>'philhealth_ee')::int,
      pagibig_ee_centavos = (v_d->>'pagibig_ee')::int,
      tax_centavos = (v_d->>'tax')::int,
      other_deductions_centavos = v_other,
      other_note = nullif(btrim(coalesce(p_other_note, '')), ''),
      net_centavos = v_net,
      sss_er_centavos = (v_d->>'sss_er')::int,
      sss_ec_centavos = (v_d->>'sss_ec')::int,
      philhealth_er_centavos = (v_d->>'philhealth_er')::int,
      pagibig_er_centavos = (v_d->>'pagibig_er')::int
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.payroll_entries (
    employee_id, period_month, gross_centavos,
    sss_ee_centavos, philhealth_ee_centavos, pagibig_ee_centavos, tax_centavos,
    other_deductions_centavos, other_note, net_centavos,
    sss_er_centavos, sss_ec_centavos, philhealth_er_centavos, pagibig_er_centavos,
    created_by
  ) values (
    p_employee_id, v_month, p_gross_centavos,
    (v_d->>'sss_ee')::int, (v_d->>'philhealth_ee')::int, (v_d->>'pagibig_ee')::int, (v_d->>'tax')::int,
    v_other, nullif(btrim(coalesce(p_other_note, '')), ''), v_net,
    (v_d->>'sss_er')::int, (v_d->>'sss_ec')::int, (v_d->>'philhealth_er')::int, (v_d->>'pagibig_er')::int,
    (select auth.uid())
  ) returning id into v_id;
  return v_id;
end
$$;

create function public.mark_payroll_paid(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can manage payroll' using errcode = '42501';
  end if;
  update public.payroll_entries set status = 'paid', paid_at = now()
  where id = p_entry_id and status = 'draft' and voided_at is null;
  if not found then
    raise exception 'Entry not found, already paid, or voided';
  end if;
end
$$;

create function public.void_payroll_entry(p_entry_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_owner() then
    raise exception 'Only the owner can manage payroll' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason for voiding this entry';
  end if;
  update public.payroll_entries
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where id = p_entry_id and voided_at is null;
  if not found then
    raise exception 'Entry not found or already voided';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------

-- What happened, who did it, newest first, in plain words. Built from the
-- records themselves, so it cannot drift from them. Staff get no rows.
create function public.activity_feed(
  p_limit  integer default 100,
  p_before timestamptz default null,
  p_kind   text default null
)
returns table (at timestamptz, actor text, kind text, summary text, amount_centavos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.at, f.actor, f.kind, f.summary, f.amount_centavos
  from (
    select p.paid_at as at, s.full_name as actor, 'sale' as kind,
           pl.name || ' for ' || coalesce(m.full_name, p.guest_name, 'a guest') ||
             ' (' || case p.method when 'gcash' then 'GCash' else 'cash' end || ')' as summary,
           (p.amount_centavos - p.discount_centavos)::bigint as amount_centavos
    from public.payments p
    join public.plans pl on pl.id = p.plan_id
    join public.staff s on s.id = p.received_by
    left join public.members m on m.id = p.member_id

    union all
    select p.voided_at, s.full_name, 'void',
           'Voided ' || pl.name || ' for ' || coalesce(m.full_name, p.guest_name, 'a guest') ||
             ': ' || p.void_reason,
           (p.amount_centavos - p.discount_centavos)::bigint
    from public.payments p
    join public.plans pl on pl.id = p.plan_id
    join public.staff s on s.id = p.voided_by
    left join public.members m on m.id = p.member_id
    where p.voided_at is not null

    union all
    select e.created_at, s.full_name, 'expense',
           e.category || coalesce(': ' || e.note, ''), e.amount_centavos::bigint
    from public.expenses e join public.staff s on s.id = e.recorded_by

    union all
    select e.voided_at, s.full_name, 'void', 'Voided expense ' || e.category || ': ' || e.void_reason,
           e.amount_centavos::bigint
    from public.expenses e join public.staff s on s.id = e.voided_by
    where e.voided_at is not null

    union all
    select c.created_at, s.full_name, 'close', 'Closed the day ' || to_char(c.close_date, 'Mon DD'),
           (c.counted_cash_centavos + c.counted_gcash_centavos)::bigint
    from public.daily_closes c join public.staff s on s.id = c.closed_by

    union all
    select m.created_at, coalesce(s.full_name, 'Unknown'), 'member',
           case when m.deleted_at is null then 'Registered ' || m.full_name else 'Registered a member' end,
           null::bigint
    from public.members m left join public.staff s on s.id = m.created_by

    union all
    select c.checked_in_at, s.full_name, 'checkin',
           'Checked in ' || coalesce(m.full_name, c.guest_name, 'a guest') ||
             coalesce(' (override: ' || c.override_reason || ')', ''),
           null::bigint
    from public.checkins c
    join public.staff s on s.id = c.staff_id
    left join public.members m on m.id = c.member_id

    union all
    select a.at, coalesce(s.full_name, 'System'), 'payroll',
           case
             when a.action = 'insert' then 'Drafted pay for ' || e.full_name || ', ' || to_char((a.new->>'period_month')::date, 'Mon YYYY')
             when a.new->>'voided_at' is not null and a.old->>'voided_at' is null then 'Voided pay for ' || e.full_name || ': ' || (a.new->>'void_reason')
             when a.new->>'status' = 'paid' and a.old->>'status' = 'draft' then 'Paid ' || e.full_name || ', ' || to_char((a.new->>'period_month')::date, 'Mon YYYY')
             else 'Recalculated pay for ' || e.full_name
           end,
           (a.new->>'net_centavos')::bigint
    from public.audit_log a
    left join public.staff s on s.id = a.actor
    left join public.employees e on e.id = (a.new->>'employee_id')::uuid
    where a.table_name = 'payroll_entries'

    union all
    select a.at, coalesce(s.full_name, 'System'), 'settings',
           case a.table_name
             when 'plans' then case a.action when 'insert' then 'Added plan ' else 'Changed plan ' end || (a.new->>'name')
             when 'staff' then case a.action when 'insert' then 'Added account ' else 'Changed account ' end || (a.new->>'full_name')
             else case a.action when 'insert' then 'Added employee ' else 'Changed employee ' end || (a.new->>'full_name')
           end,
           null::bigint
    from public.audit_log a
    left join public.staff s on s.id = a.actor
    where a.table_name in ('plans', 'staff', 'employees') and a.new is not null
  ) f
  where public.is_owner()
    and (p_before is null or f.at < p_before)
    and (p_kind is null or f.kind = p_kind)
  order by f.at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;

-- ---------------------------------------------------------------------------
-- Monthly report
-- ---------------------------------------------------------------------------

-- Revenue, expenses, payroll, visits, and new members per Manila month, oldest
-- first, for the last N months (this month included). Staff get no rows.
create function public.analytics_monthly(p_months integer default 12)
returns table (
  month             date,
  revenue_centavos  bigint,
  expenses_centavos bigint,
  payroll_centavos  bigint,
  checkins          bigint,
  new_members       bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', public.manila_today()) - make_interval(months => least(greatest(p_months, 1), 36) - 1),
      date_trunc('month', public.manila_today()),
      interval '1 month'
    )::date as month
  )
  select
    mo.month,
    (select coalesce(sum(p.amount_centavos - p.discount_centavos), 0) from public.payments p
      where p.voided_at is null and date_trunc('month', public.manila_date(p.paid_at)) = mo.month)::bigint,
    (select coalesce(sum(e.amount_centavos), 0) from public.expenses e
      where e.voided_at is null and date_trunc('month', e.spent_on) = mo.month)::bigint,
    (select coalesce(sum(pe.gross_centavos + pe.sss_er_centavos + pe.sss_ec_centavos
                         + pe.philhealth_er_centavos + pe.pagibig_er_centavos), 0)
      from public.payroll_entries pe
      where pe.voided_at is null and pe.status = 'paid' and pe.period_month = mo.month)::bigint,
    (select count(*) from public.checkins c where date_trunc('month', c.visit_date) = mo.month),
    (select count(*) from public.members m where date_trunc('month', public.manila_date(m.created_at)) = mo.month)
  from months mo
  where public.is_owner()
  order by mo.month
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.employees       enable row level security;
alter table public.payroll_entries enable row level security;

revoke all on public.employees, public.payroll_entries from anon, authenticated;
grant select, insert on public.employees to authenticated;
grant update (full_name, job_title, monthly_rate_centavos, with_contributions, active) on public.employees to authenticated;
-- Payroll rows are written only through the functions above.
grant select on public.payroll_entries to authenticated;

create policy employees_select on public.employees for select to authenticated
  using ((select public.is_owner()));
create policy employees_insert on public.employees for insert to authenticated
  with check ((select public.is_owner()));
create policy employees_update on public.employees for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create policy payroll_select on public.payroll_entries for select to authenticated
  using ((select public.is_owner()));

revoke execute on function public.payroll_deductions(integer, boolean) from public, anon;
revoke execute on function public.save_payroll_entry(uuid, date, integer, integer, text) from public, anon;
revoke execute on function public.mark_payroll_paid(uuid) from public, anon;
revoke execute on function public.void_payroll_entry(uuid, text) from public, anon;
revoke execute on function public.activity_feed(integer, timestamptz, text) from public, anon;
revoke execute on function public.analytics_monthly(integer) from public, anon;

grant execute on function public.payroll_deductions(integer, boolean) to authenticated;
grant execute on function public.save_payroll_entry(uuid, date, integer, integer, text) to authenticated;
grant execute on function public.mark_payroll_paid(uuid) to authenticated;
grant execute on function public.void_payroll_entry(uuid, text) to authenticated;
grant execute on function public.activity_feed(integer, timestamptz, text) to authenticated;
grant execute on function public.analytics_monthly(integer) to authenticated;
