-- 026: in-app account deletion (Google Play "Delete account" requirement).
--
-- Apply after 025. Safe to re-run. Rollback: supabase/rollback/rollback_026_delete_account.sql.
--
-- The signed-in person taps Delete account in Profile. The app calls delete_my_account(),
-- which anonymises everything about the person and then removes the auth user. Seats are
-- never deleted: games other people were in keep the seat and the scores under the name as
-- an unregistered player (no email, phone or Player ID), the same way a placeholder shows.
--
-- What goes (tombstone_profile):
--   * profile contact and identity: email, phone, first/last name, avatar, zip, Player ID
--     (public_player_no cleared, player_code replaced), email token and both email preferences, default
--     settings; role back to 'player'; player_status 'deleted_after_registering', deleted_at.
--   * My players (both directions), hidden games, queued and sent emails, creator notices,
--     the person's pending claim links (cancelled).
--   * memberships that are not a seat: viewer rows and non-playing admin rows are removed;
--     seated admin rows become plain players (an unregistered name cannot be an admin).
--   * games the person created where nobody else with an account was ever a member are
--     soft-deleted exactly like Delete game (023): removed from saved results, deleted_at set.
--   * demo data the person owned (allowlisted admins only).
-- What stays:
--   * every seat, score, round and result the person was part of with other people;
--     display_name is kept so the scorecards still read right.
--   * games the person created that other accounts were in. If no other admin is left, the
--     first other registered seated player (by seat order) becomes game admin so the game
--     is not orphaned. created_by is not changed (foreign key).
--
-- The auth.users delete trigger from 005 (delete_profile_with_auth_user) is taught the same
-- rule, so deleting a user from the Supabase dashboard (the "email support" path) anonymises
-- a profile that has history instead of failing on the foreign keys, and still removes a
-- profile that never played.

-- ---------- A. the profile trigger accepts a tombstone with no auth user ----------
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

  -- A deleted account: the auth user is gone, the row stays for the seats it holds.
  if new.player_status = 'deleted_after_registering' then
    if new.role is distinct from 'player' then
      raise exception 'A deleted account cannot be an admin';
    end if;
    return new;
  end if;

  if not exists (select 1 from auth.users where id = new.id) then
    raise exception 'Profile must belong to a signed-in account';
  end if;

  return new;
end;
$$;

-- A Player ID never changes (012), except that a deleted account gives it up.
create or replace function public.lock_public_player_no()
returns trigger
language plpgsql
as $$
begin
  if new.public_player_no is null and new.player_status = 'deleted_after_registering' then
    return new;
  end if;
  if old.public_player_no is not null and new.public_player_no is distinct from old.public_player_no then
    raise exception 'A player ID never changes.';
  end if;
  return new;
end;
$$;

-- Email cannot be changed (011), except that a deleted account gives it up.
create or replace function public.lock_profile_email()
returns trigger
language plpgsql
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

