-- 056 (D139): a player who re-enters a pool sits to the dealer's left — the seat before whoever deals the
-- round being played — unless the admin picks a seat. The dealer keeps this round's deal; seats stay 1 … N.
-- The 5-seat pool of design-review-2 §10.6: SK AS PK VR HG; rounds 1-2 dealt by SK and AS, VR and HG out
-- in round 2, PK deals round 3. A = sree SK, B = harish AS, C = priya PK, N = otto VR, D = zero HG.
begin;
select plan(53);

\set A '''00000000-0000-4000-8000-000000000001'''
\set B '''00000000-0000-4000-8000-000000000002'''
\set C '''00000000-0000-4000-8000-000000000003'''
\set N '''00000000-0000-4000-8000-000000000005'''
\set D '''00000000-0000-4000-8000-000000000008'''
\set G1 '''10000000-0000-4000-8000-0000000056a1'''
\set G2 '''10000000-0000-4000-8000-0000000056a2'''
\set G3 '''10000000-0000-4000-8000-0000000056a3'''
\set G4 '''10000000-0000-4000-8000-0000000056a4'''
\set G5 '''10000000-0000-4000-8000-0000000056a5'''

select has_function('public', 'reenter_player', array['uuid', 'uuid', 'integer']);
select hasnt_function('public', 'reenter_player', array['uuid', 'uuid'], 'the two-argument version is gone (one function, p_seat defaults to null)');
select ok((select prosrc like '%v_planned_after%' from pg_proc where proname = 'reenter_player' and pronamespace = 'public'::regnamespace), 'reenter_player is the 056 body');
select ok(has_function_privilege('authenticated', 'public.reenter_player(uuid, uuid, integer)', 'execute'), 'signed-in users may call it');
select ok(not has_function_privilege('anon', 'public.reenter_player(uuid, uuid, integer)', 'execute'), 'anon may not');
select ok((select prosecdef from pg_proc where proname = 'reenter_player' and pronamespace = 'public'::regnamespace), 'still security definer');

insert into public.games (id, created_by, status, game_type, settings, share_code)
select g, :A, 'active', 'pool', '{"gameType":"pool","poolLimit":101,"dropAmount":25,"mdAmount":50,"maxCount":130}', c
  from (values (:G1::uuid, 'REEN61'), (:G2::uuid, 'REEN62'), (:G3::uuid, 'REEN63'), (:G4::uuid, 'REEN64'), (:G5::uuid, 'REEN65')) x(g, c);

-- SK AS PK VR HG in G1-G3; SK AS HG VR PK in G5 (HG already on PK's left, an out seat between); SK HG AS in G4.
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label)
select g, x.id, x.o, x.o + 1, (case when x.o = 0 then 'game_admin' else 'player' end)::public.game_member_role, true, x.l
  from (values (:G1::uuid), (:G2::uuid), (:G3::uuid)) gs(g),
       (values (:A::uuid, 0, 'SK'), (:B::uuid, 1, 'AS'), (:C::uuid, 2, 'PK'), (:N::uuid, 3, 'VR'), (:D::uuid, 4, 'HG')) x(id, o, l);
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:G5, :A, 0, 1, 'game_admin', true, 'SK'),
  (:G5, :B, 1, 2, 'player', true, 'AS'),
  (:G5, :D, 2, 3, 'player', true, 'HG'),
  (:G5, :N, 3, 4, 'player', true, 'VR'),
  (:G5, :C, 4, 5, 'player', true, 'PK'),
  (:G4, :A, 0, 1, 'game_admin', true, 'SK'),
  (:G4, :D, 1, 2, 'player', true, 'HG'),
  (:G4, :B, 2, 3, 'player', true, 'AS');

-- A pool round from (player, hand) pairs; a 0 is the winner.
create function pg_temp.pool_round(p_game uuid, p_round integer, p_ids uuid[], p_values integer[]) returns uuid language sql as $$
  select public.save_round(p_game, p_round,
    (select jsonb_agg(jsonb_build_object('playerId', t.id, 'scoreType', case when t.v = 0 then 'rummy' else 'count' end, 'value', t.v))
       from unnest(p_ids, p_values) t(id, v)), false);
$$;
create function pg_temp.dealers(p_game uuid) returns text language sql as $$
  select string_agg(coalesce(gp.label, '?'), ' ' order by r.round_number)
    from public.rounds r left join public.game_players gp on gp.game_id = r.game_id and gp.profile_id = r.dealer_profile_id
   where r.game_id = p_game and r.undone_at is null and r.round_number < 1000;
