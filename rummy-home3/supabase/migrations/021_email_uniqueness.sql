-- 021: one account per email, enforced in the database. Apply after 020.
-- Safe to re-run. Rollback: rollback_021_email_uniqueness.sql.
--
-- Background (Nov 11 phone test): a second sign-up with an email that already had an
-- account looked like it succeeded. Supabase Auth did NOT create a second user:
-- auth.users has a unique index on email (users_email_partial_key) and GoTrue stores
-- and compares emails lowercased. With "Confirm email" on, GoTrue answers a repeated
-- sign-up with HTTP 200 and a sanitised placeholder user (fresh random id, no
-- identities, no session) so that the response does not reveal who has an account;
-- the app treated that as "account created, check your email". The app fix is in
-- services/auth.ts (a sign-up answer with an empty identities list is refused with
-- "An account with this email already exists..."). This migration is the database
-- guarantee behind it:
--
-- A. profiles.email is normalised on every write: lower(btrim()), '' becomes null.
--    001's handle_new_user already lowercases on sign-up; this covers every other
--    writer (profile updates, SQL, future RPCs).
-- B. A unique index on lower(btrim(email)) over EVERY profiles row that has an email.
--    001 has a plain unique (case-sensitive); 011 added a case-insensitive index for
--    accounts only, and skipped it silently if the table already held case duplicates.
--    This index covers placeholders too and is created only when the table is clean.
-- C. Duplicates are REPORTED, never deleted or merged. During apply they are raised as
--    notices; afterwards `select * from public.duplicate_profile_emails()` lists them
--    (SQL editor / service role only; not callable by app users). If any exist, the
--    index in B is skipped with a notice naming them; fix the rows, then re-run 021.
--
-- Nothing in auth schema is changed: Supabase owns it and already guarantees uniqueness.

-- ---------- A. normalise on write ----------
create or replace function public.normalize_profile_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

drop trigger if exists profiles_normalize_email on public.profiles;
-- Runs before profiles_lock_email (alphabetical trigger order): the lock already compares
-- lower(btrim()) on both sides, so normalising first changes nothing it decides.
create trigger profiles_normalize_email
before insert or update of email on public.profiles
for each row execute function public.normalize_profile_email();

-- ---------- C. duplicate report ----------
-- One row per profile that shares a normalised email with another profile, grouped so the
-- pairs are easy to read. Includes placeholders (managed_by not null) and deleted/merged
-- rows: every row that still carries the address. Reads auth.users to say whether each
-- profile is a real sign-in account.
create or replace function public.duplicate_profile_emails()
returns table (
  normalized_email text,
  copies bigint,
  profile_id uuid,
  stored_email text,
  display_name text,
  player_status text,
  managed_by uuid,
  has_auth_user boolean,
  auth_email_confirmed boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with groups as (
    select lower(btrim(p.email)) as normalized_email, count(*) as copies
    from public.profiles p
    where p.email is not null and btrim(p.email) <> ''
    group by lower(btrim(p.email))
    having count(*) > 1
  )
  select g.normalized_email, g.copies, p.id, p.email, p.display_name, p.player_status, p.managed_by,
         (u.id is not null) as has_auth_user,
         (u.email_confirmed_at is not null) as auth_email_confirmed,
         p.created_at
  from groups g
  join public.profiles p on lower(btrim(p.email)) = g.normalized_email
  left join auth.users u on u.id = p.id
  order by g.normalized_email, p.created_at;
$$;

revoke all on function public.duplicate_profile_emails() from public, anon, authenticated;
grant execute on function public.duplicate_profile_emails() to service_role;

-- ---------- B. unique by normalised email, if the table is clean ----------
do $$
declare
  dup record;
  dup_count integer;
begin
  select count(distinct normalized_email) into dup_count from public.duplicate_profile_emails();

  if dup_count > 0 then
    raise notice '021: profiles has % email(s) used by more than one row. Nothing was deleted or merged. Rows:', dup_count;
    for dup in select * from public.duplicate_profile_emails() loop
      raise notice '021:   % -> profile % (stored "%", %, status %, managed_by %, auth user %, confirmed %)',
        dup.normalized_email, dup.profile_id, dup.stored_email, dup.display_name, dup.player_status,
        coalesce(dup.managed_by::text, 'none'), dup.has_auth_user, dup.auth_email_confirmed;
    end loop;
    raise notice '021: the unique index profiles_email_ci_key was NOT created. Decide what to do with the rows above, then re-run this file.';
  else
    create unique index if not exists profiles_email_ci_key
      on public.profiles (lower(btrim(email))) where email is not null;
    raise notice '021: no duplicate emails; profiles_email_ci_key is in place.';
  end if;
end $$;

-- Rows written before 021 that are not already normalised are reported too (not changed).
do $$
declare
  n integer;
begin
  select count(*) into n from public.profiles where email is not null and email is distinct from nullif(lower(btrim(email)), '');
  if n > 0 then
    raise notice '021: % profile row(s) store an email that is not lower-case/trimmed; they were left as they are. List: select id, email from public.profiles where email is distinct from nullif(lower(btrim(email)), '''');', n;
  end if;
end $$;
