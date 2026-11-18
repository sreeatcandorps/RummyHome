-- 046 (PR 22, Sree's rule Nov 15: nothing is ever permanently deleted). X22-1 schema: games.archived_at, the
-- game_archived kind, archive_deleted_games service-only, purge_deleted_games is the same harmless step.
-- X22-2 the nightly step hides a 31-day-old deleted game for good and keeps every row (game, seats,
-- rounds, scores, asks, Log); a 29-day-old game and one a live result holds are untouched; nothing in
-- the database shrinks. X22-3 an archived game is invisible to everyone in the app — the creator, an
-- admin, the deleter, a scored player, an app admin — not on Home, not in Settings › Hidden & deleted,
-- no bundle, no Log, no ask; restore_game refuses with PT410 and the support address; the public /s/
-- page says deleted. X22-4 support (dashboard / service role) still finds it and can hand it back.
-- Game A: sree (creator, admin), harish (admin), priya (player, scored); 005 is an outsider.
begin;
select plan(45);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set A '''10000000-0000-4000-8000-0000000000ea'''
\set FRESH '''10000000-0000-4000-8000-0000000000eb'''
\set HELD '''10000000-0000-4000-8000-0000000000ec'''

-- ---------- X22-1 schema ----------
select has_column('public', 'games', 'archived_at', 'X22-1 games.archived_at exists');
select has_function('public', 'archive_deleted_games', array[]::text[], 'X22-1 archive_deleted_games exists');
select has_function('public', 'purge_deleted_games', array[]::text[], 'X22-1 purge_deleted_games is still there (by name)');
select ok((select prosrc not like '%delete from public.games%' from pg_proc where proname = 'purge_deleted_games' and pronamespace = 'public'::regnamespace), 'X22-1 … and deletes nothing');
select ok((select prosrc not like '%delete from%' from pg_proc where proname = 'archive_deleted_games' and pronamespace = 'public'::regnamespace), 'X22-1 archive_deleted_games has no delete');
select ok(not has_function_privilege('authenticated', 'public.archive_deleted_games()', 'execute'), 'X22-1 the app cannot call the nightly step');
select ok(not has_function_privilege('anon', 'public.archive_deleted_games()', 'execute'), 'X22-1 … nor can anon');
select ok(has_function_privilege('service_role', 'public.archive_deleted_games()', 'execute'), 'X22-1 service_role (pg_cron, dashboard) can');
select ok((select pg_get_constraintdef(oid) like '%game_archived%' from pg_constraint where conname = 'event_log_kind'), 'X22-1 the Log accepts game_archived');
select is(public.deleted_game_retention(), interval '30 days', 'X22-1 the 30 days are unchanged');

-- ---------- game A: a real game with scores, deleted 31 days ago, with an ask on it ----------
insert into public.games (id, created_by, status, game_type, settings, share_code, view_token)
values (:A, :SREE, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'KEEP01', repeat('e', 48));
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:A, :SREE, 0, 1, 'game_admin', true, 'SK'),
  (:A, :HARISH, 1, 2, 'game_admin', true, 'HG'),
  (:A, :PRIYA, 2, 3, 'player', true, 'PT');
select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000ea', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20}]'::jsonb, false) $$, 'round 1');
select tests.login(:HARISH);
select is((public.delete_game(:A))->>'deleted', 'true', 'harish deletes game A');
select tests.login(:PRIYA);
select is((public.request_restore(:A))->>'already', 'false', 'priya asks for it back');
select tests.logout();
-- age the delete past the 30 days (the Log is immutable, the game row is not)
update public.games set deleted_at = now() - interval '31 days' where id = :A;

-- FRESH: deleted 29 days ago → untouched
insert into public.games (id, created_by, status, game_type, settings, share_code, deleted_at, deleted_by)
values (:FRESH, :SREE, 'completed', 'stake', '{"gameType":"stake"}', 'KEEP02', now() - interval '29 days', :SREE);
-- HELD: deleted 40 days ago, a live result still holds it → untouched (restorable while the result holds it)
insert into public.games (id, created_by, status, game_type, settings, share_code, deleted_at, deleted_by)
values (:HELD, :SREE, 'completed', 'stake', '{"gameType":"stake"}', 'KEEP03', now() - interval '40 days', :SREE);
insert into public.game_results (id, declared_by, declared_at, places) values ('20000000-0000-4000-8000-0000000000ec', :SREE, now() - interval '41 days', '{"games":[],"players":[],"standings":[]}');
insert into public.game_result_games (result_id, game_id) values ('20000000-0000-4000-8000-0000000000ec', :HELD);

