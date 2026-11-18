-- Laced functions: who-am-I helpers, the audit trigger, and the actions the app calls.
--
-- Every action below is "security definer": it runs with the database owner's rights,
-- so it can write to tables the caller cannot touch directly. That is why each one
-- starts by checking who the caller is. "set search_path = ''" forces every table
-- name to be written in full (public.members), which blocks a known hijacking trick.

-- ---------------------------------------------------------------------------
-- Who is calling?
-- ---------------------------------------------------------------------------

-- True for any active desk account (the owner counts as staff).
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.id = (select auth.uid()) and s.active
  )
$$;

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.id = (select auth.uid()) and s.active and s.role = 'owner'
  )
$$;

-- ---------------------------------------------------------------------------
-- Audit trigger
-- ---------------------------------------------------------------------------

create function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, row_id, action, new, actor)
    values (tg_table_name, new.id, 'insert', to_jsonb(new), (select auth.uid()));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (table_name, row_id, action, old, new, actor)
    values (tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new), (select auth.uid()));
    return new;
  else
    insert into public.audit_log (table_name, row_id, action, old, actor)
    values (tg_table_name, old.id, 'delete', to_jsonb(old), (select auth.uid()));
    return old;
  end if;
end
$$;

-- Members are left out on purpose: the audit log would keep names and phone
-- numbers after a member asks to be deleted.
create trigger audit_payments     after insert or update or delete on public.payments     for each row execute function public.audit_row();
create trigger audit_memberships  after insert or update or delete on public.memberships  for each row execute function public.audit_row();
create trigger audit_plans        after insert or update or delete on public.plans        for each row execute function public.audit_row();
create trigger audit_staff        after insert or update or delete on public.staff        for each row execute function public.audit_row();
create trigger audit_expenses     after insert or update or delete on public.expenses     for each row execute function public.audit_row();
create trigger audit_daily_closes after insert or update or delete on public.daily_closes for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Member list with live status
-- ---------------------------------------------------------------------------

-- security_invoker makes the view obey the caller's row-level security.
-- Without it a view runs with its owner's rights and would bypass the rules.
create view public.member_overview
with (security_invoker = true)
as
select
  m.id,
  m.member_no,
  m.full_name,
  m.phone,
  m.created_at,
  latest.end_date as valid_until,
  latest.plan_id,
  latest.plan_name,
  latest.end_date - public.manila_today() as days_left,
  case
    when latest.end_date is null then 'none'
    when latest.end_date < public.manila_today() then 'expired'
    when latest.end_date - public.manila_today() <= 7 then 'expiring'
    else 'active'
  end as status
from public.members m
left join lateral (
  select ms.end_date, ms.plan_id, p.name as plan_name
  from public.memberships ms
  join public.plans p on p.id = ms.plan_id
  where ms.member_id = m.id and ms.voided_at is null
  order by ms.end_date desc
  limit 1
) latest on true
where m.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Register a member
-- ---------------------------------------------------------------------------

