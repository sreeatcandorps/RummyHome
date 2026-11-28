-- 056 (D139): a player who re-enters a pool sits to the dealer's left, the seat that deals last, unless the
-- admin picks a seat. Since 057 (Q63, the deal moves anticlockwise) that is the seat AFTER whoever deals the
-- round being played. The dealer keeps this round's deal; seats stay 1 … N.
-- design-review-2 §10.6 mirrored for 057: SK HG VR PK AS; rounds 1-2 dealt by SK and AS, VR and HG out in
-- round 2, PK deals round 3. A = sree SK, B = harish AS, C = priya PK, N = otto VR, D = zero HG.
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

-- SK HG VR PK AS in G1-G3; SK AS VR HG PK in G5 (HG already on AS's left, an out seat between); SK HG AS in G4.
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label)
select g, x.id, x.o, x.o + 1, (case when x.o = 0 then 'game_admin' else 'player' end)::public.game_member_role, true, x.l
  from (values (:G1::uuid), (:G2::uuid), (:G3::uuid)) gs(g),
       (values (:A::uuid, 0, 'SK'), (:D::uuid, 1, 'HG'), (:N::uuid, 2, 'VR'), (:C::uuid, 3, 'PK'), (:B::uuid, 4, 'AS')) x(id, o, l);
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:G5, :A, 0, 1, 'game_admin', true, 'SK'),
  (:G5, :B, 1, 2, 'player', true, 'AS'),
  (:G5, :N, 2, 3, 'player', true, 'VR'),
  (:G5, :D, 3, 4, 'player', true, 'HG'),
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
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'round 3: PK (seat 4) deals');

-- ---------- G1: the default, called the old way (two arguments) ----------
select is((public.reenter_player(:G1, :D))->>'score', '30', 'HG comes back at the highest score still in (047 unchanged)');
select is(pg_temp.seats(:G1), 'SK VR PK HG AS', 'HG takes seat 4, between PK and AS (the dealer''s left); VR and PK move down one');
select is((select array_agg(player_order order by player_order) from public.game_players where game_id = :G1), array[0, 1, 2, 3, 4], 'seat numbers have no gaps');
select is((select reentered_round from public.game_players where game_id = :G1 and profile_id = :D), 3, 'back in before round 3');
select is((select entries from public.game_players where game_id = :G1 and profile_id = :D), 2, 'entry 2');
select is((select out_round from public.game_players where game_id = :G1 and profile_id = :D), null, 'no longer out');
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'PK still deals round 3');
select is((select next_dealer_profile_id from public.games where id = :G1), :C::uuid, 'PK is pinned to round 3 (HG is now the seat before AS, who dealt round 2)');
select is((select next_dealer_round from public.games where id = :G1), 3, 'for round 3 only');
select is((select next_dealer_keeps_sequence from public.games where id = :G1), false, 'and the deal follows from PK');
select is((select summary from public.event_log where game_id = :G1 and kind = 'player_reentered' order by id desc limit 1),
  'Zed Zero re-entered at 30 · Before round 3 · Entry 2 · Seat 2 → 4 (left of Priya Test)', 'the Log names the seat change');
select is((select details->>'seatFrom' || ' ' || (details->>'seat') from public.event_log where game_id = :G1 and kind = 'player_reentered' order by id desc limit 1), '2 4', 'the details carry seatFrom / seat');

-- Undo last round undoes the re-entry and leaves the seat (no seat history, D50).
select is((public.undo_last_round(:G1))->>'reentryUndone', :D, 'Undo last round undoes the re-entry first');
select is(pg_temp.seats(:G1), 'SK VR PK HG AS', 'the seat stays where it is');
select is((select out_round from public.game_players where game_id = :G1 and profile_id = :D), 2, 'HG is out again');
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'PK still deals round 3');

