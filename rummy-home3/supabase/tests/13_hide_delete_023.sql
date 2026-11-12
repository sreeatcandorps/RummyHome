-- 023 hide and soft delete. Hide is per user and touches only Home. Delete game (creator /
-- game admin) and Delete result (declarer / admin of its games) are soft, gone for everyone,
-- restorable by the deleter or an admin, and excluded by every reader. A deleted game in a
-- saved result is removed from it; the result is recomputed; a restore never re-adds it.
-- Seed: A = sree's active game (harish, priya, rk, zero seated); B = harish's completed game
-- (harish 60, priya -25, ab -35) in result R1; C = sree's completed closed game (harish, zero, cd; no rounds).
begin;
select plan(71);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set B '''10000000-0000-4000-8000-00000000000b'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set R1 '''20000000-0000-4000-8000-0000000000e1'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''

-- ---------- objects ----------
select has_column('public', 'games', 'deleted_at', 'games.deleted_at');
select has_column('public', 'games', 'deleted_by', 'games.deleted_by');
select has_column('public', 'game_results', 'deleted_at', 'game_results.deleted_at');
select has_column('public', 'game_result_games', 'removed_at', 'game_result_games.removed_at');
select has_table('public', 'hidden_games', 'hidden_games exists');
select ok((select relrowsecurity from pg_class where oid = 'public.hidden_games'::regclass), 'hidden_games has RLS');
select has_function('public', 'hide_game', array['uuid']);
select has_function('public', 'delete_game', array['uuid']);
select has_function('public', 'restore_game', array['uuid']);
select has_function('public', 'delete_result', array['uuid']);
select has_function('public', 'restore_result', array['uuid']);
select has_function('public', 'list_hidden_and_deleted', '{}'::text[]);

-- ---------- hide: per user, Home only ----------
select tests.login(:HARISH);
select ok(public.get_home_bundle(50)->'games' @> jsonb_build_array(jsonb_build_object('id', :A::text)), 'harish sees A on Home before hiding');
select lives_ok($$ select public.hide_game('10000000-0000-4000-8000-00000000000a') $$, 'a seated player hides a game');
select ok(not public.get_home_bundle(50)->'games' @> jsonb_build_array(jsonb_build_object('id', :A::text)), 'hidden: A is off harish''s Home');
select is((public.get_home_bundle(50)->>'hidden_count')::int, 1, 'home bundle counts one hidden game');
select ok(exists (select 1 from jsonb_array_elements(public.list_result_candidates(50)) c where c->'game'->>'id' = :A), 'hidden: A still shows in the Results picker');
select ok(public.can_read_game(:A), 'hidden: A still opens');
select ok(:A in (select public.list_visible_game_ids()), 'hidden: A is still a visible game (stats unchanged)');
select is((select jsonb_array_length(public.list_hidden_and_deleted()->'hidden')), 1, 'Settings lists the hidden game');
select is((select public.list_hidden_and_deleted()->'hidden'->0->>'creatorName'), 'Sree Test', 'hidden row names the creator');
select tests.logout();
select tests.login(:PRIYA);
select ok(public.get_home_bundle(50)->'games' @> jsonb_build_array(jsonb_build_object('id', :A::text)), 'hide is per user: priya still sees A');
select tests.logout();
select tests.login(:HARISH);
select lives_ok($$ select public.unhide_game('10000000-0000-4000-8000-00000000000a') $$, 'unhide');
select ok(public.get_home_bundle(50)->'games' @> jsonb_build_array(jsonb_build_object('id', :A::text)), 'unhidden: A is back on harish''s Home');
select tests.logout();
select tests.login(:OUTSIDER);
select throws_like($$ select public.hide_game('10000000-0000-4000-8000-00000000000a') $$, '%not available%', 'an outsider cannot hide a game they cannot see');
select tests.logout();

-- ---------- delete a game: creator or game admin only ----------
update public.games set view_token = repeat('a', 48) where id = :A;
select tests.login(:PRIYA);
select throws_like($$ select public.delete_game('10000000-0000-4000-8000-00000000000a') $$, '%creator or a game admin%', 'a seated player cannot delete the game');
select tests.logout();
select tests.login(:SREE);
select is((select total_games from public.list_new_game_candidates(100) where id = :HARISH), 2, 'before: harish counted in 2 of sree''s games (A, C)');
select is((select games_together from public.my_players where owner_id = :SREE and player_id = :HARISH), 3, 'before: games_together 3');
select is((select public.delete_game(:A))->>'deleted', 'true', 'the creator deletes A');
select tests.logout();
select ok((select deleted_at is not null and deleted_by = :SREE from public.games where id = :A), 'A carries deleted_at / deleted_by');
select tests.login(:SREE);
select ok(:A not in (select public.list_visible_game_ids()), 'deleted: A is not a visible game id');
select ok(not public.get_home_bundle(50)->'games' @> jsonb_build_array(jsonb_build_object('id', :A::text)), 'deleted: A is off Home');
select ok(not exists (select 1 from jsonb_array_elements(public.list_result_candidates(50)) c where c->'game'->>'id' = :A), 'deleted: A is out of the Results picker');
select is((public.get_game_bundle(:A))->>'deleted', 'true', 'deleted: the bundle says deleted');
select is((public.get_game_bundle(:A))->'game'->>'can_restore', 'true', 'the deleter may restore');
select is((select total_games from public.list_new_game_candidates(100) where id = :HARISH), 1, 'deleted: A leaves the Frequent stats');
select is((select games_together from public.my_players where owner_id = :SREE and player_id = :HARISH), 2, 'deleted: games_together 2');
select is(jsonb_array_length(public.list_hidden_and_deleted()->'deletedGames'), 1, 'Settings lists the deleted game for sree');
select tests.logout();
select tests.login(:HARISH);
select is((public.get_game_bundle(:A))->'game'->>'can_restore', 'false', 'a plain player cannot restore');
select is((select count(*) from public.games where id = :A)::int, 0, 'the games read policy hides a deleted game');
select throws_like($$ select public.restore_game('10000000-0000-4000-8000-00000000000a') $$, '%restore%', 'a plain player cannot restore');
select tests.logout();
select tests.anon();
select is((public.public_scorecard(repeat('a', 48)))->>'deleted', 'true', 'the live share page learns the game was deleted');
select tests.logout();
select tests.login(:SREE);
select is((select public.restore_game(:A))->>'restored', 'true', 'the deleter restores A');
select tests.logout();
select ok((select deleted_at is null from public.games where id = :A), 'A is live again');
select tests.login(:SREE);
select is((select games_together from public.my_players where owner_id = :SREE and player_id = :HARISH), 3, 'restored: games_together back to 3');
select tests.logout();

