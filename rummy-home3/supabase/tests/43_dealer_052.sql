-- 052 (D60 Dealer sheet, D57 join at dealer + 1, D58 the deal skips a seat that is out):
-- set_round_dealer for the round being played, a played round and the last round, follow vs this round
-- only; save_round applies the override once; current_dealer; dealer_rotation skips a pool player who is
-- out; add_seated_player seats a newcomer to the dealer's left once rounds exist (054, D70; 052 had D57's
-- dealer + 1, see 44_join_left_of_dealer_054.sql).
-- Game V (Points): sree AX seat 1, harish BX seat 2, priya CX seat 3, zero DX seat 4.
begin;
select plan(58);

\set A '''00000000-0000-4000-8000-000000000001'''
\set B '''00000000-0000-4000-8000-000000000002'''
\set C '''00000000-0000-4000-8000-000000000003'''
\set D '''00000000-0000-4000-8000-000000000008'''
\set N '''00000000-0000-4000-8000-000000000005'''
\set V '''10000000-0000-4000-8000-0000000000d1'''
\set W '''10000000-0000-4000-8000-0000000000d2'''
\set X '''10000000-0000-4000-8000-0000000000d3'''

-- ---------- shape ----------
select has_column('public', 'games', 'next_dealer_profile_id', '052 override column');
select has_column('public', 'games', 'next_dealer_round', '052 override round');
select has_column('public', 'games', 'next_dealer_keeps_sequence', '052 this-round-only flag');
select has_function('public', 'set_round_dealer', array['uuid', 'integer', 'uuid', 'boolean']);
select has_function('public', 'current_dealer', array['uuid']);
select has_function('public', 'dealer_rotation', array['uuid', 'integer']);
select ok((select pg_get_constraintdef(oid) like '%dealer_changed%' from pg_constraint where conname = 'event_log_kind'), 'the Log accepts dealer_changed');
select ok(not has_function_privilege('authenticated', 'public.dealer_rotation(uuid, integer)', 'execute'), 'dealer_rotation is internal');

-- ---------- game V: five rounds, dealers A B C D A ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:V, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'DEAL52');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:V, :A, 0, 1, 'game_admin', true, 'AX'),
  (:V, :B, 1, 2, 'player', true, 'BX'),
  (:V, :C, 2, 3, 'player', true, 'CX'),
  (:V, :D, 3, 4, 'player', true, 'DX');

create function pg_temp.tests_round(p_game uuid, p_round integer) returns uuid language sql as $$
  select public.save_round(p_game, p_round,
    '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":30},
      {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
      {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10},
      {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":-10}]'::jsonb, false);
$$;
create function pg_temp.tests_dealers(p_game uuid) returns text language sql as $$
  select string_agg(coalesce(gp.label, '?'), ' ' order by r.round_number)
    from public.rounds r left join public.game_players gp on gp.game_id = r.game_id and gp.profile_id = r.dealer_profile_id
   where r.game_id = p_game and r.undone_at is null and r.round_number < 1000;
$$;
create function pg_temp.tests_ini(p_game uuid, p_id uuid) returns text language sql as $$
  select gp.label from public.game_players gp where gp.game_id = p_game and gp.profile_id = p_id;
$$;

select tests.login(:A);
select pg_temp.tests_round(:V, 1); select pg_temp.tests_round(:V, 2); select pg_temp.tests_round(:V, 3); select pg_temp.tests_round(:V, 4); select pg_temp.tests_round(:V, 5);
select is(pg_temp.tests_dealers(:V), 'AX BX CX DX AX', 'five rounds: the deal goes round by seat');
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'BX', 'round 6: B deals');

-- ---------- guards ----------
select tests.login(:B);
select throws_ok(
  $$ select public.set_round_dealer('10000000-0000-4000-8000-0000000000d1', 6, '00000000-0000-4000-8000-000000000003', true) $$,
  '42501', 'Only a game admin can change the dealer.', 'a player cannot change the dealer');
select tests.login(:A);
select throws_like(
  $$ select public.set_round_dealer('10000000-0000-4000-8000-0000000000d1', 7, '00000000-0000-4000-8000-000000000003', true) $$,
  'Round 7 has not been played.', 'a round after the next one cannot be set');
select throws_like(
  $$ select public.set_round_dealer('10000000-0000-4000-8000-0000000000d1', 6, '00000000-0000-4000-8000-000000000005', true) $$,
  '%not at the table%', 'a stranger cannot deal');

-- ---------- the round being played (6): C deals, follow ----------
select is((select (r->>'changed')::boolean from public.set_round_dealer(:V, 6, :C, true) r), true, 'round 6: C really deals');
select is((select next_dealer_profile_id from public.games where id = :V), :C::uuid, 'remembered on the game');
select is((select next_dealer_round from public.games where id = :V), 6, 'for round 6');
select is((select next_dealer_keeps_sequence from public.games where id = :V), false, 'follow');
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'CX', 'current_dealer reads the override');
select is((select summary from public.event_log where game_id = :V and kind = 'dealer_changed' order by id desc limit 1),
  'Dealer changed · Round 6 · BX → CX · followed · Round 7: DX deals', 'the Log line names from, to, follow and the round after');
select is((select level::text from public.event_log where game_id = :V and kind = 'dealer_changed' order by id desc limit 1), 'important', 'dealer lines are important');
select pg_temp.tests_round(:V, 6);
select is(pg_temp.tests_dealers(:V), 'AX BX CX DX AX CX', 'round 6 saved with C dealing');
select is((select next_dealer_profile_id from public.games where id = :V), null, 'the override is used up');
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'DX', 'round 7 follows from C: D deals');