-- Re-entering again: he is already on the dealer's left, so he stays.
select is((public.reenter_player(:G1, :D))->>'seat', '4', 'HG re-enters again and keeps seat 4 (already left of PK)');
select is(pg_temp.seats(:G1), 'SK VR PK HG AS', 'nobody moves');
-- A second re-entry sits between the dealer and the first.
select is((public.reenter_player(:G1, :N))->>'seat', '3', 'VR re-enters too');
select is(pg_temp.seats(:G1), 'SK PK VR HG AS', 'VR takes seat 3, between PK and HG: still the dealer''s left');
select is(pg_temp.ini(:G1, public.current_dealer(:G1)), 'PK', 'PK still deals round 3');
select pg_temp.pool_round(:G1, 3, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 4, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 5, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 6, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select pg_temp.pool_round(:G1, 7, array[:A, :B, :D, :N, :C]::uuid[], array[0, 5, 5, 5, 5]);
select is(pg_temp.dealers(:G1), 'SK AS PK SK AS HG VR', 'PK deals round 3, then SK and AS as before; the two who came back deal last');
select is((select next_dealer_profile_id from public.games where id = :G1), null, 'the pin was used once');

-- ---------- G2: Keep seat 2 (today's behaviour) ----------
select is((public.reenter_player(:G2, :D, 2))->>'seat', '2', 'Keep seat 2');
select is(pg_temp.seats(:G2), 'SK HG VR PK AS', 'nobody moves');
select is((select next_dealer_profile_id from public.games where id = :G2), null, 'no pin: the plan is unchanged');
select is((select summary from public.event_log where game_id = :G2 and kind = 'player_reentered' order by id desc limit 1),
  'Zed Zero re-entered at 30 · Before round 3 · Entry 2 · Seat 2', 'the Log says the seat he kept');
select pg_temp.pool_round(:G2, 3, array[:A, :B, :C, :D]::uuid[], array[0, 5, 5, 5]);
select pg_temp.pool_round(:G2, 4, array[:A, :B, :C, :D]::uuid[], array[0, 5, 5, 5]);
select is(pg_temp.dealers(:G2), 'SK AS PK HG', 'kept seat: HG deals round 4, straight after coming back');

-- ---------- G3: another seat (tap VR = sit on VR's left, seat 3) ----------
select is((public.reenter_player(:G3, :D, 3))->>'seat', '3', 'seat 3 picked');
select is(pg_temp.seats(:G3), 'SK VR HG PK AS', 'HG sits between VR and PK; VR moves down one');
select is(pg_temp.ini(:G3, public.current_dealer(:G3)), 'PK', 'PK still deals round 3');
select is((select next_dealer_profile_id from public.games where id = :G3), null, 'no pin needed: before AS comes PK either way');
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000056a3', '00000000-0000-4000-8000-000000000005', 0) $$, 'Seat must be 1 to 5.', 'seat 0 is refused');
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000056a3', '00000000-0000-4000-8000-000000000005', 6) $$, 'Seat must be 1 to 5.', 'seat 6 of 5 is refused');
select is(pg_temp.seats(:G3), 'SK VR HG PK AS', 'a refused call changes nothing');
select pg_temp.pool_round(:G3, 3, array[:A, :D, :B, :C]::uuid[], array[0, 5, 5, 5]);
select pg_temp.pool_round(:G3, 4, array[:A, :D, :B, :C]::uuid[], array[0, 5, 5, 5]);
select pg_temp.pool_round(:G3, 5, array[:A, :D, :B, :C]::uuid[], array[0, 5, 5, 5]);
select is(pg_temp.dealers(:G3), 'SK AS PK HG SK', 'HG deals round 4, straight after PK');

-- ---------- G4: the dealer at the highest seat — he takes the last seat ----------
-- SK HG AS; HG out in round 1; AS deals round 2, SK round 3; AS (seat 3) deals round 4.
select pg_temp.pool_round(:G4, 1, array[:A, :D, :B]::uuid[], array[0, 110, 20]);
select pg_temp.pool_round(:G4, 2, array[:A, :B]::uuid[], array[0, 20]);
select pg_temp.pool_round(:G4, 3, array[:A, :B]::uuid[], array[0, 20]);
select is(pg_temp.ini(:G4, public.current_dealer(:G4)), 'AS', 'G4 round 4: AS (seat 3) deals');
select is((public.reenter_player(:G4, :D))->>'seat', '3', 'HG re-enters');
select is(pg_temp.seats(:G4), 'SK AS HG', 'dealer at the last seat: HG takes the seat after him, the last seat; AS moves down one');
select is(pg_temp.ini(:G4, public.current_dealer(:G4)), 'AS', 'AS still deals round 4');

-- ---------- G5: already on the dealer's left, an out seat between ----------
select is(pg_temp.ini(:G5, public.current_dealer(:G5)), 'AS', 'G5 round 3: PK dealt round 2, HG and VR are out, AS (seat 2) deals');
select is((public.reenter_player(:G5, :D))->>'seat', '4', 'HG re-enters');
select is(pg_temp.seats(:G5), 'SK AS VR HG PK', 'only VR (out) sits between AS and HG, so nobody moves');
select is(pg_temp.ini(:G5, public.current_dealer(:G5)), 'AS', 'AS still deals round 3');

-- ---------- a non-admin is refused ----------
select tests.logout();
select tests.login(:B);
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000056a5', '00000000-0000-4000-8000-000000000005') $$, '42501', NULL, 'a player who is not an admin cannot re-enter anyone');

select tests.logout();
select * from finish();
rollback;
