-- 054 (D70): a player who joins mid-game sits to the dealer's left, the seat that deals last. Since 057 (Q63,
-- the deal moves anticlockwise) that is the seat AFTER whoever deals the round being played (054 had the seat
-- before). The dealer keeps this round's deal and nobody else's turn moves. Before round 1: the last seat.
-- Since 056 (D139) a re-entry sits to the dealer's left too (45_reentry_left_of_dealer_056 has the details).
-- A = sree AX, B = harish BX, C = priya CX, D = zero DX; joiners N = otto NX, R = R K (RK), Q = C D (QD).
begin;
select plan(40);

\set A '''00000000-0000-4000-8000-000000000001'''
\set B '''00000000-0000-4000-8000-000000000002'''
\set C '''00000000-0000-4000-8000-000000000003'''
\set D '''00000000-0000-4000-8000-000000000008'''
\set N '''00000000-0000-4000-8000-000000000005'''
\set R '''00000000-0000-4000-8000-0000000000a1'''
\set Q '''00000000-0000-4000-8000-0000000000a3'''
\set G0 '''10000000-0000-4000-8000-0000000054a0'''
\set G1 '''10000000-0000-4000-8000-0000000054a1'''
\set G2 '''10000000-0000-4000-8000-0000000054a2'''
\set G3 '''10000000-0000-4000-8000-0000000054a3'''
\set P '''10000000-0000-4000-8000-0000000054b1'''

select has_function('public', 'add_seated_player', array['uuid', 'uuid', 'text']);
select ok((select prosrc like '%v_planned_after%' from pg_proc where proname = 'add_seated_player' and pronamespace = 'public'::regnamespace), 'add_seated_player is the 054 body');
select ok(has_function_privilege('authenticated', 'public.add_seated_player(uuid, uuid, text)', 'execute'), 'signed-in users may call it');
select ok(not has_function_privilege('anon', 'public.add_seated_player(uuid, uuid, text)', 'execute'), 'anon may not');
select ok((select prosecdef from pg_proc where proname = 'add_seated_player' and pronamespace = 'public'::regnamespace), 'still security definer');

insert into public.games (id, created_by, status, game_type, settings, share_code) values
  (:G0, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'JOIN50'),
  (:G1, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'JOIN51'),
  (:G2, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'JOIN52'),
  (:G3, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'JOIN53');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label)
select g, x.id, x.o, x.o + 1, (case when x.o = 0 then 'game_admin' else 'player' end)::public.game_member_role, true, x.l
  from (values (:G1::uuid), (:G2::uuid), (:G3::uuid)) gs(g),
       (values (:A::uuid, 0, 'AX'), (:B::uuid, 1, 'BX'), (:C::uuid, 2, 'CX'), (:D::uuid, 3, 'DX')) x(id, o, l);
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:G0, :A, 0, 1, 'game_admin', true, 'AX'),
  (:G0, :B, 1, 2, 'player', true, 'BX');

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
create function pg_temp.tests_seats(p_game uuid) returns text language sql as $$
  select string_agg(label, ' ' order by player_order) from public.game_players where game_id = p_game and player_order < 900;
$$;
create function pg_temp.tests_ini(p_game uuid, p_id uuid) returns text language sql as $$
  select gp.label from public.game_players gp where gp.game_id = p_game and gp.profile_id = p_id;
$$;

select tests.login(:A);

-- ---------- before round 1: nobody is dealing, the last seat ----------
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000054a0', '00000000-0000-4000-8000-000000000005', 'NX') $$, 'N joins before round 1');
select is(pg_temp.tests_seats(:G0), 'AX BX NX', 'before round 1: the last seat');
select is((select next_dealer_profile_id from public.games where id = :G0), null, 'and no dealer is pinned');

-- ---------- dealer in the middle: G2, rounds 1-2 dealt by A D, C deals round 3 ----------
select pg_temp.tests_round(:G2, 1); select pg_temp.tests_round(:G2, 2);
select is(pg_temp.tests_ini(:G2, public.current_dealer(:G2)), 'CX', 'G2 round 3: C (seat 3) deals');
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000054a2', '00000000-0000-4000-8000-000000000005', 'NX') $$, 'N joins while C deals');
select is(pg_temp.tests_seats(:G2), 'AX BX CX NX DX', 'N takes seat 4, between C and D (the dealer''s left); D moves up one');
select is((select player_order + 1 from public.game_players where game_id = :G2 and profile_id = :N), 4, 'N is seat 4');
select is((select display_number from public.game_players where game_id = :G2 and profile_id = :N), 5, 'the player number is the next free one, not the seat');
select is(pg_temp.tests_ini(:G2, public.current_dealer(:G2)), 'CX', 'C still deals round 3');
select is((select next_dealer_profile_id from public.games where id = :G2), :C::uuid, 'C is pinned to round 3 (N is now the seat before D, who dealt round 2)');
select is((select next_dealer_round from public.games where id = :G2), 3, 'for round 3 only');
select is((select next_dealer_keeps_sequence from public.games where id = :G2), false, 'and the deal follows from C');
select is((select count(*)::int from public.scores where game_id = :G2 and profile_id = :N), 2, 'a 0 for every round played');
select is((select count(*)::int from public.event_log where game_id = :G2 and kind = 'dealer_changed'), 0, 'the pin is not a dealer change in the Log');

