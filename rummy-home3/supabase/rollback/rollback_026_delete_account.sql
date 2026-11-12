-- Rollback 026: drops delete_my_account and tombstone_profile and puts back the three
-- four triggers' earlier bodies: enforce_profile_auth_user (011), lock_profile_email (011),
-- lock_public_player_no (012) and delete_profile_with_auth_user (005). Accounts already deleted stay anonymised; their rows
-- keep player_status 'deleted_after_registering' and, with the 011 trigger back, can no longer
-- be updated (no auth user), which is fine: nothing writes to them. Safe to re-run.

drop function if exists public.delete_my_account();
drop function if exists public.tombstone_profile(uuid);

-- 011 body
create or replace function public.enforce_profile_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_demo then
    if new.demo_owner_id is null or new.demo_owner_id = new.id then
      raise exception 'Demo profiles require an owner';
    end if;
    if new.role is distinct from 'player' then
      raise exception 'Demo profiles cannot be admins';
    end if;
    return new;
  end if;

  if new.demo_owner_id is not null then
    raise exception 'Only demo profiles can have an owner';
  end if;

  if new.managed_by is not null then
    if new.player_status not in ('unregistered','pending','deleted_before_registering','merged') then
      raise exception 'A managed player must be unregistered';
    end if;
    if new.role is distinct from 'player' then
      raise exception 'Unregistered players cannot be admins';
    end if;
    return new;
  end if;

  if not exists (select 1 from auth.users where id = new.id) then
    raise exception 'Profile must belong to a signed-in account';
  end if;

  return new;
end;
$$;

-- 011 body
create or replace function public.lock_profile_email()
returns trigger
language plpgsql
as $$
begin
  if old.email is not null and new.email is distinct from old.email
     and lower(btrim(new.email)) is distinct from lower(btrim(old.email)) then
    raise exception 'Changing your email is not available yet.';
  end if;
  return new;
end;
$$;

-- 012 body
create or replace function public.lock_public_player_no()
returns trigger
language plpgsql
as $$
begin
  if old.public_player_no is not null and new.public_player_no is distinct from old.public_player_no then
    raise exception 'A player ID never changes.';
  end if;
  return new;
end;
$$;

-- 005 body
create or replace function public.delete_profile_with_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id and is_demo = false;
  return old;
end;
$$;
