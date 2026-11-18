-- 014/019 save_round: one transaction for round + scores + current_round; duplicate submit
-- (same payload = no-op, different payload = PT409), unknown player (PT409), empty-round
-- reuse, Edit round (replace), and who may call it.
-- Game A has live rounds 1 and 2 and current_round = 3.
begin;
select plan(21);

-- seated player: refused
select tests.login('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":10}]'::jsonb, false) $$,
  '42501', 'Only a game admin can save scores.', 'seated player cannot save a round');

-- viewer: refused
select tests.login('00000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10}]'::jsonb, false) $$,
  '42501', 'Only a game admin can save scores.', 'viewer cannot save a round');

-- outsider: refused (same message, no hint that the game exists)
select tests.login('00000000-0000-4000-8000-000000000005');
select throws_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10}]'::jsonb, false) $$,
  '42501', 'Only a game admin can save scores.', 'outsider cannot save a round');

-- non-playing creator saves round 3
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20},
         {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"count","value":0},
         {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"rummy","value":30}]'::jsonb, false) $$,
  'creator saves round 3');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and round_number = 3 and undone_at is null)::int, 1, 'one live round 3');
select is((select count(*) from public.scores s join public.rounds r on r.id = s.round_id where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.round_number = 3)::int, 4, 'four scores on round 3');
select is((select current_round from public.games where id = '10000000-0000-4000-8000-00000000000a'), 4, 'current_round advanced to 4');
select is(
  (select dealer_profile_id from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and round_number = 3 and undone_at is null),
  '00000000-0000-4000-8000-0000000000a1'::uuid, 'dealer for round 3 is the third seat in order (rk)');

-- duplicate submit of round 3 with the SAME payload (double tap / retry): no error, no second set of scores
select lives_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"rummy","value":30},
         {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"count","value":0},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20},
         {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10}]'::jsonb, false) $$,
  'the same payload submitted again does not error (order does not matter)');
select is((select count(*) from public.scores s join public.rounds r on r.id = s.round_id where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.round_number = 3 and r.undone_at is null)::int, 4, 'still four scores after the duplicate submit');

-- a DIFFERENT payload for a round that is already saved: refused with PT409 (019), nothing changes
select throws_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-99}]'::jsonb, false) $$,
  'PT409', 'Round 3 was just saved by Sree Test. Check the scorecard before you save again.',
  'a different payload for a saved round is a PT409 conflict that names the saver (035), not a silent no-op');
select is((select sum(value) from public.scores s join public.rounds r on r.id = s.round_id where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.round_number = 3 and r.undone_at is null)::int, 0, 'the first payload is the one kept');

-- a player who is not in the game: refused with PT409 (019), no round is created
select throws_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 9,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
         {"playerId":"00000000-0000-4000-8000-000000000005","scoreType":"rummy","value":10}]'::jsonb, false) $$,
  'PT409', 'The players in this game changed while you were scoring. The scorecard has been refreshed; check the round and save it again.',
  'a score for someone who is not in the game is refused');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and round_number = 9)::int, 0, 'no round 9 was created');

-- an empty live round (an interrupted save) is reused, not duplicated
select tests.logout();
insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 4, '00000000-0000-4000-8000-000000000001');
select tests.login('00000000-0000-4000-8000-000000000006');  -- unseated co-admin finishes it
select lives_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 4,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":20},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20}]'::jsonb, false) $$,
  'co-admin saves into the empty round 4');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and round_number = 4)::int, 1, 'the empty round row was reused (still one round 4)');
select is((select count(*) from public.scores s join public.rounds r on r.id = s.round_id where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.round_number = 4)::int, 2, 'two scores on round 4');

-- Edit round 3 (replace): old row retired to 1003+, new row takes number 3
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-30},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":30}]'::jsonb, true) $$,
  'edit round 3 replaces it');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and round_number = 3 and undone_at is null)::int, 1, 'exactly one live round 3 after edit');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and undone_at is not null and round_number % 1000 <> 2)::int, 2, 'the old round 3 is kept as an undone row (parked at 1000+) beside the seeded 1003');
select is((select sum(value) from public.scores s join public.rounds r on r.id = s.round_id where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.round_number = 3 and r.undone_at is null)::int, 0, 'the edited round balances to 0 with the new payload');

select * from finish();
rollback;