-- a second joiner sits straight after the dealer too, so the first moves up one (the app seats picks in reverse)
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000054a2', '00000000-0000-4000-8000-0000000000a1', 'RK') $$, 'R joins too');
select is(pg_temp.tests_seats(:G2), 'AX BX CX RK NX DX', 'R takes seat 4: the dealer''s left; N moves up one');
select is(pg_temp.tests_ini(:G2, public.current_dealer(:G2)), 'CX', 'C still deals round 3');

-- nobody's turn moves: C B A D deal on, then the newcomers deal last
select pg_temp.tests_round(:G2, 3); select pg_temp.tests_round(:G2, 4); select pg_temp.tests_round(:G2, 5);
select pg_temp.tests_round(:G2, 6); select pg_temp.tests_round(:G2, 7); select pg_temp.tests_round(:G2, 8);
select is(pg_temp.tests_dealers(:G2), 'AX DX CX BX AX DX NX RK', 'rounds 3-6: C B A D, as before; then N and R deal last');
select is((select next_dealer_profile_id from public.games where id = :G2), null, 'the pin was used once');
select is(pg_temp.tests_ini(:G2, public.current_dealer(:G2)), 'CX', 'round 9: C again');

-- ---------- dealer at seat 1: G1, rounds 1-4 dealt A D C B, A deals round 5 ----------
select pg_temp.tests_round(:G1, 1); select pg_temp.tests_round(:G1, 2); select pg_temp.tests_round(:G1, 3); select pg_temp.tests_round(:G1, 4);
select is(pg_temp.tests_ini(:G1, public.current_dealer(:G1)), 'AX', 'G1 round 5: A (seat 1) deals');
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000054a1', '00000000-0000-4000-8000-000000000005', 'NX') $$, 'N joins while seat 1 deals');
select is(pg_temp.tests_seats(:G1), 'AX NX BX CX DX', 'dealer at seat 1: N takes seat 2 (the dealer''s left); B, C and D move up one');
select is(pg_temp.tests_ini(:G1, public.current_dealer(:G1)), 'AX', 'A still deals round 5');
select pg_temp.tests_round(:G1, 5); select pg_temp.tests_round(:G1, 6); select pg_temp.tests_round(:G1, 7); select pg_temp.tests_round(:G1, 8); select pg_temp.tests_round(:G1, 9);
select is(pg_temp.tests_dealers(:G1), 'AX DX CX BX AX DX CX BX NX', 'A D C B deal on; N deals last in the cycle');

-- ---------- a Dealer-sheet override is kept: G3, A dealt round 1, B (not D) really deals round 2 ----------
select pg_temp.tests_round(:G3, 1);
select public.set_round_dealer(:G3, 2, :B, true);
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000054a3', '00000000-0000-4000-8000-0000000000a3', 'QD') $$, 'Q joins while B deals (named on the Dealer sheet)');
select is(pg_temp.tests_seats(:G3), 'AX BX QD CX DX', 'Q sits to B''s left');
select is(pg_temp.tests_ini(:G3, public.current_dealer(:G3)), 'BX', 'B still deals round 2');

-- ---------- pool: an out seat is skipped; a re-entry sits to the dealer's left too (056) ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:P, :A, 'active', 'pool', '{"gameType":"pool","poolLimit":101,"reentryLimit":1,"dropAmount":25,"mdAmount":50,"maxCount":80}', 'JOIN54');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:P, :A, 0, 1, 'game_admin', true, 'AX'),
  (:P, :B, 1, 2, 'player', true, 'BX'),
  (:P, :C, 2, 3, 'player', true, 'CX');
select public.save_round(:P, 1, '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":60},{"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30}]'::jsonb, false);
select public.save_round(:P, 2, '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":50},{"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30}]'::jsonb, false);
select is(pg_temp.tests_ini(:P, public.current_dealer(:P)), 'AX', 'pool round 3: C dealt round 2, B (the seat before C) is out, A deals');
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000054b1', '00000000-0000-4000-8000-000000000005', 'NX') $$, 'N joins the pool');
select is(pg_temp.tests_seats(:P), 'AX NX BX CX', 'N sits to A''s left; B, who is out, moves up one');
select is(pg_temp.tests_ini(:P, public.current_dealer(:P)), 'AX', 'A still deals round 3');
select lives_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000054b1', '00000000-0000-4000-8000-000000000002') $$, 'B re-enters');
select is(pg_temp.tests_seats(:P), 'AX BX NX CX', '056 / 057: B re-enters on A''s left, between A and N');
select public.save_round(:P, 3, '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},{"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":10},{"playerId":"00000000-0000-4000-8000-000000000005","scoreType":"count","value":10}]'::jsonb, false);
select is(pg_temp.tests_dealers(:P), 'AX CX AX', 'round 3 was dealt by A');

select tests.logout();
select * from finish();
rollback;
