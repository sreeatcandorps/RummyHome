-- 055 (D124 WhatsApp sign-in; whatsapp-sign-in-design.md §9.1 and §5a case 5):
--
-- A. A confirmed email change in Supabase Auth reaches the profile. Until now only sign-up copied the email
--    (handle_new_user), so a backup email added in Profile › Sign-in methods, or a changed email, never reached
--    profiles.email (result emails, invites, Is this you?). A trigger on auth.users copies it across. If that
--    address is already on another profile row (a placeholder that was typed with it), the copy is skipped
--    with a warning rather than failing the change in Auth.
-- B. lock_profile_email (011, 026) lets exactly that copy through: a new profile email equal to the account's
--    own Auth email. Typing a different address into profiles is still refused, as before.
-- C. release_my_whatsapp_number(): "Not you?" on Set a new passcode. The number was recycled to someone new;
--    the code they just typed proved they hold it. Takes the number off the caller's own account (the old
--    account keeps its email, if any) so the new holder can create an account with it. Only ever the caller's
--    own row; no other account can be touched.
--
-- No column is added. Rollback: supabase/rollback/rollback_055_sign_in_methods.sql.

-- ---------- A. Auth email → profile ----------
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is not null and btrim(new.email) <> ''
     and lower(btrim(new.email)) is distinct from lower(btrim(coalesce(old.email, ''))) then
    begin
      update public.profiles set email = lower(btrim(new.email)) where id = new.id;
    exception when unique_violation then
      raise warning '055: % is already on another profile; profiles.email of % is left as it was', new.email, new.id;
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_email_from_auth() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.sync_profile_email_from_auth();

-- ---------- B. the email lock accepts the account's own Auth email ----------
create or replace function public.lock_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is null and new.player_status = 'deleted_after_registering' then
    return new;
  end if;
  if old.email is not null and new.email is distinct from old.email
     and lower(btrim(new.email)) is distinct from lower(btrim(old.email))
     and lower(btrim(new.email)) is distinct from (select lower(btrim(u.email)) from auth.users u where u.id = new.id) then
    raise exception 'Changing your email is not available yet.';
  end if;
  return new;
end;
$$;

-- Definer now (it reads auth.users), so nobody may call it directly; a trigger needs no EXECUTE to fire.
revoke all on function public.lock_profile_email() from public, anon, authenticated;

-- ---------- C. Not you? ----------
create or replace function public.release_my_whatsapp_number()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in required'; end if;
  update auth.users
     set phone = null,
         phone_confirmed_at = null,
         phone_change = '',
         phone_change_token = '',
         phone_change_sent_at = null,
         updated_at = now()
   where id = me;
  delete from auth.identities where user_id = me and provider = 'phone';
end;
$$;

revoke all on function public.release_my_whatsapp_number() from public, anon;
grant execute on function public.release_my_whatsapp_number() to authenticated;

comment on function public.release_my_whatsapp_number() is
  'Set a new passcode › Not you? (WhatsApp spec §5a case 5). Takes the WhatsApp number off the caller''s own account so its new holder can sign up with it.';