-- ---------- the round being played (7): A deals this round only ----------
select is((select r->>'nextDealer' from public.set_round_dealer(:V, 7, :A, false) r), :A, 'this round only: round 8 goes on as if D had dealt 7, so A deals 8 too');
select is((select next_dealer_keeps_sequence from public.games where id = :V), true, 'flagged this round only');
select is((select summary from public.event_log where game_id = :V and kind = 'dealer_changed' order by id desc limit 1),
  'Dealer changed · Round 7 · DX → AX · this round only · Round 8: AX deals', 'the Log line says this round only');
select pg_temp.tests_round(:V, 7);
select is(pg_temp.tests_dealers(:V), 'AX BX CX DX AX CX AX', 'round 7 saved with A dealing');
select is((select next_dealer_profile_id from public.games where id = :V), :A::uuid, 'the sequence is carried one round: A deals 8');
select is((select next_dealer_round from public.games where id = :V), 8, 'for round 8');
select pg_temp.tests_round(:V, 8);
select is(pg_temp.tests_dealers(:V), 'AX BX CX DX AX CX AX AX', 'round 8: A, in turn');
select is((select next_dealer_profile_id from public.games where id = :V), null, 'and the chain ends');
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'BX', 'round 9: B');

-- ---------- a played round (2): C dealt, follow re-deals 3..8 ----------
select is((select r->>'nextDealer' from public.set_round_dealer(:V, 2, :C, true) r), :B, 'follow from round 2: round 9 is still B');
select is(pg_temp.tests_dealers(:V), 'AX CX DX AX BX CX DX AX', 'rounds 2..8 re-dealt from C');
select is((select summary from public.event_log where game_id = :V and kind = 'dealer_changed' order by id desc limit 1),
  'Dealer changed · Round 2 · BX → CX · followed · Round 9: BX deals', 'the Log line for a played round');

-- ---------- a played round (3): B dealt, this round only ----------
select is((select (r->>'changed')::boolean from public.set_round_dealer(:V, 3, :B, false) r), true, 'round 3 alone');
select is(pg_temp.tests_dealers(:V), 'AX CX BX AX BX CX DX AX', 'only round 3 changed');
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'BX', 'round 9 unchanged');
select is((select (r->>'changed')::boolean from public.set_round_dealer(:V, 3, :B, false) r), false, 'the same dealer again changes nothing');
select is((select count(*)::int from public.event_log where game_id = :V and kind = 'dealer_changed'), 4, 'and logs nothing');

-- ---------- the last round (8): C dealt, this round only → round 9 goes on from A ----------
select is((select r->>'nextDealer' from public.set_round_dealer(:V, 8, :C, false) r), :B, 'round 9 stays B (the seat after the dealer the card had)');
select is(pg_temp.tests_dealers(:V), 'AX CX BX AX BX CX DX CX', 'round 8 is C');
select is((select next_dealer_profile_id from public.games where id = :V), :B::uuid, 'remembered for round 9');
select pg_temp.tests_round(:V, 9);
select is(pg_temp.tests_dealers(:V), 'AX CX BX AX BX CX DX CX BX', 'round 9: B');
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'CX', 'round 10: C');

-- ---------- D70 (054): a newcomer sits to the left of whoever is dealing ----------
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000005', 'NX') $$, 'N joins before round 10');
select is((select string_agg(label, ' ' order by player_order) from public.game_players where game_id = :V and player_order < 900), 'AX BX NX CX DX', 'N sits to the dealer''s left (the seat before C); C and D move up one');
select is((select display_number from public.game_players where game_id = :V and profile_id = :N), 5, 'the player number is the next free one, not the seat');
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'CX', 'C still deals round 10');
select is((select count(*)::int from public.scores where game_id = :V and profile_id = :N), 9, 'a 0 for every round played');
select pg_temp.tests_round(:V, 10);
select is(pg_temp.tests_ini(:V, public.current_dealer(:V)), 'DX', 'D deals round 11, as before N joined');

-- ---------- D58: a pool player who is out is skipped ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:W, :A, 'active', 'pool', '{"gameType":"pool","poolLimit":101,"dropAmount":25,"mdAmount":50,"maxCount":80}', 'DEAL53');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:W, :A, 0, 1, 'game_admin', true, 'AX'),
  (:W, :B, 1, 2, 'player', true, 'BX'),
  (:W, :C, 2, 3, 'player', true, 'CX');
select public.save_round(:W, 1, '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":60},{"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30}]'::jsonb, false);
select public.save_round(:W, 2, '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":50},{"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30}]'::jsonb, false);
select is((select out_round from public.game_players where game_id = :W and profile_id = :B), 2, 'B is out in round 2');
select tests.logout();
select is(public.dealer_rotation(:W, 2), array[:A, :B, :C]::uuid[], 'B was at the table for round 2');
select is(public.dealer_rotation(:W, 3), array[:A, :C]::uuid[], 'and is skipped from round 3');
select tests.login(:A);
select is(pg_temp.tests_ini(:W, public.current_dealer(:W)), 'CX', 'round 3: the seat after B that is still in');
select throws_like(
  $$ select public.set_round_dealer('10000000-0000-4000-8000-0000000000d2', 3, '00000000-0000-4000-8000-000000000002', true) $$,
  '%not at the table for round 3%', 'an out player cannot be named dealer');

-- ---------- before the first round a newcomer takes the last seat ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:X, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'DEAL54');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:X, :A, 0, 1, 'game_admin', true, 'AX'),
  (:X, :B, 1, 2, 'player', true, 'BX');
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-000000000005', 'NX') $$, 'N joins before round 1');
select is((select string_agg(label, ' ' order by player_order) from public.game_players where game_id = :X and player_order < 900), 'AX BX NX', 'last seat, as before');

select tests.logout();
select * from finish();
rollback;
