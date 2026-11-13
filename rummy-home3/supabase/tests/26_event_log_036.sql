-- 036 game and result logs: one append-only event_log written on the server (triggers,
-- save_round, create_game, add_seated_player); snapshot names; every member reads a game's log,
-- an outsider nothing; result History rows (saved / deleted / restored / changed) and the
-- one-line "changed" note; direct inserts into rounds / scores are refused (D4).
-- Game A: sree creator (not seated), harish / priya / rk / zero seated, viewer spectator,
-- coadmin unseated admin; live rounds 1 and 2. Result R1 (harish) holds game B.
begin;
select plan(98);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set B '''10000000-0000-4000-8000-00000000000b'''
\set R1 '''20000000-0000-4000-8000-0000000000e1'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set VIEWER '''00000000-0000-4000-8000-000000000004'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set COADMIN '''00000000-0000-4000-8000-000000000006'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''

create temp table marks (name text primary key, id bigint);
grant all on marks to public;
create or replace function pg_temp.mark(p text) returns void language sql as $$
  insert into marks values (p, coalesce((select max(id) from public.event_log), 0)) on conflict (name) do update set id = excluded.id; $$;
create or replace function pg_temp.since(p text) returns setof public.event_log language sql as $$
  select e.* from public.event_log e where e.id > (select id from marks where name = p) order by e.id; $$;

-- ---------- shape ----------
select has_table('public', 'event_log', 'event_log exists');
select has_index('public', 'event_log', 'event_log_game_idx', 'game index');
select has_trigger('public', 'event_log', 'event_log_immutable', 'append-only trigger');
select has_trigger('public', 'games', 'event_log_games', 'event_log_games trigger');
select has_trigger('public', 'game_players', 'event_log_game_players', 'event_log_game_players trigger');
select has_trigger('public', 'rounds', 'event_log_rounds', 'event_log_rounds trigger');
select has_trigger('public', 'profiles', 'event_log_profiles', 'event_log_profiles trigger');
select has_trigger('public', 'game_results', 'event_log_game_results', 'event_log_game_results trigger');
select has_trigger('public', 'game_result_games', 'event_log_result_games', 'event_log_result_games trigger');
select has_trigger('public', 'event_log', 'event_log_mirror', 'event_log_mirror trigger');
select has_function('public', 'create_game', array['text', 'jsonb', 'uuid[]', 'jsonb', 'text', 'uuid']);
select has_function('public', 'add_seated_player', array['uuid', 'uuid', 'text']);
select has_function('public', 'list_game_log', array['uuid', 'text', 'bigint', 'integer']);
select has_function('public', 'list_result_history', array['uuid']);
select ok(not has_function_privilege('authenticated', 'public.log_event(uuid, uuid, text, public.event_level, text, jsonb)', 'execute'), 'the app cannot write log rows (log_event is server-only)');
select ok(not has_table_privilege('authenticated', 'public.event_log', 'insert'), 'no direct insert into event_log');
select ok(not has_table_privilege('authenticated', 'public.rounds', 'insert'), 'D4: no direct insert into rounds');
select ok(not has_table_privilege('authenticated', 'public.scores', 'insert'), 'D4: no direct insert into scores');
select ok(has_table_privilege('authenticated', 'public.rounds', 'update'), 'UPDATE on rounds stays (the shipped APK undoes with two direct writes)');
select is_definer('public', 'save_round', array['uuid', 'integer', 'jsonb', 'boolean'], 'save_round is security definer now (it owns the only insert path)');
select ok(has_function_privilege('anon', 'public.public_result_note(uuid)', 'execute'), 'anon reads the result note (/r/ page)');
select ok(has_function_privilege('anon', 'public.public_scorecard_changes(text)', 'execute'), 'anon reads the live scorecard changes');
select ok(not has_function_privilege('anon', 'public.list_game_log(uuid, text, bigint, integer)', 'execute'), 'anon cannot list a game log');

-- ---------- 13.1 create_game: one row with every name ----------
select tests.login(:SREE);
select pg_temp.mark('create');
select lives_ok($$ select public.create_game('stake', '{"gameType":"stake","stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}'::jsonb,
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008']::uuid[],
  '{"00000000-0000-4000-8000-000000000002":"HT"}'::jsonb, 'LOGNEW', '10000000-0000-4000-8000-0000000000cc') $$, '13.1 create_game with 3 players');
