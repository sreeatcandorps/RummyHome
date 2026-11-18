-- 043 (PR 14 Multiplier): one reader of settings.multiplier, results as entered × multiplier in
-- bigint, the live-page key, the Multiplier label on the settings Log line, the range check.
-- Game M: sree (admin, seated) with harish, priya, zero; a points game at ×10,000.
begin;
select plan(37);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set M '''10000000-0000-4000-8000-0000000000f3'''
\set P '''10000000-0000-4000-8000-0000000000f4'''

-- ---------- A. game_multiplier ----------
select has_function('public', 'game_multiplier', array['jsonb', 'text']);
select is(public.game_multiplier('{}'::jsonb, 'stake'), 1, 'no key: ×1');
select is(public.game_multiplier('{"multiplier":null}'::jsonb, 'stake'), 1, 'null: ×1');
select is(public.game_multiplier('{"multiplier":100}'::jsonb, 'stake'), 100, '×100');
select is(public.game_multiplier('{"multiplier":10000}'::jsonb, 'stake'), 10000, 'the cap reads as itself');
select is(public.game_multiplier('{"multiplier":25000}'::jsonb, 'stake'), 10000, 'above the cap clamps to 10,000 (the trigger refuses it on write anyway)');
select is(public.game_multiplier('{"multiplier":0}'::jsonb, 'stake'), 1, '0 reads as ×1');
select is(public.game_multiplier('{"multiplier":"7"}'::jsonb, 'stake'), 1, 'a string is not a multiplier');
select is(public.game_multiplier('{"multiplier":100}'::jsonb, 'pool'), 1, 'a pool never multiplies');

-- ---------- E. the range check ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:M, :SREE, 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80,"multiplier":10000}', 'MULT43');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:M, :SREE, 0, 1, 'game_admin', true),
  (:M, :HARISH, 1, 2, 'player', true),
  (:M, :PRIYA, 2, 3, 'player', true),
  (:M, :ZERO, 3, 4, 'player', true);

select throws_ok($$ update public.games set settings = settings || '{"multiplier":25000}' where id = '10000000-0000-4000-8000-0000000000f3' $$,
  'PT430', null, 'above 10,000 is refused');
select throws_ok($$ update public.games set settings = settings || '{"multiplier":0}' where id = '10000000-0000-4000-8000-0000000000f3' $$,
  'PT430', null, '0 is refused');
select throws_ok($$ update public.games set settings = settings || '{"multiplier":2.5}' where id = '10000000-0000-4000-8000-0000000000f3' $$,
  'PT430', null, 'a fraction is refused');
select throws_ok($$ update public.games set settings = settings || '{"multiplier":"7"}' where id = '10000000-0000-4000-8000-0000000000f3' $$,
  'PT430', null, 'a string is refused');
select lives_ok($$ update public.games set settings = settings || '{"multiplier":null}' where id = '10000000-0000-4000-8000-0000000000f3' $$, 'null is allowed (reads as ×1)');
select lives_ok($$ update public.games set settings = settings || '{"multiplier":10000}' where id = '10000000-0000-4000-8000-0000000000f3' $$, 'back to ×10,000');

insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:P, :SREE, 'active', 'pool', '{"gameType":"pool","poolLimit":101,"dropAmount":25,"mdAmount":50,"maxCount":130}', 'POOL43');
select throws_ok($$ update public.games set settings = settings || '{"multiplier":5}' where id = '10000000-0000-4000-8000-0000000000f4' $$,
  'PT431', null, 'a pool cannot carry a multiplier');

-- ---------- D. the Log line ----------
select tests.login(:SREE);
-- rounds are entered points: the DB never stores multiplied values
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f3', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":240},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-80},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-80},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":-80}]'::jsonb, false) $$, 'round 1 (entered points)');
select is((select sum(value)::int from public.scores where game_id = :M and profile_id = :SREE), 240, 'stored values are entered points, not multiplied');

select lives_ok($$ update public.games set settings = settings || '{"multiplier":5}' where id = '10000000-0000-4000-8000-0000000000f3' $$, 'the multiplier may change with rounds played (no lock)');
select is((select summary from public.event_log where game_id = :M and kind = 'settings_changed' order by id desc limit 1),
  'Changed game settings · Multiplier ×10000→×5 · applies to the whole game (1 round re-priced)', 'the Log line labels the Multiplier and says whole game');
select is((select level::text from public.event_log where game_id = :M and kind = 'settings_changed' order by id desc limit 1), 'important', 'important once rounds exist');
select lives_ok($$ update public.games set settings = settings || '{"multiplier":10000}' where id = '10000000-0000-4000-8000-0000000000f3' $$, 'and back to ×10,000');

-- ---------- C. live page ----------
update public.games set view_token = repeat('a', 48) where id = :M;
select is((public.public_scorecard(repeat('a', 48)))->>'multiplier', '10000', 'public_scorecard carries the multiplier');
select is((public.public_scorecard(repeat('a', 48)))->'scores'->0->>'value', '240', 'and entered values');

-- ---------- B. results: entered × multiplier, bigint ----------
select tests.logout();
-- 6 extreme nights: a winner collecting +38,000 entered per game at ×10,000 = 380,000,000 each,
-- 2,280,000,000 in the result — past int4.
do $$
declare
  i integer;
  gid uuid;
