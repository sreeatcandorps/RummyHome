-- 044 (PR 21 Seating order): set_seating_order — admin only, Active only, every seated player once,
-- compacts to 0..N-1 in one transaction, the seating_changed Log line (routine at 0 rounds, important
-- after) with from / to / rounds / nextDealer; the seatingPrompted settings key never logs; Pool keeps
-- out / re-entry state and the deal skips the out player in the new order; 20 seats reversed in one call.
-- Game T: sree (admin, seated), harish, priya, zero; 004 is a viewer; 005 is a non-playing admin.
begin;
select plan(42);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set VIEWER '''00000000-0000-4000-8000-000000000004'''
\set ADMIN2 '''00000000-0000-4000-8000-000000000005'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set T '''10000000-0000-4000-8000-0000000000f5'''
\set Q '''10000000-0000-4000-8000-0000000000f6'''
\set W '''10000000-0000-4000-8000-0000000000f7'''

select has_function('public', 'set_seating_order', array['uuid', 'uuid[]']);
select ok((select pg_get_constraintdef(oid) like '%seating_changed%' from pg_constraint where conname = 'event_log_kind'), 'the Log accepts seating_changed');

-- ---------- game T (Points) ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:T, :SREE, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80,"seatingPrompted":false}', 'SEAT01');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:T, :SREE, 0, 1, 'game_admin', true, 'SK'),
  (:T, :HARISH, 1, 2, 'player', true, 'HG'),
  (:T, :PRIYA, 2, 3, 'player', true, 'PT'),
  (:T, :ZERO, 3, 4, 'player', true, 'ZZ'),
  (:T, :VIEWER, 900, 5, 'spectator', false, null),
  (:T, :ADMIN2, 901, 6, 'game_admin', false, null);

-- the pop-up flag is bookkeeping: writing it logs nothing
select tests.login(:SREE);
select lives_ok($$ update public.games set settings = settings || '{"seatingPrompted":true}' where id = '10000000-0000-4000-8000-0000000000f5' $$, 'the app marks the pop-up seen');
select is((select count(*)::int from public.event_log where game_id = :T and kind = 'settings_changed'), 0, 'seatingPrompted makes no settings Log line');
select lives_ok($$ update public.games set settings = settings || '{"maxCount":-100}' where id = '10000000-0000-4000-8000-0000000000f5' $$, 'a real setting still changes');
select is((select summary from public.event_log where game_id = :T and kind = 'settings_changed' order by id desc limit 1),
  'Changed game settings · Full count -80→-100', 'and still logs as before');

-- who may call it
select tests.login(:HARISH);
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008']::uuid[]) $$,
  '42501', 'Only a game admin can change the seating.', 'a player is refused');
select tests.login(:VIEWER);
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008']::uuid[]) $$,
  '42501', 'Only a game admin can change the seating.', 'a viewer is refused');
select tests.logout();
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008']::uuid[]) $$,
  '42501', 'Sign in required.', 'anonymous is refused');

-- the list must be the seated players, each once
select tests.login(:SREE);
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003']::uuid[]) $$,
  'P0001', 'Every player needs a seat.', 'a missing player is refused');
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008']::uuid[]) $$,
  'P0001', 'Every player needs a seat.', 'a duplicated player is refused');
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004']::uuid[]) $$,
  'P0001', 'Every player needs a seat.', 'a viewer in the list is refused');
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000005']::uuid[]) $$,
  'P0001', 'Every player needs a seat.', 'a non-playing admin in the list is refused');
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5', null) $$,
  'P0001', 'Every player needs a seat.', 'null is refused');

-- the same order is a no-op: nothing written, nothing logged
select is((public.set_seating_order(:T, array[:SREE, :HARISH, :PRIYA, :ZERO]::uuid[]))->>'changed', 'false', 'the current order changes nothing');
select is((select count(*)::int from public.event_log where game_id = :T and kind = 'seating_changed'), 0, 'no Log line for a no-op');

-- the pop-up (0 rounds): Priya to seat 2 → routine Log line
select is((public.set_seating_order(:T, array[:SREE, :PRIYA, :HARISH, :ZERO]::uuid[]))->>'changed', 'true', 'reorder with no rounds');
select is((select array_agg(profile_id order by player_order) from public.game_players where game_id = :T and role <> 'spectator' and seated),
  array[:SREE, :PRIYA, :HARISH, :ZERO]::uuid[], 'the seats follow the list');
select is((select array_agg(player_order order by player_order) from public.game_players where game_id = :T and role <> 'spectator' and seated),
  array[0, 1, 2, 3], 'compacted to 0..N-1');
select is((select player_order from public.game_players where game_id = :T and profile_id = :VIEWER), 900, 'the viewer keeps its row above the seats');
select is((select player_order from public.game_players where game_id = :T and profile_id = :ADMIN2), 901, 'the non-playing admin too');
select is((select summary from public.event_log where game_id = :T and kind = 'seating_changed' order by id desc limit 1),
  'Seating changed · 1 SK · 2 PT · 3 HG · 4 ZZ', 'the Log line lists the seats by initials');
select is((select level::text from public.event_log where game_id = :T and kind = 'seating_changed' order by id desc limit 1), 'routine', 'routine with no rounds');
select is((select details->>'rounds' from public.event_log where game_id = :T and kind = 'seating_changed' order by id desc limit 1), '0', 'details carry the round count');
select is((select details->>'nextDealer' from public.event_log where game_id = :T and kind = 'seating_changed' order by id desc limit 1), '00000000-0000-4000-8000-000000000001', 'seat 1 deals round 1');
select is((select details->'from'->>1 from public.event_log where game_id = :T and kind = 'seating_changed' order by id desc limit 1), '00000000-0000-4000-8000-000000000002', 'details.from is the old order');

-- two rounds, then a mid-game change: important, and the next deal is the seat after the last dealer in the NEW order
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":-10}]'::jsonb, false) $$, 'round 1 (sree deals)');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":-10}]'::jsonb, false) $$, 'round 2 (priya deals)');
select is((select dealer_profile_id from public.rounds where game_id = :T and round_number = 2), :PRIYA::uuid, 'round 2 dealer is seat 2 = priya');
-- swap harish and zero: order S P Z H; the seat after priya is now zero
select is((public.set_seating_order(:T, array[:SREE, :PRIYA, :ZERO, :HARISH]::uuid[]))->>'nextDealer', '00000000-0000-4000-8000-000000000008', 'the next deal follows the new order');
select is((select level::text from public.event_log where game_id = :T and kind = 'seating_changed' order by id desc limit 1), 'important', 'important once rounds exist');
select is((select dealer_profile_id from public.rounds where game_id = :T and round_number = 1), :SREE::uuid, 'saved rounds keep their dealer');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"rummy","value":30}]'::jsonb, false) $$, 'round 3');
select is((select dealer_profile_id from public.rounds where game_id = :T and round_number = 3), :ZERO::uuid, 'save_round picks the same next dealer');

-- completed: refused
update public.games set status = 'completed', completed_at = now() where id = :T;
select throws_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f5',
  array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000008']::uuid[]) $$,
  'P0001', 'The game is completed. Reopen it to change the seating.', 'a completed game is refused');

-- ---------- game Q (Pool): an out player keeps out_round and may be moved; the deal skips them ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:Q, :SREE, 'active', 'pool', '{"gameType":"pool","poolLimit":60,"dropAmount":20,"mdAmount":40,"maxCount":80}', 'SEAT02');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:Q, :SREE, 0, 1, 'game_admin', true),
  (:Q, :HARISH, 1, 2, 'player', true),
  (:Q, :PRIYA, 2, 3, 'player', true),
  (:Q, :ZERO, 3, 4, 'player', true);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f6', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":70}]'::jsonb, false) $$, 'pool round 1: zero out');
-- move zero (out) to seat 2: S Z H P; sree dealt round 1, the seat after him still in is harish
select is((public.set_seating_order(:Q, array[:SREE, :ZERO, :HARISH, :PRIYA]::uuid[]))->>'nextDealer', '00000000-0000-4000-8000-000000000002', 'the deal skips the out player in the new order');
select is((select out_round from public.game_players where game_id = :Q and profile_id = :ZERO), 1, 'the out player keeps out_round after the move');
select is((select player_order from public.game_players where game_id = :Q and profile_id = :ZERO), 1, 'and sits in seat 2');

-- ---------- game W: 20 seats reversed in one call (the unique key is never violated) ----------
select tests.logout();
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:W, :SREE, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'SEAT03');
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
select ('00000000-0000-4000-8000-0000000000' || lpad(to_hex(176 + i), 2, '0'))::uuid, 'Seat ' || i, 'Seat', i::text, 'unregistered', :SREE, 'ST' || lpad(i::text, 4, '0')
  from generate_series(1, 19) i;
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated)
select :W, ('00000000-0000-4000-8000-0000000000' || lpad(to_hex(176 + i), 2, '0'))::uuid, i, i + 1, 'player', true
  from generate_series(1, 19) i;
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values (:W, :SREE, 0, 1, 'game_admin', true);
select tests.login(:SREE);
select lives_ok($$ select public.set_seating_order('10000000-0000-4000-8000-0000000000f7',
  (select array_agg(profile_id order by player_order desc) from public.game_players where game_id = '10000000-0000-4000-8000-0000000000f7')) $$,
  '20 seats reversed in one call');
select is((select array_agg(player_order order by player_order) from public.game_players where game_id = :W), (select array_agg(i) from generate_series(0, 19) i), '20 seats are 0..19');
select is((select player_order from public.game_players where game_id = :W and profile_id = :SREE), 19, 'the first seat is now the last');

select tests.logout();
select * from finish();
rollback;