$$;
create function pg_temp.seats(p_game uuid) returns text language sql as $$
  select string_agg(label, ' ' order by player_order) from public.game_players
   where game_id = p_game and role <> 'spectator' and coalesce(seated, true) and player_order < 900;
$$;
create function pg_temp.ini(p_game uuid, p_id uuid) returns text language sql as $$
  select gp.label from public.game_players gp where gp.game_id = p_game and gp.profile_id = p_id;
$$;

select tests.login(:A);

-- Rounds 1-2 (SK, AS deal): VR and HG reach 110 and are out in round 2; SK 0, AS 30, PK 30.
select pg_temp.pool_round(g, 1, array[:A, :B, :C, :N, :D]::uuid[], array[0, 20, 20, 60, 60]) from (values (:G1::uuid), (:G2::uuid), (:G3::uuid)) x(g);
select pg_temp.pool_round(g, 2, array[:A, :B, :C, :N, :D]::uuid[], array[0, 10, 10, 50, 50]) from (values (:G1::uuid), (:G2::uuid), (:G3::uuid)) x(g);
select pg_temp.pool_round(:G5, 1, array[:A, :B, :D, :N, :C]::uuid[], array[0, 20, 60, 60, 20]);
select pg_temp.pool_round(:G5, 2, array[:A, :B, :D, :N, :C]::uuid[], array[0, 10, 50, 50, 10]);
select is((select out_round from public.game_players where game_id = :G1 and profile_id = :D), 2, 'HG is out in round 2');
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'round 3: PK (seat 3) deals');

-- ---------- G1: the default, called the old way (two arguments) ----------
select is((public.reenter_player(:G1, :D))->>'score', '30', 'HG comes back at the highest score still in (047 unchanged)');
select is(pg_temp.seats(:G1), 'SK AS HG PK VR', 'HG takes seat 3, between AS and PK (the dealer''s left); PK and VR move up one');
select is((select array_agg(player_order order by player_order) from public.game_players where game_id = :G1), array[0, 1, 2, 3, 4], 'seat numbers have no gaps');
select is((select reentered_round from public.game_players where game_id = :G1 and profile_id = :D), 3, 'back in before round 3');
select is((select entries from public.game_players where game_id = :G1 and profile_id = :D), 2, 'entry 2');
select is((select out_round from public.game_players where game_id = :G1 and profile_id = :D), null, 'no longer out');
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'PK still deals round 3');
select is((select next_dealer_profile_id from public.games where id = :G1), :C::uuid, 'PK is pinned to round 3 (HG is now the seat after AS)');
select is((select next_dealer_round from public.games where id = :G1), 3, 'for round 3 only');
select is((select next_dealer_keeps_sequence from public.games where id = :G1), false, 'and the deal follows from PK');
select is((select summary from public.event_log where game_id = :G1 and kind = 'player_reentered' order by id desc limit 1),
  'Zed Zero re-entered at 30 · Before round 3 · Entry 2 · Seat 5 → 3 (left of Priya Test)', 'the Log names the seat change');
select is((select details->>'seatFrom' || ' ' || (details->>'seat') from public.event_log where game_id = :G1 and kind = 'player_reentered' order by id desc limit 1), '5 3', 'the details carry seatFrom / seat');

-- Undo last round undoes the re-entry and leaves the seat (no seat history, D50).
select is((public.undo_last_round(:G1))->>'reentryUndone', :D, 'Undo last round undoes the re-entry first');
select is(pg_temp.seats(:G1), 'SK AS HG PK VR', 'the seat stays where it is');
select is((select out_round from public.game_players where game_id = :G1 and profile_id = :D), 2, 'HG is out again');
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'PK still deals round 3');

