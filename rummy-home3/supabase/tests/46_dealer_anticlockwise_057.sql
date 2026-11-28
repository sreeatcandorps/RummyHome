-- 057 (Q63, Sree Nov 27): the deal moves anticlockwise. Seat 1 deals round 1, then the highest seat (who got
-- the first open card), then the seat before that, … skipping a pool player who is out. A player who joins or
-- re-enters sits on the dealer's left, the seat after the dealer, and deals last. Signatures are unchanged, so
-- old APKs keep calling the same functions.
-- Seats: A = sree AX 1, B = harish BX 2, C = priya CX 3, D = zero DX 4, N = otto NX 5.
begin;
select plan(33);

\set A '''00000000-0000-4000-8000-000000000001'''
\set B '''00000000-0000-4000-8000-000000000002'''
\set C '''00000000-0000-4000-8000-000000000003'''
\set D '''00000000-0000-4000-8000-000000000008'''
\set N '''00000000-0000-4000-8000-000000000005'''
\set G5 '''10000000-0000-4000-8000-0000000057a5'''
\set GJ '''10000000-0000-4000-8000-0000000057a6'''
\set GP '''10000000-0000-4000-8000-0000000057a7'''

-- ---------- shape: same signatures, one new internal helper ----------
select has_function('public', 'round_rule_dealer', array['uuid[]', 'integer']);
select ok(not has_function_privilege('authenticated', 'public.round_rule_dealer(uuid[], integer)', 'execute'), 'round_rule_dealer is internal');
select ok(not has_function_privilege('anon', 'public.round_rule_dealer(uuid[], integer)', 'execute'), 'and anon may not call it');
select has_function('public', 'save_round', array['uuid', 'integer', 'jsonb', 'boolean']);
select has_function('public', 'set_seating_order', array['uuid', 'uuid[]']);
select has_function('public', 'add_seated_player', array['uuid', 'uuid', 'text']);
select has_function('public', 'reenter_player', array['uuid', 'uuid', 'integer']);
select ok((select prosrc like '%round_rule_dealer%' from pg_proc where proname = 'save_round' and pronamespace = 'public'::regnamespace), 'save_round is the 057 body');
select ok((select prosrc like '%round_rule_dealer%' from pg_proc where proname = 'set_seating_order' and pronamespace = 'public'::regnamespace), 'set_seating_order is the 057 body');
select ok((select prosrc like '%v_dealer_order + 1%' from pg_proc where proname = 'add_seated_player' and pronamespace = 'public'::regnamespace), 'add_seated_player is the 057 body');
select ok((select prosrc like '%v_left_of%' from pg_proc where proname = 'reenter_player' and pronamespace = 'public'::regnamespace), 'reenter_player is the 057 body');

-- ---------- round_rule_dealer: round k is dealt by seat 1, N, N-1, … ----------
select is(public.round_rule_dealer(array[:A, :B, :C, :D, :N]::uuid[], 1), :A::uuid, 'round 1: seat 1');
select is(public.round_rule_dealer(array[:A, :B, :C, :D, :N]::uuid[], 2), :N::uuid, 'round 2: seat 5');
select is(public.round_rule_dealer(array[:A, :B, :C, :D, :N]::uuid[], 3), :D::uuid, 'round 3: seat 4');
select is(public.round_rule_dealer(array[:A, :B, :C, :D, :N]::uuid[], 6), :A::uuid, 'round 6: seat 1 again');
select is(public.round_rule_dealer(array[:A, :B, :C, :D, :N]::uuid[], 7), :N::uuid, 'round 7: seat 5 again');
select is(public.round_rule_dealer(array[]::uuid[], 3), null::uuid, 'nobody at the table: no dealer');

-- ---------- next_in_rotation: the seat before, wrapping from seat 1 to the last seat ----------
select is(public.next_in_rotation(array[:A, :B, :C, :D, :N]::uuid[], :A, null), :N::uuid, 'after seat 1 deals, seat 5');
select is(public.next_in_rotation(array[:A, :B, :C, :D, :N]::uuid[], :C, null), :B::uuid, 'after seat 3 deals, seat 2');
select is(public.next_in_rotation(array[:A, :B, :C, :D, :N]::uuid[], null, null), :A::uuid, 'no dealer yet: seat 1');

insert into public.games (id, created_by, status, game_type, settings, share_code) values
  (:G5, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'CCW571'),
  (:GJ, :A, 'active', 'stake', '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}', 'CCW572'),
  (:GP, :A, 'active', 'pool', '{"gameType":"pool","poolLimit":101,"dropAmount":25,"mdAmount":50,"maxCount":80}', 'CCW573');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label) values
  (:G5, :A, 0, 1, 'game_admin', true, 'AX'), (:G5, :B, 1, 2, 'player', true, 'BX'), (:G5, :C, 2, 3, 'player', true, 'CX'),
  (:G5, :D, 3, 4, 'player', true, 'DX'), (:G5, :N, 4, 5, 'player', true, 'NX'),
  (:GJ, :A, 0, 1, 'game_admin', true, 'AX'), (:GJ, :B, 1, 2, 'player', true, 'BX'), (:GJ, :C, 2, 3, 'player', true, 'CX'),
  (:GJ, :D, 3, 4, 'player', true, 'DX'),
  (:GP, :A, 0, 1, 'game_admin', true, 'AX'), (:GP, :B, 1, 2, 'player', true, 'BX'), (:GP, :C, 2, 3, 'player', true, 'CX'),
  (:GP, :D, 3, 4, 'player', true, 'DX');

