-- 049 — D46 C (Sree, Nov 18): reopening a pool that already has awards clears them.
--
-- The awards were worked out from the standings at Complete. Reopen exists to add or edit rounds,
-- which changes those standings, so the awards would be stale and a result could be saved on them
-- without anyone looking again. From 049 the reopen itself clears prize_shares / awarded_at /
-- awarded_by / award_note; the pool is "awards pending" again and asks for them after the next
-- Complete. The Log gets a line so nobody wonders where the awards went.
--
-- A pool in a saved result is Closed and cannot be reopened at all (reopenGame checks closed_at;
-- the results keep their stored places) — this trigger never fires for one.
--
-- Safe to run twice.
create or replace function public.games_pool_reopen_clears_awards()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.game_type = 'pool' and old.status = 'completed' and new.status = 'active'
     and old.awarded_at is not null then
    perform public.log_event(new.id, null, 'awards_changed', 'important',
      'Awards cleared · The pool was reopened; give them again after Complete',
      jsonb_build_object('reopened', true, 'cleared', coalesce(old.prize_shares, '{}'::jsonb), 'note', old.award_note));
    new.prize_shares := null;
    new.awarded_at := null;
    new.awarded_by := null;
    new.award_note := null;
  end if;
  return new;
end;
$$;
revoke all on function public.games_pool_reopen_clears_awards() from public, anon, authenticated;
drop trigger if exists games_pool_reopen_clears_awards on public.games;
create trigger games_pool_reopen_clears_awards before update of status on public.games
  for each row execute function public.games_pool_reopen_clears_awards();

notify pgrst, 'reload schema';
