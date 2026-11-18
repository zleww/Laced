-- Stand-in for the parts of Supabase the migrations rely on, so the real
-- migration files can run against a plain in-memory Postgres during tests.

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase reads the signed-in user's id from the request token.
-- Tests set the same setting by hand to act as a given user.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Supabase hands these roles full access to new objects in "public" by default.
-- Copying that here proves the migrations really close it off again.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
