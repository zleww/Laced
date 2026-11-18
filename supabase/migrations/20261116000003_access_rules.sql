-- Laced access rules.
--
-- Two locks work together:
--   1. Grants decide which operations a role may attempt on a table at all.
--   2. Row-level security (RLS) policies decide which rows that role may see or change.
-- Everything starts closed. Signed-out visitors ("anon") get nothing.
-- Money, memberships, and check-ins can only be written through the functions
-- in the previous migration, never by a direct insert from the browser.

-- ---------------------------------------------------------------------------
-- 1. Start closed
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter table public.staff        enable row level security;
alter table public.members      enable row level security;
alter table public.plans        enable row level security;
alter table public.memberships  enable row level security;
alter table public.payments     enable row level security;
alter table public.expenses     enable row level security;
alter table public.daily_closes enable row level security;
alter table public.checkins     enable row level security;
alter table public.cards        enable row level security;
alter table public.audit_log    enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Grants for signed-in accounts
-- ---------------------------------------------------------------------------

grant select on
  public.staff, public.members, public.plans, public.memberships, public.payments,
  public.expenses, public.daily_closes, public.checkins, public.cards, public.audit_log,
  public.member_overview
to authenticated;

-- Staff may correct a member's name or phone, and nothing else on that row.
grant update (full_name, phone) on public.members to authenticated;

-- Owner-only writes. The policies below limit these to the owner.
grant insert, update on public.plans to authenticated;
grant insert, update (full_name, role, active) on public.staff to authenticated;
grant insert on public.expenses to authenticated;

grant execute on function public.manila_date(timestamptz) to authenticated;
grant execute on function public.manila_today() to authenticated;
grant execute on function public.membership_end(date, integer) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.register_member(text, text, boolean) to authenticated;
grant execute on function public.record_membership_payment(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.sell_day_pass(uuid, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.check_in(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row policies
-- ---------------------------------------------------------------------------
-- "(select public.is_owner())" is wrapped in a select so Postgres works it out
-- once per query instead of once per row.

-- staff: the owner sees and manages everyone; a staff member sees only their own row.
create policy staff_select on public.staff for select to authenticated
  using ((select public.is_owner()) or id = (select auth.uid()));
create policy staff_insert on public.staff for insert to authenticated
  with check ((select public.is_owner()));
create policy staff_update on public.staff for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- members: any active desk account can look up and correct members.
create policy members_select on public.members for select to authenticated
  using ((select public.is_staff()));
create policy members_update on public.members for update to authenticated
  using ((select public.is_staff()) and deleted_at is null)
  with check ((select public.is_staff()) and deleted_at is null);

-- plans: staff read prices; only the owner changes them.
create policy plans_select on public.plans for select to authenticated
  using ((select public.is_staff()));
create policy plans_insert on public.plans for insert to authenticated
  with check ((select public.is_owner()));
create policy plans_update on public.plans for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- memberships: staff need them to show a member's status.
create policy memberships_select on public.memberships for select to authenticated
  using ((select public.is_staff()));

-- payments: the owner sees all. A staff member sees only what they collected today,
-- which is enough to close the day but not enough to add up the gym's revenue.
create policy payments_select on public.payments for select to authenticated
  using (
    (select public.is_owner())
    or (
      (select public.is_staff())
      and received_by = (select auth.uid())
      and public.manila_date(paid_at) = (select public.manila_today())
    )
  );

-- expenses: owner only.
create policy expenses_select on public.expenses for select to authenticated
  using ((select public.is_owner()));
create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select public.is_owner()) and recorded_by = (select auth.uid()));

-- daily closes: the owner sees all; a staff member sees the ones they closed.
create policy daily_closes_select on public.daily_closes for select to authenticated
  using (
    (select public.is_owner())
    or ((select public.is_staff()) and closed_by = (select auth.uid()))
  );

-- check-ins: the owner sees all; staff see today's.
create policy checkins_select on public.checkins for select to authenticated
  using (
    (select public.is_owner())
    or ((select public.is_staff()) and visit_date = (select public.manila_today()))
  );

-- cards: staff can read them to identify a member.
create policy cards_select on public.cards for select to authenticated
  using ((select public.is_staff()));

-- audit log: owner only, read only.
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select public.is_owner()));
