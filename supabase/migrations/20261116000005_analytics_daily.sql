-- Owner dashboard: money collected and visits per Manila day, for the last N days.
--
-- The totals are worked out here in the database, not in the browser. The
-- function checks is_owner() itself, so a staff account gets no rows back even
-- though it is allowed to call it.

create function public.analytics_daily(p_days integer default 14)
returns table (day date, revenue_centavos bigint, checkins bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.day,
    coalesce((
      select sum(p.amount_centavos - p.discount_centavos)
      from public.payments p
      where p.voided_at is null and public.manila_date(p.paid_at) = d.day
    ), 0)::bigint,
    (select count(*) from public.checkins c where c.visit_date = d.day)::bigint
  from (
    select generate_series(
      public.manila_today() - (least(greatest(p_days, 1), 90) - 1),
      public.manila_today(),
      interval '1 day'
    )::date as day
  ) d
  where public.is_owner()
  order by d.day
$$;

revoke execute on function public.analytics_daily(integer) from public, anon;
grant execute on function public.analytics_daily(integer) to authenticated;
