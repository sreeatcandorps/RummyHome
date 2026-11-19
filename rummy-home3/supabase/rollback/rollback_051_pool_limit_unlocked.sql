-- Rollback for 051 (D53: the pool limit is no longer locked). Drops the limit-changed trigger and puts
-- the 042 lock back (limit fixed once a live round exists). Log rows stay (event_log is append-only), so
-- the kind constraint keeps 'player_back_in' — dropping it would fail on any row already written.
drop trigger if exists games_pool_limit_changed on public.games;
drop function if exists public.games_pool_limit_changed();

-- 042 B body, byte-for-byte.
-- ---------- B. only the pool limit is locked ----------
create or replace function public.games_pool_settings_lock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.game_type = 'pool' and new.settings is distinct from old.settings
     and exists (select 1 from public.rounds r where r.game_id = new.id and r.undone_at is null)
     and (new.settings->>'poolLimit') is distinct from (old.settings->>'poolLimit') then
    raise exception 'Rounds have been saved. The pool limit is locked — changing it would change who is out. Undo every round to edit it.'
      using errcode = 'PT423';
  end if;
  return new;
end;
$$;
revoke all on function public.games_pool_settings_lock() from public, anon, authenticated;
drop trigger if exists games_pool_settings_lock on public.games;
create trigger games_pool_settings_lock before update of settings on public.games
  for each row execute function public.games_pool_settings_lock();
