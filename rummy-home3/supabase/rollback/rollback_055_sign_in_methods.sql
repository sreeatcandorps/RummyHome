-- Rollback 055: drop the Auth-email copy and the Not you? function, restore lock_profile_email (026 body).
-- Run only if 055 has to come out. Emails already copied to profiles stay as they are; numbers already
-- released stay released.
drop trigger if exists on_auth_user_email_changed on auth.users;
drop function if exists public.sync_profile_email_from_auth();
drop function if exists public.release_my_whatsapp_number();

create or replace function public.lock_profile_email()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.email is null and new.player_status = 'deleted_after_registering' then
    return new;
  end if;
  if old.email is not null and new.email is distinct from old.email
     and lower(btrim(new.email)) is distinct from lower(btrim(old.email)) then
    raise exception 'Changing your email is not available yet.';
  end if;
  return new;
end;
$$;
grant execute on function public.lock_profile_email() to public;