create function public.register_member(p_full_name text, p_phone text, p_consent boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_member public.members%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'The member must agree to the consent line first';
  end if;

  -- Accept +63 917 123 4567 and store it as 09171234567.
  if v_phone ~ '^639[0-9]{9}$' then
    v_phone := '0' || substr(v_phone, 3);
  end if;
  if v_phone !~ '^09[0-9]{9}$' then
    raise exception 'Enter an 11-digit mobile number that starts with 09';
  end if;

  begin
    insert into public.members (full_name, phone, consent_at, created_by)
    values (btrim(p_full_name), v_phone, now(), (select auth.uid()))
    returning * into v_member;
  exception when unique_violation then
    raise exception 'That phone number is already registered. Search for the member instead.';
  end;

  return jsonb_build_object('member_id', v_member.id, 'member_no', v_member.member_no);
end
$$;

-- ---------------------------------------------------------------------------
-- Sell or renew a membership
-- ---------------------------------------------------------------------------

-- The caller sends ids and the payment method only. The price is read from
-- public.plans here, so nothing the browser sends can change what is charged.
-- Membership and payment are written together or not at all.
create function public.record_membership_payment(
  p_member_id          uuid,
  p_plan_id            uuid,
  p_method             text,
  p_gcash_ref          text default null,
  p_student_id_checked boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff         uuid := (select auth.uid());
  v_today         date := public.manila_today();
  v_plan          public.plans%rowtype;
  v_prev_end      date;
  v_start         date;
  v_end           date;
  v_kind          text;
  v_is_student    boolean;
  v_gcash_ref     text;
  v_membership_id uuid;
  v_payment_id    uuid;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Lock the member row so two phones selling to the same member queue up.
  perform 1 from public.members m where m.id = p_member_id and m.deleted_at is null for update;
  if not found then
    raise exception 'Member not found';
  end if;

  select * into v_plan from public.plans p where p.id = p_plan_id and p.active;
  if not found then
    raise exception 'Plan not found or no longer offered';
  end if;
  if v_plan.duration_months is null then
    raise exception 'This is a day plan. Use the day pass action instead.';
  end if;

  v_is_student := v_plan.category = 'student';
  if v_is_student and p_student_id_checked is not true then
    raise exception 'Check the school ID before selling a student plan';
  end if;

  if p_method = 'gcash' then
    v_gcash_ref := nullif(regexp_replace(coalesce(p_gcash_ref, ''), '\s', '', 'g'), '');
    if v_gcash_ref is null then
      raise exception 'Enter the GCash reference number';
    end if;
  elsif p_method <> 'cash' then
    raise exception 'Payment method must be cash or gcash';
  end if;

  select max(ms.end_date) into v_prev_end
  from public.memberships ms
  where ms.member_id = p_member_id and ms.voided_at is null;

  if v_prev_end is null then
    v_kind := 'new';
    v_start := v_today;
  elsif v_prev_end >= v_today then
    -- Early renewal: continue the day after the current membership ends, so no paid days are lost.
    v_kind := 'renewal';
    v_start := v_prev_end + 1;
  elsif v_today - v_prev_end <= 7 then
    v_kind := 'renewal';
    v_start := v_today;
  else
    v_kind := 'returning';
    v_start := v_today;
  end if;

  v_end := public.membership_end(v_start, v_plan.duration_months + v_plan.bonus_months);

  insert into public.memberships
    (member_id, plan_id, start_date, end_date, kind, student_id_checked, student_id_checked_on, created_by)
  values
    (p_member_id, v_plan.id, v_start, v_end, v_kind, v_is_student,
     case when v_is_student then v_today end, v_staff)
  returning id into v_membership_id;

  begin
    insert into public.payments
      (member_id, membership_id, plan_id, amount_centavos, method, gcash_ref, received_by)
    values
      (p_member_id, v_membership_id, v_plan.id, v_plan.price_centavos, p_method, v_gcash_ref, v_staff)
    returning id into v_payment_id;
  exception
    when unique_violation then
      raise exception 'That GCash reference number is already recorded';
    when check_violation then
      raise exception 'The GCash reference number should be 6 to 30 letters or digits';
  end;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'membership_id', v_membership_id,
    'kind', v_kind,
    'start_date', v_start,
    'end_date', v_end,
    'amount_centavos', v_plan.price_centavos
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Day pass: pay first, then check in, as one action
-- ---------------------------------------------------------------------------

-- For a walk-in guest pass p_guest_name. For a registered member pass p_member_id.
create function public.sell_day_pass(
  p_plan_id            uuid,
  p_method             text,
  p_gcash_ref          text default null,
  p_guest_name         text default null,
  p_member_id          uuid default null,
  p_student_id_checked boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff         uuid := (select auth.uid());
  v_today         date := public.manila_today();
  v_plan          public.plans%rowtype;
  v_guest_name    text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_gcash_ref     text;
  v_membership_id uuid;
  v_payment_id    uuid;
  v_checkin_id    uuid;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if num_nonnulls(v_guest_name, p_member_id) <> 1 then
    raise exception 'Give either the guest''s name or a member, not both';
  end if;
  if v_guest_name is not null and char_length(v_guest_name) not between 2 and 80 then
    raise exception 'Enter the guest''s name (2 to 80 characters)';
  end if;

  select * into v_plan from public.plans p where p.id = p_plan_id and p.active;
  if not found then
    raise exception 'Plan not found or no longer offered';
  end if;
  if v_plan.duration_days is null then
    raise exception 'This is not a day plan';
  end if;
  if v_plan.category = 'student' and p_student_id_checked is not true then
    raise exception 'Check the school ID before selling a student plan';
  end if;

  if p_method = 'gcash' then
    v_gcash_ref := nullif(regexp_replace(coalesce(p_gcash_ref, ''), '\s', '', 'g'), '');
    if v_gcash_ref is null then
      raise exception 'Enter the GCash reference number';
    end if;
  elsif p_method <> 'cash' then
    raise exception 'Payment method must be cash or gcash';
  end if;

  if p_member_id is not null then
    perform 1 from public.members m where m.id = p_member_id and m.deleted_at is null for update;
    if not found then
      raise exception 'Member not found';
    end if;
    if exists (
      select 1 from public.checkins c where c.member_id = p_member_id and c.visit_date = v_today
    ) then
      raise exception 'This member is already checked in today';
    end if;

    insert into public.memberships
      (member_id, plan_id, start_date, end_date, kind, student_id_checked, student_id_checked_on, created_by)
    values
      (p_member_id, v_plan.id, v_today, v_today + v_plan.duration_days - 1, 'day_pass',
       v_plan.category = 'student', case when v_plan.category = 'student' then v_today end, v_staff)
    returning id into v_membership_id;
  end if;

  begin
    insert into public.payments
      (member_id, membership_id, guest_name, plan_id, amount_centavos, method, gcash_ref, received_by)
    values
      (p_member_id, v_membership_id, v_guest_name, v_plan.id, v_plan.price_centavos, p_method, v_gcash_ref, v_staff)
    returning id into v_payment_id;
  exception
    when unique_violation then
      raise exception 'That GCash reference number is already recorded';
    when check_violation then
      raise exception 'The GCash reference number should be 6 to 30 letters or digits';
  end;

  insert into public.checkins (member_id, membership_id, guest_name, method, staff_id, status_at_checkin)
  values (p_member_id, v_membership_id, v_guest_name, 'search', v_staff, 'day_pass')
  returning id into v_checkin_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'checkin_id', v_checkin_id,
    'amount_centavos', v_plan.price_centavos
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Check in a member
-- ---------------------------------------------------------------------------

-- Safe to call twice: the second call on the same day returns the first check-in.
-- An expired member is refused. Only the owner can let them in, with a written reason.
create function public.check_in(
  p_member_id       uuid,
  p_method          text default 'search',
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff         uuid := (select auth.uid());
  v_today         date := public.manila_today();
  v_reason        text := nullif(btrim(coalesce(p_override_reason, '')), '');
  v_membership_id uuid;
  v_end           date;
  v_status        text;
  v_existing      public.checkins%rowtype;
  v_checkin_id    uuid;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_method not in ('search', 'qr', 'nfc') then
    raise exception 'Unknown check-in method';
  end if;

  perform 1 from public.members m where m.id = p_member_id and m.deleted_at is null for update;
  if not found then
    raise exception 'Member not found';
  end if;

  select * into v_existing
  from public.checkins c
  where c.member_id = p_member_id and c.visit_date = v_today;
  if found then
    return jsonb_build_object(
      'checkin_id', v_existing.id,
      'status', v_existing.status_at_checkin,
      'already_checked_in', true,
      'checked_in_at', v_existing.checked_in_at
    );
  end if;

  select ms.id, ms.end_date into v_membership_id, v_end
  from public.memberships ms
  where ms.member_id = p_member_id and ms.voided_at is null
  order by ms.end_date desc
  limit 1;

  if v_end is null or v_end < v_today then
    v_status := 'expired';
  elsif v_end - v_today <= 7 then
    v_status := 'expiring';
  else
    v_status := 'active';
  end if;

  if v_status = 'expired' then
    if not public.is_owner() then
      raise exception 'Membership expired. Renew before checking in.';
    end if;
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'Give a reason for letting an expired member in';
    end if;
  else
    v_reason := null;
  end if;

  insert into public.checkins (member_id, membership_id, method, staff_id, status_at_checkin, override_reason)
  values (p_member_id, v_membership_id, p_method, v_staff, v_status, v_reason)
  returning id into v_checkin_id;

  return jsonb_build_object(
    'checkin_id', v_checkin_id,
    'status', v_status,
    'already_checked_in', false,
    'valid_until', v_end
  );
end
$$;
