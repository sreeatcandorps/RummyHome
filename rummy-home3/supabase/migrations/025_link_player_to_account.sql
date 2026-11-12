-- 025: Link to Player ID from the unified player menu (approved Nov 11, 10:59 PM PT, item 5).
--
-- An organiser links one of their unregistered players to a registered account by typing the
-- account's Player ID *and* its email: the pair must match, so a guessed number never lands on
-- a stranger, and the email is never shown (the caller must already know it). Unlike 015/017,
-- which moved one seat in one game, this moves the player in EVERY game they sit in — the same
-- merge a claim link does (012 merge_claim) — after a conflict check across all of those games:
-- if the account already plays in any of them, nothing moves and the games are named.
--
-- link_player_check previews (target, conflicts, game count) so the app can confirm first;
-- link_player_to_account does the move and records a 'link' row in player_links (status
-- 'claimed', moved_game_ids), so 011 unlink_player can undo it. Safe to re-run.
-- Rollback: supabase/rollback/rollback_025_link_player_to_account.sql.

-- Who the pair (Player ID, email) names, or an exception that never reveals the email.
create or replace function public.link_target_for(p_player_no bigint, p_email text)
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare t public.profiles;
begin
  if p_player_no is null then raise exception 'Type the Player ID number, like #42.'; end if;
  select * into t from public.profiles p
  where p.public_player_no = p_player_no and p.managed_by is null and coalesce(p.player_status, 'registered') = 'registered';
  if t.id is null then raise exception 'No registered player has that Player ID.'; end if;
  if nullif(lower(btrim(coalesce(p_email, ''))), '') is null then raise exception 'Type the email of the account to confirm it.'; end if;
  if lower(btrim(coalesce(t.email, ''))) <> lower(btrim(p_email)) then
    raise exception 'That email does not match Player ID #%.', p_player_no;
  end if;
  return t;
end;
$$;

-- Games where the unregistered player sits (any status, deleted included) and the account already
-- plays too: a seated, non-spectator membership. A non-playing admin or a viewer is not a conflict.
create or replace function public.link_conflicts(p_player_id uuid, p_target uuid)
returns table (game_id uuid, game_number integer)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.game_number
  from public.game_players mine
  join public.games g on g.id = mine.game_id
  join public.game_players theirs on theirs.game_id = mine.game_id and theirs.profile_id = p_target
  where mine.profile_id = p_player_id
    and mine.role <> 'spectator' and coalesce(mine.seated, true)
    and theirs.role <> 'spectator' and coalesce(theirs.seated, true)
  order by g.game_number nulls last, g.created_at;
$$;