-- Re-entering again: he is already on the dealer's left, so he stays.
select is((public.reenter_player(:G1, :D))->>'seat', '3', 'HG re-enters again and keeps seat 3 (already left of PK)');
select is(pg_temp.seats(:G1), 'SK AS HG PK VR', 'nobody moves');
-- A second re-entry sits between the first and the dealer.
select is((public.reenter_player(:G1, :N))->>'seat', '4', 'VR re-enters too');
select is(pg_temp.seats(:G1), 'SK AS HG VR PK', 'VR takes seat 4, between HG and PK: still the dealer''s left');
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'PK still deals round 3');
select pg_temp.pool_round(:G1, 3, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 4, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 5, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 6, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 7, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select is(pg_temp.dealers(:G1), 'SK AS PK SK AS HG VR', 'PK deals round 3, then SK and AS as before; the two who came back deal last');
select is((select next_dealer_profile_id from public.games where id = :G1), null, 'the pin was used once');

-- ---------- G2: Keep seat 5 (today's behaviour) ----------
select is((public.reenter_player(:G2, :D, 5))->>'seat', '5', 'Keep seat 5');
select is(pg_temp.seats(:G2), 'SK AS PK VR HG', 'nobody moves');
select is((select next_dealer_profile_id from public.games where id = :G2), null, 'no pin: the plan is unchanged');
select is((select summary from public.event_log where game_id = :G2 and kind = 'player_reentered' order by id desc limit 1),
  'Zed Zero re-entered at 30 · Before round 3 · Entry 2 · Seat 5', 'the Log says the seat he kept');
select pg_temp.pool_round(:G2, 3, array[:A, :B, :C, :D]::uuid[], array[0, 5, 5, 5]);
select pg_temp.pool_round(:G2, 4, array[:A, :B, :C, :D]::uuid[], array[0, 5, 5, 5]);
select is(pg_temp.dealers(:G2), 'SK AS PK HG', 'kept seat: HG deals round 4, straight after coming back');

-- ---------- G3: another seat (tap AS = sit on AS's left, seat 2) ----------
select is((public.reenter_player(:G3, :D, 2))->>'seat', '2', 'seat 2 picked');
select is(pg_temp.seats(:G3), 'SK HG AS PK VR', 'HG sits between SK and AS; AS, PK, VR move up one');
select is(pg_temp.ini(:G3, public.current_dealer(:G3)), 'PK', 'PK still deals round 3');
select is((select next_dealer_profile_id from public.games where id = :G3), null, 'no pin needed: after AS comes PK either way');
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000056a3', '00000000-0000-4000-8000-000000000005', 0) $$, 'Seat must be 1 to 5.', 'seat 0 is refused');
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000056a3', '00000000-0000-4000-8000-000000000005', 6) $$, 'Seat must be 1 to 5.', 'seat 6 of 5 is refused');
select is(pg_temp.seats(:G3), 'SK HG AS PK VR', 'a refused call changes nothing');
select pg_temp.pool_round(:G3, 3, array[:A, :D, :B, :C]::uuid[], array[0, 5, 5, 5]);
select pg_temp.pool_round(:G3, 4, array[:A, :D, :B, :C]::uuid[], array[0, 5, 5, 5]);
select pg_temp.pool_round(:G3, 5, array[:A, :D, :B, :C]::uuid[], array[0, 5, 5, 5]);
select is(pg_temp.dealers(:G3), 'SK AS PK SK HG', 'HG deals round 5, after SK');

-- ---------- G4: the dealer at the lowest seat — he takes the last seat ----------
-- SK HG AS; HG out in round 1; AS deals round 2; SK (seat 1) deals round 3.
select pg_temp.pool_round(:G4, 1, array[:A, :D, :B]::uuid[], array[0, 110, 20]);
select pg_temp.pool_round(:G4, 2, array[:A, :B]::uuid[], array[0, 20]);
select is(pg_temp.ini(:G4, public.current_dealer(:G4)), 'SK', 'G4 round 3: SK (seat 1) deals');
select is((public.reenter_player(:G4, :D))->>'seat', '3', 'HG re-enters');
select is(pg_temp.seats(:G4), 'SK AS HG', 'dealer at seat 1: HG takes the last seat (the dealer''s left, round the circle)');
select is(pg_temp.ini(:G4, public.current_dealer(:G4)), 'SK', 'SK still deals round 3');

-- ---------- G5: already on the dealer's left, an out seat between ----------
select is(pg_temp.ini(:G5, public.current_dealer(:G5)), 'PK', 'G5 round 3: PK (seat 5) deals');
select is((public.reenter_player(:G5, :D))->>'seat', '3', 'HG re-enters');
select is(pg_temp.seats(:G5), 'SK AS HG VR PK', 'only VR (out) sits between HG and PK, so nobody moves');
select is(pg_temp.ini(:G5, public.current_dealer(:G5)), 'PK', 'PK still deals round 3');

-- ---------- a non-admin is refused ----------
select tests.logout();
select tests.login(:B);
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000056a5', '00000000-0000-4000-8000-000000000005') $$, '42501', NULL, 'a player who is not an admin cannot re-enter anyone');

select tests.logout();
select * from finish();
rollback;
