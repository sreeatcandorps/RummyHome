-- 050 — a Closed game (in a saved result) cannot change on the server either.
--
-- Until now only the app refused this: reopenGame checks closed_at, and the scorecard hides Add round /
-- Undo / Edit round / Reopen on a Closed game. The server did not — save_round, undo_last_round and the
-- games / rounds / scores RLS policies let a game admin (or a direct API call) add, undo or edit a round or
-- set a Closed game back to Active, which would leave its saved result on stale totals. Came up in Sree's
-- D46 question (Nov 18): "what if this pool game is part of a result?". Suggested there, built here.
--
-- Three small triggers, one rule: while closed_at is set (and stays set), the game's status, completed_at,
-- rounds and scores do not change (deletes are left alone: the app never deletes a round, and a hard delete
-- of a game cascades through them). Identity moves (dealer_profile_id / profile_id when a seat is linked to
-- an account, 015 / 017 / 025) are not touched by the rule, so linking still works on Closed games.
-- Closing (closed_at set) and unclosing (closed_at cleared when the result is deleted or the game removed
-- from it) are the moments the rule does not apply.
--
-- Safe to run twice.
create or replace function public.closed_game_message()
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select 'This game is Closed: it is part of a saved result. Delete the result first.'::text $$;

create or replace function public.games_closed_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.closed_at is not null and new.closed_at is not null
     and (new.status is distinct from old.status or new.completed_at is distinct from old.completed_at) then
    raise exception '%', public.closed_game_message() using errcode = 'PT423';
  end if;
  return new;
end;
$$;
revoke all on function public.games_closed_guard() from public, anon, authenticated;
drop trigger if exists games_closed_guard on public.games;
create trigger games_closed_guard before update of status, completed_at on public.games
  for each row execute function public.games_closed_guard();

create or replace function public.rounds_closed_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.games g where g.id = new.game_id and g.closed_at is not null) then
    raise exception '%', public.closed_game_message() using errcode = 'PT423';
  end if;
  return new;
end;
$$;
revoke all on function public.rounds_closed_guard() from public, anon, authenticated;
drop trigger if exists rounds_closed_guard on public.rounds;
create trigger rounds_closed_guard before insert or update of undone_at, round_number, game_id on public.rounds
  for each row execute function public.rounds_closed_guard();

drop trigger if exists scores_closed_guard on public.scores;
create trigger scores_closed_guard before insert or update of value, score_type, round_id, game_id on public.scores
  for each row execute function public.rounds_closed_guard();

notify pgrst, 'reload schema';