begin
  for i in 1..6 loop
    gid := ('10000000-0000-4000-8000-0000000000' || lpad(to_hex(200 + i), 2, '0'))::uuid;
    insert into public.games (id, created_by, status, game_type, settings, share_code, completed_at)
    values (gid, '00000000-0000-4000-8000-000000000001', 'completed', 'stake',
            '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80,"multiplier":10000}',
            'EXTR' || i, now());
    insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
      (gid, '00000000-0000-4000-8000-000000000001', 0, 1, 'game_admin', true),
      (gid, '00000000-0000-4000-8000-000000000002', 1, 2, 'player', true),
      (gid, '00000000-0000-4000-8000-000000000003', 2, 3, 'player', true);
    insert into public.rounds (id, game_id, round_number, created_by)
    values (('30000000-0000-4000-8000-0000000000' || lpad(to_hex(200 + i), 2, '0'))::uuid, gid, 1, '00000000-0000-4000-8000-000000000001');
    insert into public.scores (game_id, round_id, profile_id, score_type, value) values
      (gid, ('30000000-0000-4000-8000-0000000000' || lpad(to_hex(200 + i), 2, '0'))::uuid, '00000000-0000-4000-8000-000000000001', 'rummy', 38000),
      (gid, ('30000000-0000-4000-8000-0000000000' || lpad(to_hex(200 + i), 2, '0'))::uuid, '00000000-0000-4000-8000-000000000002', 'count', -19000),
      (gid, ('30000000-0000-4000-8000-0000000000' || lpad(to_hex(200 + i), 2, '0'))::uuid, '00000000-0000-4000-8000-000000000003', 'count', -19000);
  end loop;
end $$;

select tests.login(:SREE);
select lives_ok($$ select public.declare_game_result(array[
  '10000000-0000-4000-8000-0000000000c9','10000000-0000-4000-8000-0000000000ca','10000000-0000-4000-8000-0000000000cb',
  '10000000-0000-4000-8000-0000000000cc','10000000-0000-4000-8000-0000000000cd','10000000-0000-4000-8000-0000000000ce']::uuid[]) $$,
  '6 extreme ×10,000 nights save as one result without integer out of range');
select tests.logout();
select is((select (s->>'points')::bigint from public.game_results r, jsonb_array_elements(r.places->'standings') s
            where r.declared_by = :SREE and s->>'id' = '00000000-0000-4000-8000-000000000001' order by r.declared_at desc limit 1),
  2280000000::bigint, 'the winner holds 2,280,000,000 actual points (entered 38,000 × 10,000 × 6)');
select is((select (s->>'points')::bigint from public.game_results r, jsonb_array_elements(r.places->'standings') s
            where r.declared_by = :SREE and s->>'id' = '00000000-0000-4000-8000-000000000002' order by r.declared_at desc limit 1),
  -1140000000::bigint, 'a loser holds −1,140,000,000');
select is((select g->>'multiplier' from public.game_results r, jsonb_array_elements(r.places->'games') g
            where r.declared_by = :SREE order by r.declared_at desc limit 1), '10000', 'each game entry carries its multiplier');
select is((select (g->'scores'->>'00000000-0000-4000-8000-000000000001')::bigint from public.game_results r, jsonb_array_elements(r.places->'games') g
            where r.declared_by = :SREE order by r.declared_at desc limit 1), 380000000::bigint, 'per-game scores in the result are actual points');

-- public_result reads the bigint back and carries the key
select is((select (s->>'points')::bigint from public.game_results r, jsonb_array_elements(public.public_result(r.id)->'standings') s
            where r.declared_by = :SREE and (s->>'place')::int = 1 order by r.declared_at desc limit 1),
  2280000000::bigint, 'public_result returns the bigint total');
select is((select g->>'multiplier' from public.game_results r, jsonb_array_elements(public.public_result(r.id)->'games') g
            where r.declared_by = :SREE order by r.declared_at desc limit 1), '10000', 'public_result games carry the multiplier');

-- a saved result is a snapshot: changing a game's multiplier afterwards does not move it
select lives_ok($$ update public.games set status = 'active', closed_at = null where id = '10000000-0000-4000-8000-0000000000c9' $$, 'reopen one game (test only)');
select lives_ok($$ update public.games set settings = settings || '{"multiplier":1}' where id = '10000000-0000-4000-8000-0000000000c9' $$, 'and drop its multiplier to ×1');
select is((select (s->>'points')::bigint from public.game_results r, jsonb_array_elements(public.public_result(r.id)->'standings') s
            where r.declared_by = :SREE and (s->>'place')::int = 1 order by r.declared_at desc limit 1),
  2280000000::bigint, 'the saved result is unchanged by a later multiplier change');

-- result_places_json recomputes in bigint when a game is removed from the result
select lives_ok($$ update public.game_result_games set removed_at = now()
  where game_id = '10000000-0000-4000-8000-0000000000ca' $$, 'remove one game from the result (test only)');
select is((select (s->>'points')::bigint from public.game_results r, jsonb_array_elements(public.result_places_json(r.id)->'standings') s
            where r.declared_by = :SREE and s->>'id' = '00000000-0000-4000-8000-000000000001' order by r.declared_at desc limit 1),
  1900000000::bigint, 'result_places_json sums the remaining five games in bigint');

-- a ×1 game with no key declares exactly as before
select is(public.game_multiplier((select settings from public.games where id = '10000000-0000-4000-8000-00000000000b'), 'stake'), 1, 'seeded game B reads as ×1');

select * from finish();
rollback;
