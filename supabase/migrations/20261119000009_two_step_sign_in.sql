-- Two-step sign-in (an authenticator app code after the password).
--
-- Once someone turns it on, their account has no owner or desk powers until
-- the code has been entered in this session. A stolen password on its own can
-- then read nothing and change nothing. Accounts without it work as before.
-- Every access rule goes through is_staff() and is_owner(), so changing these
-- two functions covers every table and every action.

-- True when this session has met the account's sign-in requirement: either the
-- account has no authenticator app, or the code was entered ("aal2").
create function public.sign_in_complete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      )
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.id = (select auth.uid()) and s.active
  ) and public.sign_in_complete()
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.id = (select auth.uid()) and s.active and s.role = 'owner'
  ) and public.sign_in_complete()
$$;

revoke execute on function public.sign_in_complete() from public, anon;
grant execute on function public.sign_in_complete() to authenticated;