-- ---------- a game inside a result: removed from it, result recomputed, never re-added ----------
-- sree becomes an admin of B so one person can declare B + C together.
insert into public.game_players (game_id, profile_id, player_order, role, seated) values (:B, :SREE, 9, 'game_admin', false);
select tests.login(:SREE);
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000b','10000000-0000-4000-8000-00000000000c']::uuid[]) $$, 'sree declares R2 = B + C');
select tests.logout();
create temp table t_r2 as select id from public.game_results where declared_by = :SREE order by declared_at desc limit 1;
grant select on t_r2 to authenticated, anon;
\set R2 '(select id from t_r2)'
select tests.login(:SREE);
select is((select jsonb_array_length(public.get_game_result(:R2)->'standings')), 3, 'R2 ranks the three scored players (C has no rounds, so only B''s players score)');
select is((select public.get_game_result(:R2)->'reusedGameIds'), to_jsonb(array[:B]), 'B is reused (also in R1)');
select is((select count(*) from public.results_holding_game(:B))::int, 2, 'two live results hold B');
select tests.logout();
select tests.login(:HARISH);
select ok((select (d->'removedFromResults') @> to_jsonb(array[:R1, :R2]) and jsonb_array_length(d->'removedFromResults') = 2 from public.delete_game(:B) d), 'deleting B removes it from R1 and R2');
select tests.logout();
select tests.login(:SREE);
select is((select public.get_game_result(:R2)->'gameIds'), to_jsonb(array[:C]), 'R2 now holds only C');
select is((select public.get_game_result(:R2)->'removedGameIds'), to_jsonb(array[:B]), 'R2 says B was removed');
select is((select jsonb_array_length(public.get_game_result(:R2)->'standings')), 0, 'R2 is recomputed from C alone: no scored players remain');
select is((select jsonb_array_length(public.get_game_result(:R2)->'sheet'->'games')), 1, 'the sheet keeps only C');
select is((select public.get_game_result(:R2)->'reusedGameIds'), '[]'::jsonb, 'nothing reused once B is out');
select tests.logout();
select ok((select closed_at is null from public.games where id = :B), 'B is not Closed any more');
select tests.login(:SREE);
select tests.logout();
select tests.login(:HARISH);
select is((select jsonb_array_length((public.restore_game(:B))->'removedFromResults')), 2, 'restore says which results B was removed from');
select tests.logout();
select ok((select closed_at is null from public.games where id = :B), 'restored B stays out of R1 and R2 (uncounted)');
select tests.login(:HARISH);
select is((select public.get_game_result(:R2)->'gameIds'), to_jsonb(array[:C]), 'R2 still holds only C after the restore');
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000b']::uuid[]) $$, 'B can go into a new result');
select tests.logout();
select ok((select closed_at is not null from public.games where id = :B), 'B is Closed again by the new result');
select tests.login(:HARISH);
select tests.logout();

-- ---------- delete a result ----------
select tests.login(:PRIYA);
select throws_like($$ select public.delete_result((select id from t_r2)) $$, '%saved this result%', 'a player cannot delete a result');
select tests.logout();
select tests.login(:SREE);
select is((select public.delete_result(:R2))->>'deleted', 'true', 'the declarer deletes R2');
select ok(not exists (select 1 from jsonb_array_elements(public.list_game_results_page(50, 0)) c where (c->>'id')::uuid = :R2), 'deleted: R2 is off the Results list');
select is((select public.get_game_result(:R2)->>'deleted'), 'true', 'deleted: get_game_result says so to the declarer');
select tests.logout();
select ok((select closed_at is null from public.games where id = :C), 'C is uncounted again (only R2 held it)');
select tests.login(:SREE);
select is((select jsonb_array_length(public.list_hidden_and_deleted()->'deletedResults')), 1, 'Settings lists the deleted result');
select is((select public.restore_result(:R2))->>'restored', 'true', 'restore R2');
select tests.logout();
select ok((select closed_at is not null from public.games where id = :C), 'C is Closed again');
select tests.login(:SREE);
select is((select public.delete_game(:C))->>'deleted', 'true', 'sree deletes C');
select throws_like($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000c']::uuid[]) $$, '%finished games%', 'a deleted game cannot be declared');
select tests.logout();

select * from finish();
rollback;
