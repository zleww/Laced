-- Sign-in limits the owner can change: after this many wrong passwords on a
-- device, the sign-in screen asks the person to wait.
--
-- This is a speed bump on the sign-in screen, not a lock on the account: the
-- account is never blocked. The real protection against password guessing is
-- two-step sign-in and Supabase's own rate limit on its sign-in server.

create table public.app_settings (
  id                   uuid primary key default gen_random_uuid(),
  singleton            boolean not null default true unique check (singleton), -- one row only
  max_sign_in_tries    integer not null default 5 check (max_sign_in_tries between 3 and 20),
  sign_in_wait_minutes integer not null default 10 check (sign_in_wait_minutes between 1 and 120),
  updated_at           timestamptz not null default now()
);

insert into public.app_settings default values;

create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function public.audit_row();

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;
grant update (max_sign_in_tries, sign_in_wait_minutes) on public.app_settings to authenticated;

create policy app_settings_select on public.app_settings for select to authenticated
  using ((select public.is_owner()));
create policy app_settings_update on public.app_settings for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- The sign-in screen needs the two numbers before anyone has signed in.
-- They reveal nothing about members or money, so anyone may read them.
create function public.sign_in_limits()
returns table (max_tries integer, wait_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.max_sign_in_tries, s.sign_in_wait_minutes from public.app_settings s
$$;

revoke execute on function public.sign_in_limits() from public;
grant execute on function public.sign_in_limits() to anon, authenticated;