select is((select count(*)::int from pg_temp.since('create')), 1, '13.1 exactly one log row for the creation (no per-seat rows)');
select is((select kind from pg_temp.since('create')), 'game_created', '13.1 kind game_created');
select is((select jsonb_array_length(details->'players') from pg_temp.since('create')), 3, '13.1 details.players has the three names');
select is((select details->'players'->0->>'ini' from pg_temp.since('create')), 'HT', '13.1 initials snapshot from the label');
select is((select details->'admins' from pg_temp.since('create')), '["Sree Test"]'::jsonb, '13.1 the non-playing creator is the admin');
select is((select actor_name from pg_temp.since('create')), 'Sree Test', '13.1 actor is the creator');
select matches((select summary from pg_temp.since('create')), '^Created game S[0-9]+ · Players: Harish Test, Priya Test, Zed Zero · Admins: Sree Test · Game ID LOGNEW$', '13.1 summary');
select is((select count(*)::int from public.game_players where game_id = '10000000-0000-4000-8000-0000000000cc'), 4, '13.1 three seats plus the unseated creator');

-- ---------- 13.5 / 13.6 round added, round edited (game A) ----------
select pg_temp.mark('r3');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"count","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"rummy","value":30}]'::jsonb, false) $$, '13.5 round 3 saved');
select is((select count(*)::int from pg_temp.since('r3')), 1, '13.5 one row');
select is((select kind || '/' || level::text from pg_temp.since('r3')), 'round_added/routine', '13.5 round_added is routine');
select is((select summary from pg_temp.since('r3')), 'Round 3 added · Dealer RK · Zed Zero +30', '13.5 summary names the dealer and the winner');
select is((select jsonb_array_length(details->'scores') from pg_temp.since('r3')), 4, '13.5 details.scores has the payload');

select pg_temp.mark('edit');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-40},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"count","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"rummy","value":60}]'::jsonb, true) $$, '13.6 round 3 edited (two players changed)');
select is((select count(*)::int from pg_temp.since('edit')), 1, '13.6 one row');
select is((select kind || '/' || level::text from pg_temp.since('edit')), 'round_edited/important', '13.6 round_edited is important');
select is((select jsonb_array_length(details->'changes') from pg_temp.since('edit')), 2, '13.6 exactly the two changed players');
select is((select (details->>'unchanged')::int from pg_temp.since('edit')), 2, '13.6 unchanged count');
select is((select summary from pg_temp.since('edit')), 'Round 3 edited · Harish Test -10→-40, Zed Zero +30→+60 · 2 others unchanged', '13.6 summary');

-- ---------- 13.7 undo ----------
select pg_temp.mark('undo');
select is((public.undo_last_round(:A))->>'roundNumber', '3', '13.7 undo round 3');
select is((select string_agg(kind, ',') from pg_temp.since('undo')), 'round_undone', '13.7 one round_undone row, no round_edited');
select is((select summary from pg_temp.since('undo')), 'Round 3 undone · Removed scores: Zed Zero +60, R K 0, Priya Test -20, Harish Test -40', '13.7 summary lists the removed scores');

