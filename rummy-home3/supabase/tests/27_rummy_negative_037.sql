-- 037 (PR 3): a Rummy share may be negative. When the other players add up to a plus, the
-- Rummy winner's share is minus that amount so the round still totals 0; before 037 the scores
-- check constraint refused the row and the round could not be saved.
begin;
select plan(9);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set SREE '''00000000-0000-4000-8000-000000000001'''

-- ---------- shape ----------
select ok((select pg_get_constraintdef(oid) not like '%value >= 0%' from pg_constraint where conname = 'scores_check' and conrelid = 'public.scores'::regclass),
  'scores_check no longer insists a rummy row be >= 0');
select ok((select pg_get_constraintdef(oid) like '%value <= 0%' from pg_constraint where conname = 'scores_check' and conrelid = 'public.scores'::regclass),
  'drop / middle drop / count / expense are still <= 0');
select ok((select convalidated from pg_constraint where conname = 'scores_check' and conrelid = 'public.scores'::regclass), 'the constraint is validated');

-- ---------- 3.2 a positive pot: +50 typed, one drop, the Rummy share is -40 ----------
select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":50},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"drop","value":-10},
    {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"count","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"rummy","value":-40}]'::jsonb, false) $$,
  '3.2 a round whose Rummy share is -40 saves');
select is((select s.value from public.scores s join public.rounds r on r.id = s.round_id
            where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.round_number = 3 and r.undone_at is null
              and s.profile_id = '00000000-0000-4000-8000-000000000008'), -40, 'the negative Rummy share is stored as typed');
select is((select sum(s.value)::integer from public.scores s join public.rounds r on r.id = s.round_id
            where r.game_id = '10000000-0000-4000-8000-00000000000a' and r.round_number = 3 and r.undone_at is null), 0, 'the round totals 0');

-- ---------- 3.4 two winners share a positive pot: +31 → -16 / -15 ----------
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 4,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":31},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":-16},
    {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"rummy","value":-15},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":0}]'::jsonb, false) $$,
  '3.4 two negative Rummy shares save');

-- ---------- the other rules are untouched ----------
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 5,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"drop","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":-10}]'::jsonb, false) $$,
  '23514', null, 'a positive drop is still refused by the check constraint');
select is((select count(*)::integer from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and round_number = 5), 0, 'nothing was written for the refused round');

select tests.logout();
select * from finish();
rollback;
