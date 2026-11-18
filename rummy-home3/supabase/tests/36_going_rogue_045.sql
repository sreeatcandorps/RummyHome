-- 045 (PR 20 Going rogue, simplest option + Q20.1): a scored player reads a deleted game and sees it on
-- Home (X20-1); an unscored seat, a viewer and an outsider do not; the public /s/ page still says deleted.
-- request_restore: one ask per person per game, the Log row, notices + emails to the creator and every
-- admin, refused for outsiders, for live games and for people who can restore themselves (X20-2).
-- The 30-day step (X20-3, rewritten by 046): a 31-day-old game with no live result is hidden for good
-- (archived_at) and keeps every row; a 29-day-old game and one held by a live result are left alone.
-- 045's hard delete is gone — see 37_no_permanent_delete_046.sql for the archive semantics in full.
-- Game D: sree (creator, admin), harish (admin, seated), priya (player, scored), zero (seated, never
-- scored); 004 is a viewer; 005 is an outsider.
begin;
select plan(61);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set VIEWER '''00000000-0000-4000-8000-000000000004'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set D '''10000000-0000-4000-8000-0000000000fa'''
\set OLD '''10000000-0000-4000-8000-0000000000fb'''
\set FRESH '''10000000-0000-4000-8000-0000000000fc'''
\set HELD '''10000000-0000-4000-8000-0000000000fd'''

-- ---------- schema ----------
select has_table('public', 'restore_requests', 'the asks table exists');
select has_function('public', 'request_restore', array['uuid']);
select has_function('public', 'purge_deleted_games', array[]::text[]);
select has_function('public', 'can_read_deleted_game', array['uuid']);
select has_column('public', 'event_log', 'purged_game_id', 'purged rows keep their game id');
select ok((select pg_get_constraintdef(oid) like '%restore_requested%' and pg_get_constraintdef(oid) like '%game_purged%' from pg_constraint where conname = 'event_log_kind'), 'the Log accepts the two new kinds');
select ok((select pg_get_constraintdef(oid) like '%restore_requested%' from pg_constraint where conname = 'email_outbox_kind_check'), 'the outbox accepts restore_requested');
select is(public.deleted_game_retention(), interval '30 days', 'a deleted game is kept 30 days');
select ok(not has_function_privilege('authenticated', 'public.purge_deleted_games()', 'execute'), 'the app cannot call the purge');
select ok(has_function_privilege('authenticated', 'public.request_restore(uuid)', 'execute'), 'signed-in players can ask');

-- ---------- game D: two rounds, priya scored, zero never (added after the rounds) ----------
insert into public.games (id, created_by, status, game_type, settings, share_code, view_token)
values (:D, :SREE, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'ROGUE1', repeat('d', 48));
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:D, :SREE, 0, 1, 'game_admin', true, 'SK'),
  (:D, :HARISH, 1, 2, 'game_admin', true, 'HG'),
  (:D, :PRIYA, 2, 3, 'player', true, 'PT'),
  (:D, :VIEWER, 900, 4, 'spectator', false, null);
select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000fa', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20}]'::jsonb, false) $$, 'round 1');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000fa', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10}]'::jsonb, false) $$, 'round 2');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values (:D, :ZERO, 3, 5, 'player', true, 'ZZ');

-- before the delete: asking is refused on a live game
select tests.login(:PRIYA);
select throws_like($$ select public.request_restore('10000000-0000-4000-8000-0000000000fa') $$, '%not deleted%', 'X20-2 no ask on a live game');

-- ---------- harish deletes it ----------
select tests.login(:HARISH);
select is((public.delete_game(:D))->>'deleted', 'true', 'harish (admin) deletes game D');

-- X20-1: who can read it now
select tests.login(:PRIYA);
select ok(public.can_read_game(:D), 'X20-1 priya (scored) can read the deleted game');
select is((public.get_game_bundle(:D))->>'deleted', 'true', 'X20-1 the bundle says deleted');
select is(jsonb_array_length((public.get_game_bundle(:D))->'scores'), 6, 'X20-1 … and still carries every live score (read-only in the app)');
select is((public.get_game_bundle(:D))->'deletion'->>'deleted_by_name', 'Harish Test', 'X20-1 the banner knows who deleted it');
select is((public.get_game_bundle(:D))->'deletion'->>'can_restore', 'false', 'X20-1 a player cannot restore');
select is(((public.get_game_bundle(:D))->'deletion'->>'purge_at')::timestamptz, ((public.get_game_bundle(:D))->'deletion'->>'deleted_at')::timestamptz + interval '30 days', 'X20-1 gone for good 30 days after the delete');
select is(jsonb_array_length((public.get_home_bundle(50))->'deleted_games'), 1, 'X20-1 Home lists it under Deleted games');
select is((public.get_home_bundle(50))->'deleted_games'->0->>'id', '10000000-0000-4000-8000-0000000000fa', 'X20-1 … the right game');
select is((select count(*)::int from jsonb_array_elements((public.get_home_bundle(50))->'games') g where g->>'id' = '10000000-0000-4000-8000-0000000000fa'), 0, 'Q20.6 not among the live games');
select is((select count(*)::int from jsonb_array_elements(coalesce(public.list_result_candidates(100), '[]'::jsonb)) c where c->'game'->>'id' = '10000000-0000-4000-8000-0000000000fa'), 0, 'Q20.6 not in the Results picker');
select ok((select count(*) > 0 from public.event_log where game_id = :D and kind = 'deleted'), 'Q20.3 priya reads the Log of the deleted game');

select tests.login(:ZERO);
select ok(not public.can_read_game(:D), 'X20-1 zero (seated, never scored) cannot read it');
select is(public.get_game_bundle(:D), null, 'X20-1 … and gets no bundle');
select is(jsonb_array_length((public.get_home_bundle(50))->'deleted_games'), 0, 'X20-1 … and no Deleted games row');

select tests.login(:VIEWER);
select ok(not public.can_read_game(:D), 'X20-1 a viewer cannot read it');
select tests.login(:OUTSIDER);
select ok(not public.can_read_game(:D), 'X20-1 an outsider cannot read it');
select throws_like($$ select public.request_restore('10000000-0000-4000-8000-0000000000fa') $$, '%not available%', 'X20-2 an outsider cannot ask');

select tests.anon();
select is((public.public_scorecard(repeat('d', 48)))->>'deleted', 'true', 'X20-1 the public /s/ page still says deleted');

select tests.login(:SREE);
select ok(public.can_read_game(:D), 'X20-1 the creator reads it');
select is((public.get_game_bundle(:D))->'deletion'->>'can_restore', 'true', 'X20-1 … and may restore');
select is((public.get_home_bundle(50))->'deleted_games'->0->>'can_restore', 'true', 'X20-1 Home says so too');
select throws_like($$ select public.request_restore('10000000-0000-4000-8000-0000000000fa') $$, '%restore this game yourself%', 'X20-2 an admin does not ask, they restore');

-- ---------- X20-2: priya asks ----------
select tests.login(:PRIYA);
select is((public.request_restore(:D))->>'already', 'false', 'X20-2 priya asks');
select is((public.request_restore(:D))->>'already', 'true', 'X20-2 asking again changes nothing');
select is((select count(*)::int from public.restore_requests where game_id = :D), 1, 'X20-2 one ask per person per game');
select is((select count(*)::int from public.event_log where game_id = :D and kind = 'restore_requested'), 1, 'X20-2 one Log row');
select is((select summary from public.event_log where game_id = :D and kind = 'restore_requested'), 'Asked an admin to restore the game', 'X20-2 the Log line');
select ok(((public.get_game_bundle(:D))->'deletion'->>'my_request_at') is not null, 'X20-2 the bundle says "Asked · date"');
select is(jsonb_array_length((public.get_game_bundle(:D))->'deletion'->'requests'), 1, 'X20-2 the banner lists who asked');
select tests.logout();
select is((select count(*)::int from public.creator_notices where player_id = :PRIYA and text like 'Priya Test asked to restore game %'), 2, 'Q20.2 notices for the creator and the other admin');
select is((select count(*)::int from public.creator_notices where player_id = :PRIYA and owner_id = :PRIYA), 0, 'Q20.2 … never the asker');
select is((select count(*)::int from public.email_outbox where kind = 'restore_requested' and payload->>'requesterName' = 'Priya Test'), 2, 'Q20.2 one email each for sree and harish');
select is((select to_email from public.email_outbox where kind = 'restore_requested' and to_profile_id = :HARISH), 'harish@test.local', 'Q20.2 harish gets his at his address');

-- harish sees the ask and restores; the asks are cleared
select tests.login(:HARISH);
select is(jsonb_array_length((public.get_home_bundle(50))->'deleted_games'), 1, 'the admin sees the deleted game on Home');
select is((public.get_home_bundle(50))->'deleted_games'->0->'requests'->0->>'name', 'Priya Test', 'the admin sees who asked');
select is((public.restore_game(:D))->>'restored', 'true', 'harish restores');
select is((select count(*)::int from public.restore_requests where game_id = :D), 0, 'restoring clears the asks');
select is(public.get_game_bundle(:D)->>'deleted', null, 'the bundle is a live one again');

-- ---------- X20-3: the 30-day step (046: hide for good, delete nothing) ----------
select tests.logout();
-- OLD: deleted 31 days ago, nobody holds it → hidden for good
insert into public.games (id, created_by, status, game_type, settings, share_code, deleted_at, deleted_by)
values (:OLD, :SREE, 'completed', 'stake', '{"gameType":"stake"}', 'ROGUE2', now() - interval '31 days', :SREE);
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values (:OLD, :SREE, 0, 1, 'game_admin', true, 'SK'), (:OLD, :PRIYA, 1, 2, 'player', true, 'PT');
-- FRESH: deleted 29 days ago → stays
insert into public.games (id, created_by, status, game_type, settings, share_code, deleted_at, deleted_by)
values (:FRESH, :SREE, 'completed', 'stake', '{"gameType":"stake"}', 'ROGUE3', now() - interval '29 days', :SREE);
-- HELD: deleted 40 days ago but a live result still holds it (deleted while that result was itself deleted, then the result came back) → stays
insert into public.games (id, created_by, status, game_type, settings, share_code, deleted_at, deleted_by)
values (:HELD, :SREE, 'completed', 'stake', '{"gameType":"stake"}', 'ROGUE4', now() - interval '40 days', :SREE);
insert into public.game_results (id, declared_by, declared_at, places) values ('20000000-0000-4000-8000-0000000000fd', :SREE, now() - interval '41 days', '{"games":[],"players":[],"standings":[]}');
insert into public.game_result_games (result_id, game_id) values ('20000000-0000-4000-8000-0000000000fd', :HELD);

select is((select count(*)::int from public.event_log where game_id = :OLD), 4, 'the old game has its Log lines (created, two seats, deleted)');
select is(public.purge_deleted_games(), 1, 'X20-3 the nightly step touches exactly one game (046: purge_deleted_games = archive_deleted_games)');
select is((select count(*)::int from public.games where id in (:OLD, :FRESH, :HELD)), 3, 'X20-3 (046) nothing is deleted: all three games are still in the database');
select ok((select archived_at is not null from public.games where id = :OLD), 'X20-3 (046) the 31-day-old game is hidden for good');
select is((select count(*)::int from public.event_log where game_id = :OLD and kind <> 'game_archived'), 4, 'X20-3 (046) its Log rows keep their game_id');
select is((select count(*)::int from public.event_log where game_id = :OLD and kind = 'game_archived'), 1, 'X20-3 (046) one game_archived line');
select ok((select summary like 'Game % was hidden for good 30 days after it was deleted' and actor_name = 'System' from public.event_log where game_id = :OLD and kind = 'game_archived'), 'X20-3 … says so');
select is(public.purge_deleted_games(), 0, 'X20-3 running it again touches nothing');

-- the Log is still immutable (even for the owner)
select throws_like($$ update public.event_log set game_id = null where game_id = '10000000-0000-4000-8000-0000000000fa' $$, '%cannot be changed%', 'the Log refuses changes');

select * from finish();
rollback;