-- ---------- B. tombstone: everything personal goes, every seat stays ----------
create or replace function public.tombstone_profile(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  g record;
  v_new_admin uuid;
  v_deleted_games integer := 0;
  v_kept_games integer := 0;
  v_promoted integer := 0;
  v_seats integer := 0;
begin
  select * into v_profile from public.profiles p where p.id = p_profile_id for update;
  if v_profile.id is null then raise exception 'This account is not available.'; end if;
  if v_profile.is_demo or v_profile.managed_by is not null then
    raise exception 'Only a signed-in account can be deleted.';
  end if;
  if v_profile.player_status = 'deleted_after_registering' then
    raise exception 'This account was already deleted.';
  end if;

  -- Demo data this person owned (only allowlisted admins ever have any).
  delete from public.games where is_demo and created_by = p_profile_id;
  delete from public.profiles p
  where p.is_demo and p.demo_owner_id = p_profile_id
    and not exists (select 1 from public.game_players gp where gp.profile_id = p.id)
    and not exists (select 1 from public.scores s where s.profile_id = p.id);

  -- Games this person created.
  for g in
    select g2.id, g2.deleted_at from public.games g2
    where g2.created_by = p_profile_id and g2.is_demo = false
    order by g2.created_at, g2.id
  loop
    perform pg_advisory_xact_lock(hashtextextended('game:' || g.id::text, 0));
    if not exists (
      select 1 from public.game_players gp join public.profiles p on p.id = gp.profile_id
      where gp.game_id = g.id and gp.profile_id <> p_profile_id and gp.is_active
        and p.managed_by is null and p.is_demo = false and p.player_status <> 'deleted_after_registering'
    ) then
      -- Nobody else with an account was in it: the same soft delete as Delete game (023).
      if g.deleted_at is null then
        update public.game_result_games grg
        set removed_at = now()
        from public.game_results r
        where grg.game_id = g.id and grg.removed_at is null and r.id = grg.result_id and r.deleted_at is null;
        update public.games set deleted_at = now(), deleted_by = p_profile_id where id = g.id;
        perform public.sync_closed_at(array[g.id]);
        perform public.adjust_games_together(g.id, -1);
      end if;
      v_deleted_games := v_deleted_games + 1;
    else
      v_kept_games := v_kept_games + 1;
      if not exists (
        select 1 from public.game_players gp join public.profiles p on p.id = gp.profile_id
        where gp.game_id = g.id and gp.profile_id <> p_profile_id and gp.is_active and gp.role = 'game_admin'
          and p.managed_by is null and p.is_demo = false and p.player_status = 'registered'
      ) then
        select gp.profile_id into v_new_admin
        from public.game_players gp join public.profiles p on p.id = gp.profile_id
        where gp.game_id = g.id and gp.profile_id <> p_profile_id and gp.is_active and gp.role = 'player'
          and coalesce(gp.seated, true)
          and p.managed_by is null and p.is_demo = false and p.player_status = 'registered'
        order by gp.player_order, gp.joined_at
        limit 1;
        if v_new_admin is not null then
          update public.game_players set role = 'game_admin' where game_id = g.id and profile_id = v_new_admin;
          v_promoted := v_promoted + 1;
        end if;
      end if;
    end if;
  end loop;

  -- Memberships: seats stay as a plain player; viewer and non-playing admin rows go.
  delete from public.game_players gp
  where gp.profile_id = p_profile_id and (gp.role = 'spectator' or coalesce(gp.seated, true) = false);
  update public.game_players set role = 'player'
  where profile_id = p_profile_id and role <> 'player';
  select count(*) into v_seats from public.game_players gp where gp.profile_id = p_profile_id;

  -- Lists and mail about this person.
  delete from public.my_players where owner_id = p_profile_id or player_id = p_profile_id;
  delete from public.hidden_games where owner_id = p_profile_id;
  delete from public.email_outbox where to_profile_id = p_profile_id;
  delete from public.creator_notices where owner_id = p_profile_id;
  update public.player_links set status = 'cancelled'
  where owner_id = p_profile_id and status = 'pending';

  -- The row itself: name only.
  update public.profiles
  set email = null,
      phone = null,
      first_name = null,
      last_name = null,
      avatar_url = null,
      zip_code = null,
      player_code = public.generate_player_code(),  -- not null; the old code is freed
      public_player_no = null,
      email_token = null,
      email_game_started = false,
      email_results = false,
      default_settings = default,
      role = 'player',
      display_name = coalesce(nullif(btrim(display_name), ''), 'Former player'),
      player_status = 'deleted_after_registering',
      deleted_at = now()
  where id = p_profile_id;

  return jsonb_build_object(
    'seatsKept', v_seats,
    'gamesDeleted', v_deleted_games,
    'gamesKept', v_kept_games,
    'adminsPromoted', v_promoted
  );
end;
$$;

revoke all on function public.tombstone_profile(uuid) from public, anon, authenticated;

comment on function public.tombstone_profile(uuid) is
  'Internal. Anonymises a profile and its memberships but keeps every seat and score; see 026 header for the exact list.';

-- ---------- C. the RPC the app calls ----------
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_summary jsonb;
begin
  if me is null then raise exception 'Sign in required'; end if;
  v_summary := public.tombstone_profile(me);
  -- The before-delete trigger (D) sees the tombstone and leaves the profile row alone.
  delete from auth.users where id = me;
  return v_summary;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Profile > Delete account. Anonymises the caller (tombstone_profile) and removes the auth user; seats and scores with other people stay under the name.';

-- ---------- D. deleting a user from the dashboard follows the same rule ----------
create or replace function public.delete_profile_with_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles p where p.id = old.id and p.is_demo = false;
  if v_profile.id is null then return old; end if;
  if v_profile.player_status = 'deleted_after_registering' then return old; end if;
  if exists (select 1 from public.game_players gp where gp.profile_id = old.id)
     or exists (select 1 from public.games g where g.created_by = old.id)
     or exists (select 1 from public.scores s where s.profile_id = old.id)
     or exists (select 1 from public.rounds r where r.created_by = old.id)
     or exists (select 1 from public.game_results gr where gr.declared_by = old.id)
  then
    perform public.tombstone_profile(old.id);
  else
    delete from public.profiles where id = old.id;
  end if;
  return old;
end;
$$;

revoke all on function public.delete_profile_with_auth_user() from public, anon, authenticated;