-- ---------- 13.2 add a player mid-game (RPC) ----------
select pg_temp.mark('add');
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000005', 'OU') $$, '13.2 add outsider as a player');
select is((select kind || '/' || level::text from pg_temp.since('add')), 'player_added/important', '13.2 player_added important');
select is((select summary from pg_temp.since('add')), 'Added Otto Outsider (#5 · OU) as a player · Joined at round 3 · rounds 1–2 set to 0', '13.2 summary');
select is((select (details->>'joinRound')::int from pg_temp.since('add')), 3, '13.2 details.joinRound');
select is((select count(*)::int from public.scores s join public.rounds r on r.id = s.round_id where s.game_id = :A and s.profile_id = :OUTSIDER and r.undone_at is null), 2, '13.2 two explicit zeros were written');
select throws_ok($$ select public.add_seated_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000005', null) $$, 'They are already in this game.', '13.2 no double seat');

-- ---------- 13.9 initials, 13.4 admin, 13.3 removed ----------
select pg_temp.mark('ini');
select is(public.set_seat_label(:A, :OUTSIDER, 'OX'), 'OX', '13.9 initials changed');
select is((select kind || '/' || level::text || ' ' || summary from pg_temp.since('ini')), 'initials_changed/routine Changed initials for Otto Outsider OU→OX', '13.9 routine row');
select pg_temp.mark('adm');
update public.game_players set role = 'game_admin' where game_id = :A and profile_id = :PRIYA;
update public.game_players set role = 'player' where game_id = :A and profile_id = :PRIYA;
select is((select string_agg(kind, ',' order by id) from pg_temp.since('adm')), 'admin_added,admin_removed', '13.4 admin added then removed');
select pg_temp.mark('rm');
select lives_ok($$ select * from public.remove_seat_if_no_scores('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000005') $$, '13.3 remove the zero-score player');
select is((select kind || ' ' || summary from pg_temp.since('rm')), 'player_removed Removed Otto Outsider (#5 · OX) from the game · Had no scores yet', '13.3 player_removed keeps the name and initials snapshot');

-- ---------- 13.8 settings (important: the game has rounds) ----------
select pg_temp.mark('set');
update public.games set settings = settings || '{"stakeMiddleDrop": -50}'::jsonb where id = :A;
select is((select kind || '/' || level::text || ' ' || summary from pg_temp.since('set')), 'settings_changed/important Changed game settings · Middle drop -30→-50', '13.8 one change entry');
select is((select jsonb_array_length(details->'changes') from pg_temp.since('set')), 1, '13.8 unchanged keys absent');

-- ---------- 13.10 rename: active game only ----------
select tests.logout();
select pg_temp.mark('ren');
update public.profiles set display_name = 'Priya Tella' where id = :PRIYA;
select is((select count(*)::int from pg_temp.since('ren')), 2, '13.10 one row per ACTIVE game priya is in (A and the new game), none for completed B');
select ok((select bool_and(game_id in (:A, '10000000-0000-4000-8000-0000000000cc')) from pg_temp.since('ren')), '13.10 rows belong to the active games');
select is((select actor_name from pg_temp.since('ren') limit 1), 'System', '13.10 no signed-in actor → System');
select ok((select details->'players'->1->>'name' = 'Priya Test' from pg_temp.since('create') where kind = 'game_created'), '13.10 the creation row still says Priya Test (names are snapshots)');
update public.profiles set display_name = 'Priya Test' where id = :PRIYA;

-- ---------- 13.11 completed / reopened ----------
select tests.login(:SREE);
select pg_temp.mark('done');
update public.games set status = 'completed', completed_at = now() where id = :A;
select is((select kind || ' ' || summary from pg_temp.since('done')), 'completed Completed the game after round 2 · Harish Test +30 leads', '13.11 completed names the leader');
update public.games set status = 'active', completed_at = null where id = :A;
select is((select string_agg(kind, ',' order by id) from pg_temp.since('done')), 'completed,reopened', '13.11 then reopened');
update public.games set status = 'completed', completed_at = now() where id = :A;

-- ---------- 13.12–13.15 result history ----------
select pg_temp.mark('decl');
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000a'::uuid]) $$, '13.12 declare a result for A');
select is((select string_agg(kind, ',' order by id) from pg_temp.since('decl')), 'closed,result_saved', '13.12 closed (game) + result_saved (result), same transaction');
select is((select count(distinct txid)::int from pg_temp.since('decl')), 1, '13.12 same txid');
select matches((select summary from pg_temp.since('decl') where kind = 'result_saved'), '^Result saved with S[0-9]+ · 1 game moved to Closed · 4 players$', '13.12 result_saved summary');
select is((select result_id from pg_temp.since('decl') where kind = 'closed'), (select result_id from pg_temp.since('decl') where kind = 'result_saved'), '13.12 the closed row points at the result');

create temp table rid as select result_id as id from pg_temp.since('decl') where kind = 'result_saved';
grant all on rid to public;
select pg_temp.mark('del');
select lives_ok($$ select public.delete_result((select id from rid)) $$, '13.13 delete the result');
select is((select string_agg(kind, ',' order by id) from pg_temp.since('del')), 'result_deleted,unclosed', '13.13 result_deleted + unclosed');
update public.games set status = 'active', completed_at = null where id = :A;
select is((public.undo_last_round(:A))->>'roundNumber', '2', '13.14 undo round 2 while the result is deleted');
update public.games set status = 'completed', completed_at = now() where id = :A;
select lives_ok($$ select public.restore_result((select id from rid)) $$, '13.14 restore the result');
select is((select string_agg(kind, ',' order by id) from pg_temp.since('del') where result_id is not null),
  'result_deleted,unclosed,result_changed,result_changed,result_restored,closed', '13.14 History: deleted → changed (reopened) → changed (round undone) → restored');
select is((select summary from pg_temp.since('del') where kind = 'result_changed' order by id desc limit 1), 'Game S1 round 2 undone while this result was deleted', '13.14 the change says what and when');
select is(((public.list_result_history((select id from rid)))->'changedNote'->>'summary'), 'Game S1 round 2 undone while this result was deleted', '13.14 changedNote is the latest change');
select is(((public.list_result_history((select id from rid)))->'rows'->0->>'kind'), 'result_restored', '13.14 list_result_history newest first, result rows only');
select is(jsonb_array_length((public.list_result_history((select id from rid)))->'rows'), 5, '13.14 five History rows (saved, deleted, changed ×2, restored)');

select pg_temp.mark('dg');
select lives_ok($$ select public.delete_game('10000000-0000-4000-8000-00000000000a') $$, '13.15 delete game A while it sits in the result');
select tests.logout();
select is((select string_agg(kind, ',' order by id) from pg_temp.since('dg')), 'result_changed,deleted,unclosed', '13.15 result_changed (removed from result) + deleted + unclosed');
select tests.login(:SREE);
select is((select string_agg(kind, ',' order by id) from pg_temp.since('dg')), 'result_changed,unclosed', '13.15 the deleted game''s own row is hidden from members with it (can_read_game); the rows that also point at the result stay');
select is((select summary from pg_temp.since('dg') where kind = 'result_changed'), 'Game S1 deleted — no longer counted in this result · Totals changed', '13.15 summary');
select is((public.public_result_note((select id from rid)))->>'summary', 'Game S1 deleted — no longer counted in this result · Totals changed', '13.15 the public note follows');

-- ---------- 13.16 immutable ----------
select throws_ok($$ update public.event_log set summary = 'x' where id = (select max(id) from public.event_log) $$, '42501', null, '13.16 authenticated cannot update (no grant)');
select throws_ok($$ delete from public.event_log where id = (select max(id) from public.event_log) $$, '42501', null, '13.16 authenticated cannot delete (no grant)');
select tests.logout();
select throws_ok($$ update public.event_log set summary = 'x' where id = (select max(id) from public.event_log) $$, '42501', 'The log cannot be changed.', '13.16 nor can the owner');
select throws_ok($$ delete from public.event_log where id = (select max(id) from public.event_log) $$, '42501', 'The log cannot be changed.', '13.16 nor delete');

-- ---------- 13.17 who reads ----------
select tests.login(:VIEWER);
select ok((select count(*) from public.event_log where game_id = '10000000-0000-4000-8000-0000000000cc') = 0, '13.17 the viewer is not in the new game: no rows');
select tests.login(:HARISH);
select ok(jsonb_array_length((public.list_game_log('10000000-0000-4000-8000-0000000000cc', 'all', null, 50))->'rows') = 3, '13.17 a seated player reads the new game''s log (created + 2 renames)');
select ok(jsonb_array_length((public.list_game_log('10000000-0000-4000-8000-0000000000cc', 'important', null, 50))->'rows') = 1, '13.18 the important filter keeps the creation only');
select ok(((public.list_game_log('10000000-0000-4000-8000-0000000000cc', 'all', null, 2))->>'hasMore')::boolean, '13.18 a page of 2 out of 3 says hasMore');
select tests.login(:OUTSIDER);
select throws_ok($$ select public.list_game_log('10000000-0000-4000-8000-0000000000cc', 'all', null, 50) $$, '42501', 'This game is not available.', '13.17 an outsider is refused');
select tests.anon();
select throws_like($$ select public.list_game_log('10000000-0000-4000-8000-0000000000cc', 'all', null, 50) $$, '%permission denied%', '13.17 anon is refused');

-- ---------- 13.20 direct inserts refused ----------
select tests.login(:SREE);
select throws_like($$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-0000000000cc', 1, auth.uid()) $$, '%permission denied%', '13.20 direct insert into rounds refused');
select throws_like($$ insert into public.scores (round_id, game_id, profile_id, score_type, value) select id, game_id, '00000000-0000-4000-8000-000000000002', 'count', 0 from public.rounds limit 1 $$, '%permission denied%', '13.20 direct insert into scores refused');

-- ---------- 13.21 hide is not logged ----------
select tests.login(:HARISH);
select pg_temp.mark('hide');
select lives_ok($$ select public.hide_game('10000000-0000-4000-8000-00000000000b') $$, '13.21 hide game B');
select is((select count(*)::int from pg_temp.since('hide')), 0, '13.21 no log row for hide');

select * from finish();
rollback;