-- A seat that is not in the rotation (out of the pool): the deal goes to the first seat below it still in.
select is(public.next_in_rotation(array[:A, :B, :D]::uuid[], :C, :GP), :B::uuid, 'after an out seat 3, seat 2');
select is(public.next_in_rotation(array[:B, :C, :D]::uuid[], :A, :GP), :D::uuid, 'after an out seat 1, the last seat still in');

create function pg_temp.round(p_game uuid, p_round integer, p_ids uuid[]) returns uuid language sql as $$
  select public.save_round(p_game, p_round,
    (select jsonb_agg(jsonb_build_object('playerId', t.id, 'scoreType', case when t.o = 1 then 'rummy' else 'count' end,
                                         'value', case when t.o = 1 then 10 * (cardinality(p_ids) - 1) else -10 end))
       from unnest(p_ids) with ordinality t(id, o)), false);
$$;
create function pg_temp.dealers(p_game uuid) returns text language sql as $$
  select string_agg(coalesce(gp.label, '?'), ' ' order by r.round_number)
    from public.rounds r left join public.game_players gp on gp.game_id = r.game_id and gp.profile_id = r.dealer_profile_id
   where r.game_id = p_game and r.undone_at is null and r.round_number < 1000;
$$;
create function pg_temp.seats(p_game uuid) returns text language sql as $$
  select string_agg(label, ' ' order by player_order) from public.game_players where game_id = p_game and player_order < 900;
$$;
create function pg_temp.ini(p_game uuid, p_id uuid) returns text language sql as $$
  select gp.label from public.game_players gp where gp.game_id = p_game and gp.profile_id = p_id;
$$;

select tests.login(:A);

-- ---------- the 5-player × 6-round table of docs/dealer-anticlockwise.md ----------
select pg_temp.round(:G5, 1, array[:A, :B, :C, :D, :N]::uuid[]); select pg_temp.round(:G5, 2, array[:A, :B, :C, :D, :N]::uuid[]);
select pg_temp.round(:G5, 3, array[:A, :B, :C, :D, :N]::uuid[]); select pg_temp.round(:G5, 4, array[:A, :B, :C, :D, :N]::uuid[]);
select pg_temp.round(:G5, 5, array[:A, :B, :C, :D, :N]::uuid[]); select pg_temp.round(:G5, 6, array[:A, :B, :C, :D, :N]::uuid[]);
select is(pg_temp.dealers(:G5), 'AX NX DX CX BX AX', 'six rounds: seat 1, then 5 4 3 2, then 1 again');
select is(pg_temp.ini(:G5, public.current_dealer(:G5)), 'NX', 'round 7: seat 5');

-- ---------- a join after round 1: the seat after the dealer, who deals last ----------
select pg_temp.round(:GJ, 1, array[:A, :B, :C, :D]::uuid[]);
select is(pg_temp.ini(:GJ, public.current_dealer(:GJ)), 'DX', 'round 2: seat 4 (the last seat) deals');
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000057a6', '00000000-0000-4000-8000-000000000005', 'NX') $$, 'N joins while D deals');
select is(pg_temp.seats(:GJ), 'AX BX CX DX NX', 'N sits after D, the dealer''s left; nobody moves');
select is(pg_temp.ini(:GJ, public.current_dealer(:GJ)), 'DX', 'D still deals round 2 (pinned: N is now the seat before A)');
select pg_temp.round(:GJ, 2, array[:A, :B, :C, :D, :N]::uuid[]); select pg_temp.round(:GJ, 3, array[:A, :B, :C, :D, :N]::uuid[]);
select pg_temp.round(:GJ, 4, array[:A, :B, :C, :D, :N]::uuid[]); select pg_temp.round(:GJ, 5, array[:A, :B, :C, :D, :N]::uuid[]);
select pg_temp.round(:GJ, 6, array[:A, :B, :C, :D, :N]::uuid[]);
select is(pg_temp.dealers(:GJ), 'AX DX CX BX AX NX', 'D C B A deal on as before; N deals last');
select is(pg_temp.ini(:GJ, public.current_dealer(:GJ)), 'DX', 'then D again');

-- ---------- pool: an out seat is skipped going down ----------
select public.save_round(:GP, 1, '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},{"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":60},{"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":10}]'::jsonb, false);
select public.save_round(:GP, 2, '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},{"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":50},{"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":10}]'::jsonb, false);
select is(pg_temp.dealers(:GP), 'AX DX', 'pool rounds 1-2: A then D');
select is((select out_round from public.game_players where game_id = :GP and profile_id = :C), 2, 'C is out in round 2');
select is(pg_temp.ini(:GP, public.current_dealer(:GP)), 'BX', 'round 3: C (the seat before D) is out, so B');

select tests.logout();
select * from finish();
rollback;
