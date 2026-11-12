-- Rollback for 032_results_volume_fixes.sql: the 020 game_rounds_json body and JIT back to the
-- server default on public_result.

alter function public.public_result(uuid) reset jit;

create or replace function public.game_rounds_json(p_game_id uuid, p_scores jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.can_read_game(p_game_id) then null
    else coalesce((
      select jsonb_object_agg(k.pid, coalesce(v.vals, '[]'::jsonb))
      from jsonb_object_keys(coalesce(p_scores, '{}'::jsonb)) k(pid)
      left join lateral (
        select jsonb_agg(sc.value order by rn.n) as vals
        from generate_series(1, (
          select max(r.round_number) from public.rounds r
          where r.game_id = p_game_id and r.undone_at is null
            and public.can_read_game_detail(p_game_id)
        )) rn(n)
        left join lateral (
          select s.value
          from public.scores s
          join public.rounds r on r.id = s.round_id
          where s.game_id = p_game_id
            and r.undone_at is null
            and r.round_number = rn.n
            and s.profile_id::text = k.pid
            and s.score_type <> 'expense'
          order by s.created_at desc
          limit 1
        ) sc on true
      ) v on true
      where k.pid <> 'EX'
    ), '{}'::jsonb)
  end;
$$;
