-- Member access: lets a member sign in to the member app and read their own
-- membership, visits, and payments, and nothing else.
--
-- Members are ordinary Supabase logins with no row in "staff". Every desk and
-- owner rule already checks is_staff() or is_owner(), so a member gets nothing
-- from them. This migration adds no row policies for members. Instead a member
-- reads through a few small functions that return only the columns they may see
-- (no GCash reference, no staff names, no voided rows).
--
-- A member gets a login by a one-time claim code made at the desk. The
-- "member-claim" Edge Function (service role) checks the code and links the new
-- login to the member's record. The code is stored only as a hash.

-- ---------------------------------------------------------------------------
-- Who is this member?
-- ---------------------------------------------------------------------------

create function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.members m
  where m.auth_user_id = (select auth.uid()) and m.deleted_at is null
$$;

revoke execute on function public.current_member_id() from public, anon;
grant execute on function public.current_member_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Claim codes
-- ---------------------------------------------------------------------------

create table public.member_claim_codes (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id),
  code_hash  text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_by uuid not null references public.staff (id),
  created_at timestamptz not null default now()
);

create index member_claim_codes_member_idx on public.member_claim_codes (member_id);

-- Nobody reads or writes this table directly, only the functions below.
alter table public.member_claim_codes enable row level security;
revoke all on public.member_claim_codes from anon, authenticated;

-- The hash of a code, ignoring case, spaces, and dashes.
create function public.claim_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')),
    'hex'
  )
$$;

revoke execute on function public.claim_code_hash(text) from public, anon, authenticated;

-- Desk: make a code for a member. It is shown once, works once, and lasts 48 hours.
-- A new code replaces any unused earlier one.
create function public.issue_member_claim_code(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member   public.members%rowtype;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no I, L, O, 0, 1
  v_bytes    bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  -- Bytes 6 and 8 of a random uuid hold fixed version bits, so they are skipped.
  v_picks    constant integer[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12];
  v_code     text := '';
  v_expires  timestamptz := now() + interval '48 hours';
  i          integer;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_member from public.members where id = p_member_id and deleted_at is null;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_member.auth_user_id is not null then
    raise exception 'This member already has an app account';
  end if;

  for i in 1 .. array_length(v_picks, 1) loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_picks[i]) % length(v_alphabet)) + 1, 1);
  end loop;

  delete from public.member_claim_codes where member_id = p_member_id and used_at is null;
  insert into public.member_claim_codes (member_id, code_hash, expires_at, created_by)
  values (p_member_id, public.claim_code_hash(v_code), v_expires, (select auth.uid()));

  return jsonb_build_object(
    'code', substr(v_code, 1, 5) || '-' || substr(v_code, 6),
    'expires_at', v_expires
  );
end
$$;

revoke execute on function public.issue_member_claim_code(uuid) from public, anon;
grant execute on function public.issue_member_claim_code(uuid) to authenticated;

-- Edge Function only: which member does this code belong to? Null when the code
-- is wrong, used, or expired, or the member was deleted or already has a login.
create function public.member_claim_status(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.member_id
  from public.member_claim_codes c
  join public.members m on m.id = c.member_id
  where c.code_hash = public.claim_code_hash(p_code)
    and c.used_at is null
    and c.expires_at > now()
    and m.deleted_at is null
    and m.auth_user_id is null
$$;

-- Edge Function only: burn the code and link the new login to the member.
create function public.complete_member_claim(p_code text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code public.member_claim_codes%rowtype;
begin
  if exists (select 1 from public.staff where id = p_user_id) then
    raise exception 'That login belongs to the desk team';
  end if;

  select c.* into v_code
  from public.member_claim_codes c
  join public.members m on m.id = c.member_id
  where c.code_hash = public.claim_code_hash(p_code)
    and c.used_at is null
    and c.expires_at > now()
    and m.deleted_at is null
    and m.auth_user_id is null
  for update of c;
  if not found then
    raise exception 'Invalid or expired code';
  end if;

  update public.member_claim_codes set used_at = now() where id = v_code.id;
  update public.members set auth_user_id = p_user_id where id = v_code.member_id;
end
$$;

revoke execute on function public.member_claim_status(text) from public, anon, authenticated;
revoke execute on function public.complete_member_claim(text, uuid) from public, anon, authenticated;
grant execute on function public.member_claim_status(text) to service_role;
grant execute on function public.complete_member_claim(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- What a member can read about themselves
-- ---------------------------------------------------------------------------

-- Membership status, worked out the same way as the desk's member list.
create function public.my_status()
returns table (
  member_no   bigint,
  full_name   text,
  plan_name   text,
  valid_until date,
  days_left   integer,
  status      text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.member_no,
    m.full_name,
    latest.plan_name,
    latest.end_date,
    (latest.end_date - public.manila_today())::integer,
    case
      when latest.end_date is null then 'none'
      when latest.end_date < public.manila_today() then 'expired'
      when latest.end_date - public.manila_today() <= 7 then 'expiring'
      else 'active'
    end
  from public.members m
  left join lateral (
    select ms.end_date, p.name as plan_name
    from public.memberships ms
    join public.plans p on p.id = ms.plan_id
    where ms.member_id = m.id and ms.voided_at is null
    order by ms.end_date desc
    limit 1
  ) latest on true
  where m.id = public.current_member_id()
$$;

-- Own visits, newest first.
create function public.my_visits(p_limit integer default 60)
returns table (checked_in_at timestamptz, visit_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select c.checked_in_at, c.visit_date
  from public.checkins c
  where c.member_id = public.current_member_id()
  order by c.checked_in_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
$$;

-- Own payments, newest first. The amount is what was actually collected.
-- Voided payments are left out, and so are the GCash reference and the staff name.
create function public.my_payments(p_limit integer default 60)
returns table (paid_at timestamptz, plan_name text, amount_centavos integer, method text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.paid_at, pl.name, p.amount_centavos - p.discount_centavos, p.method
  from public.payments p
  join public.plans pl on pl.id = p.plan_id
  where p.member_id = public.current_member_id() and p.voided_at is null
  order by p.paid_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
$$;

revoke execute on function public.my_status() from public, anon;
revoke execute on function public.my_visits(integer) from public, anon;
revoke execute on function public.my_payments(integer) from public, anon;
grant execute on function public.my_status() to authenticated;
grant execute on function public.my_visits(integer) to authenticated;
grant execute on function public.my_payments(integer) to authenticated;
