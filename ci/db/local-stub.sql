-- Minimal stand-in for the parts of a Supabase database that the migrations in
-- rummy-home3/supabase/migrations depend on. Used ONLY when the Supabase CLI
-- (Docker) is not available, e.g. on a plain Postgres 16 with pgTAP installed.
-- CI uses the real stack (`supabase start`); this file is never applied there.
--
-- It provides: roles anon / authenticated / service_role, the auth schema with
-- auth.users, auth.uid(), auth.jwt(), auth.role(), the supabase_realtime
-- publication, pgcrypto, and pgTAP.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant anon, authenticated, service_role to current_user;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Supabase installs pgcrypto in the `extensions` schema (not on the default
-- search_path), so a function that calls gen_random_bytes() must say
-- `set search_path = public, extensions`. Mirror that here so the local suite
-- fails the same way CI does when a migration forgets it.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pgcrypto')
     and (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto') <> 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end $$;
create extension if not exists pgcrypto schema extensions;
create extension if not exists pgtap;
-- Supabase's database default search_path includes extensions, so top-level migration SQL
-- finds gen_random_bytes(); only functions with their own `set search_path` lose it.
do $$
begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end $$;
set search_path = "$user", public, extensions;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  ), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'role'
  ), '')::text;
$$;

grant execute on function auth.uid(), auth.jwt(), auth.role() to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
