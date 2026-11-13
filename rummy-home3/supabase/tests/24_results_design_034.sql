-- 034 results design: a finished game with no rounds saves with every seated player at 0 (not
-- "0 players"); every result has version 1 and gains a version when a game in it is deleted;
-- public_result takes an optional version, returns the versions list, keeps a deleted result's
-- summary, and carries each game's code, creator, admins and round count for the /r/ page.
begin;
select plan(48);

\set B '''10000000-0000-4000-8000-00000000000b'''
\set R1 '''20000000-0000-4000-8000-0000000000e1'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set N '''10000000-0000-4000-8000-0000000000aa'''

-- ---------- shape and grants ----------
select has_table('public', 'result_versions', 'result_versions exists');
select has_function('public', 'public_result', array['uuid', 'integer'], 'public_result(uuid, integer)');
select hasnt_function('public', 'public_result', array['uuid'], 'the one-argument public_result is gone (no PostgREST ambiguity)');
select has_function('public', 'snapshot_result_version', array['uuid', 'text', 'uuid']);
select ok(has_function_privilege('anon', 'public.public_result(uuid, integer)', 'execute'), 'anon calls public_result (the /r/ page)');
select ok(not has_function_privilege('anon', 'public.snapshot_result_version(uuid, text, uuid)', 'execute'), 'anon cannot snapshot');
select ok(not has_table_privilege('authenticated', 'public.result_versions', 'select'), 'nobody reads result_versions directly');
select ok((select coalesce(proconfig @> array['jit=off'], false) from pg_proc where oid = 'public.public_result(uuid, integer)'::regprocedure), 'jit stays off on public_result (032)');
select is((select count(*)::int from public.result_versions where result_id = :R1), 1, 'the seeded result R1 has its version 1 (insert trigger)');
select is((select note from public.result_versions where result_id = :R1 and version = 1), 'Saved', 'version 1 is "Saved"');

-- ---------- A. game with no rounds: seated players count ----------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at)
values (:N, :SREE, 'completed', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEN1', now() - interval '1 day', now() - interval '23 hours');
insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  (:N, :SREE, 0, 'game_admin', true),
  (:N, :HARISH, 1, 'player', true),
  (:N, :PRIYA, 2, 'player', true),
  (:N, :ZERO, 3, 'player', true),
  (:N, '00000000-0000-4000-8000-000000000004', 4, 'spectator', false),
  (:N, '00000000-0000-4000-8000-000000000006', 5, 'game_admin', false);

select tests.login(:SREE);
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-0000000000aa']::uuid[]) $$, 'a finished game with no rounds can be saved');
select tests.logout();
create temp table t_rn as select id from public.game_results where declared_by = :SREE order by declared_at desc limit 1;
grant select on t_rn to authenticated, anon;
\set RN '(select id from t_rn)'
select is((select jsonb_array_length(places->'standings') from public.game_results where id = :RN), 4, 'four seated players in the standings (not 0)');
select is((select jsonb_array_length(places->'players') from public.game_results where id = :RN), 4, 'four players');
select ok((select bool_and((s->>'points')::int = 0 and (s->>'games')::int = 1 and (s->>'place')::int = 1) from public.game_results r, jsonb_array_elements(r.places->'standings') s where r.id = :RN), 'everyone has 0 points, 1 game, shared first place');
select is((select places->'games'->0->'scores'->>:HARISH from public.game_results where id = :RN), '0', 'the per-game scores carry 0 for a seated player');
select ok(not (select places->'games'->0->'scores' ? '00000000-0000-4000-8000-000000000004' from public.game_results where id = :RN), 'the spectator is not in the result');
select ok(not (select places->'games'->0->'scores' ? '00000000-0000-4000-8000-000000000006' from public.game_results where id = :RN), 'the non-playing admin is not in the result');
select is((select count(*)::int from public.result_versions where result_id = :RN), 1, 'the new result has version 1');
select is((select saved_by from public.result_versions where result_id = :RN and version = 1), :SREE, 'version 1 is by the declarer');

-- ---------- B. a scored game still totals as before; a player who left keeps their points ----------
insert into public.game_players (game_id, profile_id, player_order, role, seated) values (:B, :SREE, 9, 'game_admin', false);
update public.game_players set seated = false where game_id = :B and profile_id = :PRIYA;  -- left mid-game, scores stay
select tests.login(:SREE);
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000b']::uuid[]) $$, 'sree saves B again');
select tests.logout();
create temp table t_rb as select id from public.game_results where declared_by = :SREE and id <> (select id from t_rn) order by declared_at desc limit 1;
grant select on t_rb to authenticated, anon;
\set RB '(select id from t_rb)'
select is((select jsonb_array_length(places->'standings') from public.game_results where id = :RB), 3, 'B: harish, priya (left, scored) and ab');
select is((select s->>'points' from public.game_results r, jsonb_array_elements(r.places->'standings') s where r.id = :RB and s->>'id' = :HARISH::text), '60', 'harish 60 as before');
select is((select s->>'points' from public.game_results r, jsonb_array_elements(r.places->'standings') s where r.id = :RB and s->>'id' = :PRIYA::text), '-25', 'priya keeps -25 although her seat is no longer seated');

-- ---------- C. public_result: games carry code, creator, admins, rounds ----------
select tests.anon();
select is(public.public_result(:RB)->>'version', '1', 'latest version is 1');
select is(public.public_result(:RB)->>'currentVersion', '1');
select is(jsonb_array_length(public.public_result(:RB)->'versions'), 1, 'one version listed');
select is(public.public_result(:RB)->'versions'->0->>'note', 'Saved');
select is(public.public_result(:RB)->'games'->0->>'code', 'GAMEB1', 'the game code (share code) is in the public result');
select is(public.public_result(:RB)->'games'->0->>'creatorName', 'Harish Test', 'creator name');
select is(public.public_result(:RB)->'games'->0->>'roundCount', '1', 'round count');
select is(public.public_result(:RB)->'games'->0->'adminNames', '["Sree Test"]'::jsonb, 'admins other than the creator (sree, the non-playing admin seat)');
select is(public.public_result(:RB)->>'deleted', 'false', 'not deleted');
select is(public.public_result(:RB)->>'declarerName', 'Sree Test', 'who generated it');
select ok(not (public.public_result(:RB)::text like '%' || :HARISH::text || '%'), 'no account id leaks');
select tests.logout();

-- ---------- D. deleting a game in the result writes version 2; versions can be read back ----------
select tests.login(:HARISH);
select lives_ok($$ select public.delete_game('10000000-0000-4000-8000-00000000000b') $$, 'harish (creator) deletes B');
select tests.logout();
select is((select count(*)::int from public.result_versions where result_id = :RB), 2, 'RB now has two versions');
select alike((select note from public.result_versions where result_id = :RB and version = 2), '%removed · game deleted', 'version 2 says which game left and why');
select is((select count(*)::int from public.result_versions where result_id = :R1), 2, 'R1 (also holding B) gets a version 2 too');
select tests.anon();
select is(public.public_result(:RB)->>'version', '2', 'the page shows the latest version by default');
select is(jsonb_array_length(public.public_result(:RB)->'games'), 0, 'version 2 has no games left');
select is(jsonb_array_length(public.public_result(:RB, 1)->'games'), 1, 'version 1 still shows the game as saved');
select is(public.public_result(:RB, 1)->'standings'->0->>'points', '60', 'version 1 keeps the saved totals');
select is(public.public_result(:RB, 99)->>'version', '2', 'a version past the end falls back to the latest');
select tests.logout();

-- ---------- E. a deleted result keeps its summary on the page ----------
select tests.login(:HARISH);
select lives_ok($$ select public.delete_result('20000000-0000-4000-8000-0000000000e1') $$, 'harish deletes R1');
select tests.logout();
select tests.anon();
select is(public.public_result(:R1)->>'deleted', 'true', 'the page knows the result is deleted');
select ok((public.public_result(:R1)->>'deletedAt') is not null, 'and when');
select is(jsonb_array_length(public.public_result(:R1, 1)->'standings'), 3, 'the summary as saved is still there, read-only (B left R1 above, so the latest version is empty)');
select is(jsonb_array_length(public.public_result(:R1)->'versions'), 2, 'both versions are listed on a deleted result');
select tests.logout();

select * from finish();
rollback;
