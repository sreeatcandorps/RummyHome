-- 035 undo then add round (PR 2): live rounds are unique per number, undone rows are not part
-- of the key; undo_last_round is one locked server step that moves current_round back; the
-- round that was undone can be saved again at the same number; save_round's conflict message
-- names the admin who saved first.
-- Game A has live rounds 1 and 2 (current_round 3), an undone round parked at 1003 and an undone
-- round still at number 2 beside the live one (allowed since 035).
begin;
select plan(30);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''

-- ---------- shape ----------
select hasnt_index('public', 'rounds', 'rounds_game_id_round_number_key', 'the full unique key on (game_id, round_number) is gone');
select has_index('public', 'rounds', 'rounds_live_number_uidx', 'the live-rounds partial unique index exists');
select ok((select indpred is not null from pg_index where indexrelid = 'public.rounds_live_number_uidx'::regclass), 'the index is partial (undone_at is null)');
select has_function('public', 'undo_last_round', array['uuid']);
select ok(has_function_privilege('authenticated', 'public.undo_last_round(uuid)', 'execute'), 'signed-in users may call undo_last_round (the function checks admin)');
select ok(not has_function_privilege('anon', 'public.undo_last_round(uuid)', 'execute'), 'anon cannot');

-- (the rollback replay that runs before pgTAP in CI may have parked the seeded row at 1002; either place is fine)
select is((select round_number % 1000 from public.rounds where id = '30000000-0000-4000-8000-0000000000a4' and undone_at is not null), 2, 'seed: the undone first round 2 is kept (at 2 or parked at 1002)');

-- ---------- who may undo ----------
select tests.login(:PRIYA);
select throws_ok($$ select public.undo_last_round('10000000-0000-4000-8000-00000000000a') $$, '42501', 'Only a game admin can undo a round.', 'a seated player cannot undo');
select tests.login('00000000-0000-4000-8000-000000000005');
select throws_ok($$ select public.undo_last_round('10000000-0000-4000-8000-00000000000a') $$, '42501', 'Only a game admin can undo a round.', 'an outsider cannot undo');

-- ---------- 2.1 save round 3, undo, save round 3 again ----------
select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"count","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"rummy","value":30}]'::jsonb, false) $$, '2.1 round 3 saved');
select is((select current_round from public.games where id = :A), 4, '2.1 current_round is 4');
select is((public.undo_last_round(:A))->>'roundNumber', '3', '2.1 undo returns round 3');
select is((select current_round from public.games where id = :A), 3, '2.1 current_round moved back to 3');
select is((select count(*)::int from public.rounds where game_id = :A and undone_at is null), 2, '2.1 two live rounds remain');
select is((select count(*)::int from public.rounds where game_id = :A and round_number = 3 and undone_at is not null), 1, '2.1 the undone row still sits at 3 (no renumbering needed)');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":60},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":-20}]'::jsonb, false) $$, '2.1 round 3 saves again after the undo (the bug)');
select is((select count(*)::int from public.rounds where game_id = :A and round_number = 3 and undone_at is null), 1, '2.1 exactly one live round 3');
select is((select value from public.scores s join public.rounds r on r.id = s.round_id where r.game_id = :A and r.round_number = 3 and r.undone_at is null and s.profile_id = :HARISH), 60, '2.1 the new scores are the live ones');
select is((select current_round from public.games where id = :A), 4, '2.1 current_round is 4 again');
select is((select count(*)::int from public.rounds where game_id = :A and undone_at is not null), 3, '2.1 the undone round 3 is kept (parked in the 1000+ range) beside the two seeded undone rows');

-- ---------- 2.5 a save for a number past the last live round (the other admin undid one) ----------
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 5,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":10}]'::jsonb, false) $$,
  'PT409', 'A round was undone while you were scoring. The scorecard has been refreshed; check the round number and save again.', '2.5 round 5 after live rounds 1-3 is refused with the refresh message');
select is((select count(*)::int from public.rounds where game_id = :A and round_number = 5), 0, '2.5 nothing was written');

-- ---------- conflict names the saver ----------
select tests.login('00000000-0000-4000-8000-000000000006');  -- coadmin
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-99}]'::jsonb, false) $$,
  'PT409', 'Round 3 was just saved by Sree Test. Check the scorecard before you save again.', 'a different payload for a saved round names who saved it');

-- ---------- 2.3 undo three times, then save round 1 ----------
select tests.login(:SREE);
select is((public.undo_last_round(:A))->>'roundNumber', '3', '2.3 undo 3');
select is((public.undo_last_round(:A))->>'roundNumber', '2', '2.3 undo 2');
select is((public.undo_last_round(:A))->>'roundNumber', '1', '2.3 undo 1');
select is(public.undo_last_round(:A), null::jsonb, '2.3 nothing left to undo returns null');
select is((select current_round from public.games where id = :A), 1, '2.3 current_round is 1 (2.2: header shows Round 1)');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":10}]'::jsonb, false) $$, '2.3 round 1 saves after three undos');
select is((select count(*)::int from public.rounds where game_id = :A and undone_at is not null), 6, '2.3 every undone row is kept (3 undos + the re-saved 3 + the two seeded)');

select * from finish();
rollback;
