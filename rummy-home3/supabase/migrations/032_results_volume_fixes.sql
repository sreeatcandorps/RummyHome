-- 032: two fixes found by the volume tests (final launch batch, item 9; see docs/volume-testing.md)
--
-- 1. public_result (the web /r/ results page) took ~600 ms for a 30-game × 20-player result
--    because Postgres JIT-compiled its large expression tree on every call (the bundle RPCs
--    from 020 already turn JIT off). Same body, jit off: ~16 ms.
-- 2. game_rounds_json (the per-round values in a results sheet) looked every (player, round)
--    cell up one at a time: 200 index lookups per 20-seat game, ~11 ms per game, ~250 ms for
--    a 30-game sheet. Rewritten as one pass over the game's live scores; same output
--    ({profile id: [round 1, round 2, ...]} with null where a player has no score in a live
--    round, players from p_scores only, 'EX' skipped, null when the caller may not read the
--    game, arrays empty when they may read the game row but not its scores). ~1.5 ms per game,
--    a 30-game sheet ~50 ms.
--
-- Backward compatible: same signatures and return types, same JSON shape. Re-runnable.
-- Rollback: supabase/rollback/rollback_032_results_volume_fixes.sql (restores the 020 body and
-- resets jit on public_result).

alter function public.public_result(uuid) set jit = off;

create or replace function public.game_rounds_json(p_game_id uuid, p_scores jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
set jit = off
as $$
  with live as materialized (
    -- the latest live score per (player, round), one pass over the game (materialized so the
    -- per-player lateral below reads it instead of re-running the scan 20 times)
    select distinct on (s.profile_id, r.round_number)
           s.profile_id::text as pid, r.round_number as n, s.value
    from public.scores s
    join public.rounds r on r.id = s.round_id
    where s.game_id = p_game_id
      and r.undone_at is null
      and s.score_type <> 'expense'
      and public.can_read_game_detail(p_game_id)
    order by s.profile_id, r.round_number, s.created_at desc
  ),
  span as materialized (
    select max(r.round_number) as last_round
    from public.rounds r
    where r.game_id = p_game_id and r.undone_at is null
      and public.can_read_game_detail(p_game_id)
  )
  select case
    when not public.can_read_game(p_game_id) then null
    else coalesce((
      select jsonb_object_agg(k.pid, coalesce(v.vals, '[]'::jsonb))
      from jsonb_object_keys(coalesce(p_scores, '{}'::jsonb)) k(pid)
      left join lateral (
        select jsonb_agg(l.value order by rn.n) as vals
        from span, generate_series(1, span.last_round) rn(n)
        left join live l on l.pid = k.pid and l.n = rn.n
      ) v on true
      where k.pid <> 'EX'
    ), '{}'::jsonb)
  end;
$$;

comment on function public.game_rounds_json(uuid, jsonb) is
  'Per-round values of one game for the results sheet, {profile id: [round 1, ...]} (032: one pass over the scores).';
