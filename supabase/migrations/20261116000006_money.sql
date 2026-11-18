-- Phase 2: voiding payments and expenses, closing the day, and the owner's money totals.

-- ---------------------------------------------------------------------------
-- Void a payment (owner only)
-- ---------------------------------------------------------------------------

-- A payment is never deleted. Voiding keeps the row, records who voided it and
-- why, and cancels the membership that payment paid for. The audit trigger on
-- payments logs the change automatically.
create function public.void_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason  text := btrim(coalesce(p_reason, ''));
  v_payment public.payments%rowtype;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can void a payment' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason for voiding this payment';
  end if;

  select * into v_payment from public.payments p where p.id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.voided_at is not null then
    raise exception 'This payment is already voided';
  end if;

  update public.payments
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where id = p_payment_id;

  if v_payment.membership_id is not null then
    update public.memberships set voided_at = now() where id = v_payment.membership_id;
  end if;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'membership_voided', v_payment.membership_id is not null
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Void an expense (owner only)
-- ---------------------------------------------------------------------------

create function public.void_expense(p_expense_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_owner() then
    raise exception 'Only the owner can void an expense' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason for voiding this expense';
  end if;

  update public.expenses
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = v_reason
  where id = p_expense_id and voided_at is null;
  if not found then
    raise exception 'Expense not found or already voided';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Close the day
-- ---------------------------------------------------------------------------

-- A blind count: whoever closes types in what they counted, and the database
-- compares it with the records. Staff are told only that the day is closed.
-- The expected amounts and the difference go to the owner. This way a count
-- cannot be adjusted to match the records.
create function public.close_day(
  p_counted_cash_centavos  integer,
  p_counted_gcash_centavos integer,
  p_note                   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today          date := public.manila_today();
  v_expected_cash  integer;
  v_expected_gcash integer;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_counted_cash_centavos is null or p_counted_cash_centavos < 0
     or p_counted_gcash_centavos is null or p_counted_gcash_centavos < 0 then
    raise exception 'Enter the counted cash and the GCash total (0 if none)';
  end if;

  select
    coalesce(sum(p.amount_centavos - p.discount_centavos) filter (where p.method = 'cash'), 0),
    coalesce(sum(p.amount_centavos - p.discount_centavos) filter (where p.method = 'gcash'), 0)
  into v_expected_cash, v_expected_gcash
  from public.payments p
  where p.voided_at is null and public.manila_date(p.paid_at) = v_today;

  begin
    insert into public.daily_closes
      (close_date, expected_cash_centavos, counted_cash_centavos,
       expected_gcash_centavos, counted_gcash_centavos, closed_by, note)
    values
      (v_today, v_expected_cash, p_counted_cash_centavos,
       v_expected_gcash, p_counted_gcash_centavos, (select auth.uid()),
       nullif(btrim(coalesce(p_note, '')), ''));
  exception when unique_violation then
    raise exception 'Today is already closed';
  end;

  if public.is_owner() then
    return jsonb_build_object(
      'close_date', v_today,
      'expected_cash_centavos', v_expected_cash,
      'expected_gcash_centavos', v_expected_gcash
    );
  end if;
  return jsonb_build_object('close_date', v_today);
end
$$;

-- Lets the desk know whether today still needs closing.
create function public.is_day_closed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_staff()
     and exists (select 1 from public.daily_closes c where c.close_date = public.manila_today())
$$;

-- Daily closes hold the gym's expected totals, so only the owner may read them.
-- (The earlier policy let staff read the rows they closed.)
drop policy daily_closes_select on public.daily_closes;
create policy daily_closes_select on public.daily_closes for select to authenticated
  using ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- Money totals for the owner
-- ---------------------------------------------------------------------------

-- One row of totals for the last N Manila days. Staff get no rows.
create function public.analytics_money(p_days integer default 14)
returns table (
  revenue_centavos  bigint,
  cash_centavos     bigint,
  gcash_centavos    bigint,
  expenses_centavos bigint,
  void_count        bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select public.manila_today() - (least(greatest(p_days, 1), 90) - 1) as first_day
  ),
  paid as (
    select p.amount_centavos - p.discount_centavos as collected, p.method, p.voided_at
    from public.payments p, bounds b
    where public.manila_date(p.paid_at) >= b.first_day
  )
  select
    coalesce(sum(collected) filter (where voided_at is null), 0)::bigint,
    coalesce(sum(collected) filter (where voided_at is null and method = 'cash'), 0)::bigint,
    coalesce(sum(collected) filter (where voided_at is null and method = 'gcash'), 0)::bigint,
    (
      select coalesce(sum(e.amount_centavos), 0)
      from public.expenses e, bounds b
      where e.voided_at is null and e.spent_on >= b.first_day
    )::bigint,
    count(*) filter (where voided_at is not null)
  from paid
  where public.is_owner()
  having public.is_owner()
$$;

-- Revenue per plan for the last N Manila days, highest first. Staff get no rows.
create function public.analytics_plans(p_days integer default 14)
returns table (plan_name text, revenue_centavos bigint, sales bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select pl.name, sum(p.amount_centavos - p.discount_centavos)::bigint, count(*)
  from public.payments p
  join public.plans pl on pl.id = p.plan_id
  where public.is_owner()
    and p.voided_at is null
    and public.manila_date(p.paid_at) >= public.manila_today() - (least(greatest(p_days, 1), 90) - 1)
  group by pl.name
  order by 2 desc, pl.name
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.void_payment(uuid, text) from public, anon;
revoke execute on function public.void_expense(uuid, text) from public, anon;
revoke execute on function public.close_day(integer, integer, text) from public, anon;
revoke execute on function public.is_day_closed() from public, anon;
revoke execute on function public.analytics_money(integer) from public, anon;
revoke execute on function public.analytics_plans(integer) from public, anon;

grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.void_expense(uuid, text) to authenticated;
grant execute on function public.close_day(integer, integer, text) to authenticated;
grant execute on function public.is_day_closed() to authenticated;
grant execute on function public.analytics_money(integer) to authenticated;
grant execute on function public.analytics_plans(integer) to authenticated;
