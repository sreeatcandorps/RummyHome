-- 032 results volume fixes: game_rounds_json answers exactly what the 020 body answered (checked
-- on every seeded game for every viewer), and public_result runs with JIT off.
begin;
select plan(13);

-- the 020 body, kept here only to compare against
create or replace function tests.game_rounds_json_020(p_game_id uuid, p_scores jsonb)
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

\set A '''10000000-0000-4000-8000-00000000000a'''
\set B '''10000000-0000-4000-8000-00000000000b'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set VIEWER '''00000000-0000-4000-8000-000000000004'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''

select is((select proconfig from pg_proc where proname = 'public_result' and pronamespace = 'public'::regnamespace) @> array['jit=off'], true, 'public_result runs with JIT off');
select is((select proconfig from pg_proc where proname = 'game_rounds_json' and pronamespace = 'public'::regnamespace) @> array['jit=off'], true, 'game_rounds_json runs with JIT off');

-- the per-game totals object the results sheet passes in: every seated player of the game
create or replace function tests.scores_arg(p_game uuid) returns jsonb language sql as $$
  select coalesce(jsonb_object_agg(gp.profile_id::text, 0), '{}'::jsonb) || '{"EX": 0}'::jsonb
  from public.game_players gp where gp.game_id = p_game and gp.role <> 'spectator' and coalesce(gp.seated, true)
$$;

select tests.login(:SREE);
select is(public.game_rounds_json(:A, tests.scores_arg(:A)), tests.game_rounds_json_020(:A, tests.scores_arg(:A)), 'creator, game A: same as 020');
select is(public.game_rounds_json(:A, tests.scores_arg(:A))->:HARISH->1, '40'::jsonb, 'harish round 2 = 40 (the undone round 1003 is ignored)');
select is(jsonb_array_length(public.game_rounds_json(:A, tests.scores_arg(:A))->:HARISH), 2, 'two live rounds');
select is(public.game_rounds_json(:C, tests.scores_arg(:C)), tests.game_rounds_json_020(:C, tests.scores_arg(:C)), 'creator, closed game C: same as 020');
select ok(not (public.game_rounds_json(:A, tests.scores_arg(:A)) ? 'EX'), 'the expense column is skipped');

select tests.login(:HARISH);
select is(public.game_rounds_json(:A, tests.scores_arg(:A)), tests.game_rounds_json_020(:A, tests.scores_arg(:A)), 'seated player, game A: same as 020');
select is(public.game_rounds_json(:B, tests.scores_arg(:B)), tests.game_rounds_json_020(:B, tests.scores_arg(:B)), 'declarer, game B: same as 020');

select tests.login(:VIEWER);
select is(public.game_rounds_json(:A, tests.scores_arg(:A)), tests.game_rounds_json_020(:A, tests.scores_arg(:A)), 'spectator, game A: same as 020');

select tests.login(:OUTSIDER);
select is(public.game_rounds_json(:A, tests.scores_arg(:A)), null, 'outsider: null (may not read the game)');
select is(public.game_rounds_json(:A, tests.scores_arg(:A)), tests.game_rounds_json_020(:A, tests.scores_arg(:A)), 'outsider: same as 020');

-- a player with a score in round 1 only still gets a two-slot array with null in round 2
select tests.login(:SREE);
select is(public.game_rounds_json(:A, '{"00000000-0000-4000-8000-000000000003": 0}'::jsonb)->'00000000-0000-4000-8000-000000000003', '[-20, -40]'::jsonb, 'priya: -20 then -40');

select * from finish();
rollback;
