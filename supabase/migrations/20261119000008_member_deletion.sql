-- A member's right to have their data deleted (Data Privacy Act, RA 10173).
--
-- Deleting a member wipes their name and phone number and unlinks any login,
-- but keeps their payments, memberships, and visits under an anonymous
-- "Deleted member" record, so the gym's money records still add up.
-- Ask a lawyer how long financial records must be kept.

alter table public.members
  add column deleted_by      uuid references public.staff (id),
  add column deletion_reason text;

create function public.delete_member_data(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_owner() then
    raise exception 'Only the owner can delete a member''s data' using errcode = '42501';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Give a reason, such as "Member asked"';
  end if;

  update public.members
  set full_name = 'Deleted member',
      phone = null,
      auth_user_id = null,
      deleted_at = now(),
      deleted_by = (select auth.uid()),
      deletion_reason = v_reason
  where id = p_member_id and deleted_at is null;
  if not found then
    raise exception 'Member not found or already deleted';
  end if;

  -- A card left active could still identify the person at the desk.
  update public.cards
  set active = false, deactivated_at = now()
  where member_id = p_member_id and active;
end
$$;

revoke execute on function public.delete_member_data(uuid, text) from public, anon;
grant execute on function public.delete_member_data(uuid, text) to authenticated;

-- The activity log, now also listing deletions (without the deleted name).
create or replace function public.activity_feed(
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

    union all
    select m.deleted_at, coalesce(s.full_name, 'Unknown'), 'member',
           'Deleted the data of member no. ' || m.member_no || coalesce(': ' || m.deletion_reason, ''),
           null::bigint
    from public.members m left join public.staff s on s.id = m.deleted_by
    where m.deleted_at is not null
  ) f
  where public.is_owner()
    and (p_before is null or f.at < p_before)
    and (p_kind is null or f.kind = p_kind)
  order by f.at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
$$;