-- ---------- X22-2 the nightly step ----------
create temp table before_counts as
select (select count(*) from public.games) games, (select count(*) from public.game_players) seats,
       (select count(*) from public.rounds) rounds, (select count(*) from public.scores) scores,
       (select count(*) from public.restore_requests) asks, (select count(*) from public.event_log) log_rows;

select is(public.archive_deleted_games(), 1, 'X22-2 exactly one game is hidden for good');
select ok((select archived_at is not null from public.games where id = :A), 'X22-2 game A carries archived_at');
select ok((select archived_at is null from public.games where id = :FRESH), 'X22-2 the 29-day-old game is untouched');
select ok((select archived_at is null from public.games where id = :HELD), 'X22-2 the result-held game is untouched');
select ok((select deleted_at is not null and deleted_by = :HARISH::uuid from public.games where id = :A), 'X22-2 the delete stamp is kept too');
select is((select games from before_counts), (select count(*) from public.games), 'X22-2 no game row was removed');
select is((select seats from before_counts), (select count(*) from public.game_players), 'X22-2 no seat was removed');
select is((select rounds from before_counts), (select count(*) from public.rounds), 'X22-2 no round was removed');
select is((select scores from before_counts), (select count(*) from public.scores), 'X22-2 no score was removed');
select is((select asks from before_counts), (select count(*) from public.restore_requests), 'X22-2 the ask is kept');
select is((select log_rows from before_counts) + 1, (select count(*) from public.event_log), 'X22-2 the Log grew by exactly the one game_archived row');
select is((select count(*)::int from public.event_log where game_id = :A and kind = 'game_archived'), 1, 'X22-2 … anchored on the game itself');
select ok((select summary like 'Game % was hidden for good 30 days after it was deleted' and actor_name = 'System' and actor_id is null from public.event_log where game_id = :A and kind = 'game_archived'), 'X22-2 … and says so, as System');
select is((select count(*)::int from public.event_log where purged_game_id is not null), 0, 'X22-2 nothing was re-anchored on purged_game_id');
select is(public.archive_deleted_games(), 0, 'X22-2 running it again touches nothing');
select is(public.purge_deleted_games(), 0, 'X22-2 the old name does the same and touches nothing');

-- ---------- X22-3 hidden from every user ----------
select tests.login(:PRIYA);
select ok(not public.can_read_game(:A), 'X22-3 the scored player can no longer read it');
select is(public.get_game_bundle(:A), null, 'X22-3 … no bundle');
select is((select count(*)::int from jsonb_array_elements((public.get_home_bundle(50))->'deleted_games') d where d->>'id' = '10000000-0000-4000-8000-0000000000ea'), 0, 'X22-3 … not under Deleted games on Home');
select throws_like($$ select public.request_restore('10000000-0000-4000-8000-0000000000ea') $$, '%not available%', 'X22-3 … cannot ask');
select is((select count(*)::int from public.event_log where game_id = :A), 0, 'X22-3 … reads no Log row of it (RLS)');

select tests.login(:HARISH);
select ok(not public.can_read_game(:A), 'X22-3 the admin who deleted it cannot read it');
select is((select count(*)::int from jsonb_array_elements((public.list_hidden_and_deleted())->'deletedGames') d where d->>'id' = '10000000-0000-4000-8000-0000000000ea'), 0, 'X22-3 … not in Settings › Hidden & deleted');
select throws_like($$ select public.restore_game('10000000-0000-4000-8000-0000000000ea') $$, '%hidden for good%support@ezscore.app%', 'X22-3 … and cannot restore it: the message points at support');

select tests.login(:SREE);
select ok(not public.can_read_game(:A), 'X22-3 the creator cannot read it either');
select throws_like($$ select public.restore_game('10000000-0000-4000-8000-0000000000ea') $$, '%hidden for good%', 'X22-3 … nor restore it');

select tests.anon();
select is((public.public_scorecard(repeat('e', 48)))->>'deleted', 'true', 'X22-3 the public /s/ page says deleted, nothing more');

-- ---------- X22-4 support still finds it ----------
select tests.logout();
select ok((select archived_at is not null from public.games where id = :A), 'X22-3 … so it stayed archived through the refused restores');
select is((select share_code from public.games where archived_at is not null and share_code = 'KEEP01'), 'KEEP01', 'X22-4 dashboard SQL finds the archived game by its code');
select is((select count(*)::int from public.scores where game_id = :A), 3, 'X22-4 … with all its scores');
-- support hands it back by hand: the game is a live one again for everyone
update public.games set archived_at = null, deleted_at = null, deleted_by = null where id = :A;
select tests.login(:PRIYA);
select ok(public.can_read_game(:A), 'X22-4 after support clears the stamps priya reads it again');
select is(public.get_game_bundle(:A)->>'deleted', null, 'X22-4 … as a live game');

select * from finish();
rollback;
