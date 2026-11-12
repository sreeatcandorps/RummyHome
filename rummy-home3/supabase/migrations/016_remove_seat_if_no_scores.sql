-- 016: Players in this game — take a seat out of a game, but only while it has no scores.
--
-- A game admin may remove a seated player when that player has no score rows in
-- the game, or when every one of their round scores is exactly 0 (for example a
-- mid-game joiner whose rounds were backfilled with zeros). One non-zero round
-- anywhere blocks the removal; the total is never what is checked, each round is.
--
-- Why a function: clients have no delete policy on public.scores, so the zero
-- rows of a joiner could not be cleaned up from the app, and the all-zero rule
-- must be enforced where the data lives, not only in the UI.
--
-- Checks, in order: signed in; admin of this game (or app admin); the seat is in
-- this game; the game is not closed; every live round score for the seat is 0;
-- at least two seated players remain afterwards (a game needs two columns).
-- Retired rounds (edited away, round_number >= 1000, or undone) do not count.

create or replace function public.remove_seat_if_no_scores(p_game_id uuid, p_profile_id uuid)
returns table (removed boolean, zero_scores_deleted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  seat public.game_players;
  non_zero integer;
  zeros integer;
  seated_left integer;
  closed timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can remove players.' using errcode = '42501';
  end if;

  select * into seat from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_profile_id for update;
  if seat.game_id is null then raise exception 'That player is not in this game.'; end if;

  select g.closed_at into closed from public.games g where g.id = p_game_id;
  if closed is not null then raise exception 'This game is closed. Its players cannot change.'; end if;

  select count(*) into non_zero
  from public.scores s
  join public.rounds r on r.id = s.round_id
  where s.game_id = p_game_id
    and s.profile_id = p_profile_id
    and r.undone_at is null
    and r.round_number < 1000
    and s.value <> 0;
  if non_zero > 0 then
    raise exception 'You cannot delete this player. You cannot delete a player that has a score. You will have to edit the round and delete all his scores before you remove a player.'
      using errcode = 'P0001';
  end if;

  select count(*) into seated_left
  from public.game_players gp
  where gp.game_id = p_game_id
    and gp.profile_id <> p_profile_id
    and gp.role <> 'spectator'
    and gp.seated;
  if seat.role <> 'spectator' and seat.seated and seated_left < 2 then
    raise exception 'A game needs at least two players. Add someone else before removing this player.';
  end if;

  -- Every remaining score row for this seat in this game is a 0 (live or retired); none carries information.
  delete from public.scores s where s.game_id = p_game_id and s.profile_id = p_profile_id;
  get diagnostics zeros = row_count;

  update public.rounds set dealer_profile_id = null where game_id = p_game_id and dealer_profile_id = p_profile_id;
  delete from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_profile_id;

  return query select true, zeros;
end;
$$;

revoke all on function public.remove_seat_if_no_scores(uuid, uuid) from public;
revoke all on function public.remove_seat_if_no_scores(uuid, uuid) from anon;
grant execute on function public.remove_seat_if_no_scores(uuid, uuid) to authenticated;

comment on function public.remove_seat_if_no_scores(uuid, uuid) is
  'Game admin removes a seat only when every one of its round scores is 0 (or it has none). Deletes the zero score rows and the game_players row.';