create or replace function public.link_player_check(p_player_id uuid, p_player_no bigint, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seat public.profiles;
  t public.profiles;
  n_games integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into seat from public.profiles where id = p_player_id;
  if seat.id is null or (seat.managed_by is distinct from auth.uid() and not public.is_app_admin()) then
    raise exception 'Only your own unregistered players can be linked.';
  end if;
  if coalesce(seat.player_status, 'registered') not in ('unregistered', 'pending') then
    raise exception 'Only an unregistered player can be linked to a Player ID.';
  end if;
  t := public.link_target_for(p_player_no, p_email);
  select count(*)::int into n_games from public.game_players gp
  where gp.profile_id = p_player_id and gp.role <> 'spectator' and coalesce(gp.seated, true);
  return jsonb_build_object(
    'target', jsonb_build_object('id', t.id, 'name', coalesce(nullif(t.display_name, ''), 'Rummy Player'), 'playerNo', t.public_player_no),
    'gameCount', n_games,
    'conflicts', coalesce((select jsonb_agg(jsonb_build_object('gameId', c.game_id, 'gameNumber', c.game_number)) from public.link_conflicts(p_player_id, t.id) c), '[]'::jsonb)
  );
end;
$$;

create or replace function public.link_player_to_account(p_player_id uuid, p_player_no bigint, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  seat public.profiles;
  t public.profiles;
  conflict_numbers text;
  moved uuid[];
  moved_numbers integer[];
  gid uuid;
  theirs public.game_players;
  link_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into seat from public.profiles where id = p_player_id for update;
  if seat.id is null or (seat.managed_by is distinct from auth.uid() and not public.is_app_admin()) then
    raise exception 'Only your own unregistered players can be linked.';
  end if;
  if coalesce(seat.player_status, 'registered') not in ('unregistered', 'pending') then
    raise exception 'Only an unregistered player can be linked to a Player ID.';
  end if;
  t := public.link_target_for(p_player_no, p_email);
  if t.id = seat.id then raise exception 'That is this same player.'; end if;

  select string_agg(coalesce('G' || c.game_number::text, 'a game'), ', ') into conflict_numbers from public.link_conflicts(seat.id, t.id) c;
  if conflict_numbers is not null then
    raise exception '% already plays in %. Remove one of the two from those games first, then link.',
      coalesce(nullif(t.display_name, ''), 'That player'), conflict_numbers;
  end if;

  -- Serialise with the per-game score writers (019) so a round saved mid-link lands on one id.
  for gid in
    select gp.game_id from public.game_players gp
    where gp.profile_id = seat.id and gp.role <> 'spectator' and coalesce(gp.seated, true)
    order by gp.game_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('game:' || gid::text, 0));
    -- The account may already be here as a non-playing admin or a viewer: one membership, admin role kept (017).
    select * into theirs from public.game_players gp where gp.game_id = gid and gp.profile_id = t.id;
    if theirs.id is not null then delete from public.game_players gp where gp.id = theirs.id; end if;
    update public.game_players
       set profile_id = t.id,
           seated = true,
           role = case when theirs.role = 'game_admin' then 'game_admin' else role end
     where game_id = gid and profile_id = seat.id;
    update public.scores set profile_id = t.id where game_id = gid and profile_id = seat.id;
    update public.rounds set dealer_profile_id = t.id where game_id = gid and dealer_profile_id = seat.id;
    moved := array_append(coalesce(moved, '{}'), gid);
    theirs := null;
  end loop;
  moved := coalesce(moved, '{}');
  select coalesce(array_agg(g.game_number order by g.game_number) filter (where g.game_number is not null), '{}') into moved_numbers
  from public.games g where g.id = any(moved);

  -- Recorded like a claimed link so "wrong person" can be undone with unlink_player (011).
  update public.player_links set status = 'revoked' where player_id = seat.id and status = 'pending';
  insert into public.player_links (owner_id, player_id, email, kind, status, claimed_by, claimed_at, game_numbers, moved_game_ids, expires_at)
  values (auth.uid(), seat.id, lower(btrim(p_email)), 'link', 'claimed', t.id, now(), moved_numbers, moved, now())
  returning id into link_id;
  update public.profiles set player_status = 'merged' where id = seat.id;

  if t.id <> auth.uid() then
    insert into public.my_players (owner_id, player_id, games_together)
    values (auth.uid(), t.id, coalesce(array_length(moved, 1), 0))
    on conflict (owner_id, player_id) do update set games_together = public.my_players.games_together + excluded.games_together;
  end if;
  delete from public.my_players where owner_id = auth.uid() and player_id = seat.id;

  return jsonb_build_object(
    'linkId', link_id,
    'playerName', coalesce(nullif(seat.display_name, ''), 'Player'),
    'target', jsonb_build_object('id', t.id, 'name', coalesce(nullif(t.display_name, ''), 'Rummy Player'), 'playerNo', t.public_player_no),
    'movedGameIds', to_jsonb(moved),
    'movedGameNumbers', to_jsonb(moved_numbers)
  );
end;
$$;

revoke all on function public.link_target_for(bigint, text) from public, anon, authenticated;
revoke all on function public.link_conflicts(uuid, uuid) from public, anon, authenticated;
revoke all on function public.link_player_check(uuid, bigint, text) from public, anon;
grant execute on function public.link_player_check(uuid, bigint, text) to authenticated;
revoke all on function public.link_player_to_account(uuid, bigint, text) from public, anon;
grant execute on function public.link_player_to_account(uuid, bigint, text) to authenticated;
