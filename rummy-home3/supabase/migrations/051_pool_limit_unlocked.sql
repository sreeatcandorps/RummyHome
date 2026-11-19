-- 051 (APK v12 feedback, Sree Nov 19 — D53): the pool limit is no longer locked once rounds exist.
-- Sree: "Pool limit locked. I don't think you should lock it … change it to 201 … a player that's out
-- comes back and becomes active … keep it as flexible as possible."
--
--  A. The 042 lock trigger (games_pool_settings_lock) and its function go. Drop, Middle drop, Full
--     count and Re-entries were already free; now the limit is too.
--  B. A new Log kind, player_back_in: a player who was out and is in again after the limit changed.
--  C. games_pool_limit_changed (after update of settings): when a pool's limit changes and live rounds
--     exist, out_round is re-derived from every player's totals against the new limit (041's
--     pool_recompute), then the Log gets one 'important' line per player whose state changed —
--     "X is out · 120 (limit 101) · Round 3" (kind player_out, as save_round writes it) or
--     "X is back in · 120 (limit 201)" (player_back_in). The 042 settings_changed line
--     ("Pool limit 101→201") is still written by event_log_games. A player who re-entered keeps
--     the re-entry: their total is still counted from the re-entry score (041 pool_total).
--
-- Safe to run twice. Rollback: supabase/rollback/rollback_051_pool_limit_unlocked.sql.

-- ---------- A. the lock goes ----------
drop trigger if exists games_pool_settings_lock on public.games;
drop function if exists public.games_pool_settings_lock();

-- ---------- B. Log kind ----------
alter table public.event_log drop constraint if exists event_log_kind;
alter table public.event_log add constraint event_log_kind check (kind in (
  'game_created', 'player_added', 'player_removed', 'viewer_added', 'viewer_removed',
  'admin_added', 'admin_removed', 'round_added', 'round_edited', 'round_undone',
  'settings_changed', 'initials_changed', 'player_renamed', 'completed', 'reopened',
  'closed', 'unclosed', 'deleted', 'restored',
  'result_saved', 'result_deleted', 'result_restored', 'result_changed',
  'player_out', 'player_reentered', 'reentry_undone', 'awards_set', 'awards_changed',
  'seating_changed',
  'restore_requested', 'game_purged', 'game_archived',
  'player_back_in'));

-- ---------- C. a changed limit re-reads who is out ----------
create or replace function public.games_pool_limit_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before jsonb;
  v_limit integer;
  v_rec record;
  v_name text;
begin
  if new.game_type <> 'pool' then return new; end if;
  if (new.settings->>'poolLimit') is not distinct from (old.settings->>'poolLimit') then return new; end if;
  if not exists (select 1 from public.rounds r where r.game_id = new.id and r.undone_at is null) then return new; end if;

  select coalesce(jsonb_object_agg(gp.profile_id::text, gp.out_round), '{}'::jsonb) into v_before
    from public.game_players gp where gp.game_id = new.id;
  v_limit := public.pool_limit_of(new.id);
  perform public.pool_recompute(new.id);

  for v_rec in
    select gp.profile_id, gp.out_round, public.pool_total(new.id, gp.profile_id) as total
      from public.game_players gp
     where gp.game_id = new.id and gp.role <> 'spectator' and coalesce(gp.seated, true)
     order by gp.player_order
  loop
    v_name := public.player_snapshot(new.id, v_rec.profile_id)->>'name';
    if v_rec.out_round is not null and (v_before->>(v_rec.profile_id::text)) is null then
      perform public.log_event(new.id, null, 'player_out', 'important',
        format('%s is out · %s (limit %s) · Round %s', v_name, v_rec.total, v_limit, v_rec.out_round),
        jsonb_build_object('round', v_rec.out_round, 'profileId', v_rec.profile_id, 'total', v_rec.total, 'limit', v_limit,
                           'limitChanged', true, 'names', jsonb_build_array(v_name)));
    elsif v_rec.out_round is null and (v_before->>(v_rec.profile_id::text)) is not null then
      perform public.log_event(new.id, null, 'player_back_in', 'important',
        format('%s is back in · %s (limit %s)', v_name, v_rec.total, v_limit),
        jsonb_build_object('profileId', v_rec.profile_id, 'total', v_rec.total, 'limit', v_limit,
                           'wasOutRound', (v_before->>(v_rec.profile_id::text))::integer, 'names', jsonb_build_array(v_name)));
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.games_pool_limit_changed() from public, anon, authenticated;
drop trigger if exists games_pool_limit_changed on public.games;
create trigger games_pool_limit_changed after update of settings on public.games
  for each row execute function public.games_pool_limit_changed();
comment on function public.games_pool_limit_changed() is '051: a pool limit change re-derives who is out (pool_recompute) and logs each player who went out or came back in.';
