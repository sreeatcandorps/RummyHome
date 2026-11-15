-- 042 (PR 13 follow-up): re-entries as a setting (Unlimited / Limited N, 041 boolean still read),
-- only the pool limit locked once rounds exist, labelled settings Log line.
-- Game R: sree (admin, seated) with harish, priya, zero; limit 60 so players go out fast.
begin;
select plan(26);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set R '''10000000-0000-4000-8000-0000000000e2'''

-- ---------- pool_reentry_limit ----------
select has_function('public', 'pool_reentry_limit', array['jsonb']);
select is(public.pool_reentry_limit('{}'::jsonb), null, 'no key: unlimited (null)');
select is(public.pool_reentry_limit('{"reentryLimit":null}'::jsonb), null, 'explicit null: unlimited');
select is(public.pool_reentry_limit('{"reentryLimit":2}'::jsonb), 2, 'limited to 2');
select is(public.pool_reentry_limit('{"reentryLimit":0}'::jsonb), 0, 'limited to 0 = none');
select is(public.pool_reentry_limit('{"reentryLimit":-3}'::jsonb), 0, 'a negative number reads as none');
select is(public.pool_reentry_limit('{"reentry":false}'::jsonb), 0, '041 reentry:false reads as none');
select is(public.pool_reentry_limit('{"reentry":true}'::jsonb), null, '041 reentry:true reads as unlimited');
select is(public.pool_reentry_limit('{"reentry":false,"reentryLimit":3}'::jsonb), 3, 'the new key wins over the old one');

-- ---------- game R: limit 60, unlimited re-entries ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:R, :SREE, 'active', 'pool',
        '{"gameType":"pool","poolLimit":60,"dropAmount":20,"mdAmount":40,"maxCount":80}', 'POOL42');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:R, :SREE, 0, 1, 'game_admin', true),
  (:R, :HARISH, 1, 2, 'player', true),
  (:R, :PRIYA, 2, 3, 'player', true),
  (:R, :ZERO, 3, 4, 'player', true);

select tests.login(:SREE);

-- round 1: zero 70 → out
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000e2', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":70}]'::jsonb, false) $$, 'round 1');
select is((select out_round from public.game_players where game_id = :R and profile_id = :ZERO), 1, 'zero is out in round 1');

-- only the pool limit is locked (042 B)
select throws_ok($$ update public.games set settings = settings || '{"poolLimit":101}' where id = '10000000-0000-4000-8000-0000000000e2' $$,
  'PT423', null, 'the pool limit is locked once a round exists');
select lives_ok($$ update public.games set settings = settings || '{"dropAmount":25,"mdAmount":50,"maxCount":130}' where id = '10000000-0000-4000-8000-0000000000e2' $$,
  'Drop, Middle drop and Full count may change mid-game');
select is((select summary from public.event_log where game_id = :R and kind = 'settings_changed' order by id desc limit 1),
  'Changed game settings · Drop 20→25 · Full count 80→130 · Middle drop 40→50', 'the Log line names each value');
select is((select level::text from public.event_log where game_id = :R and kind = 'settings_changed' order by id desc limit 1), 'important', 'important once rounds exist');

-- unlimited: zero re-enters, goes out, re-enters again
select is((public.reenter_player(:R, :ZERO))->>'entries', '2', 'first re-entry (unlimited)');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000e2', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":70}]'::jsonb, false) $$, 'round 2: zero out again');
select is((public.reenter_player(:R, :ZERO))->>'entries', '3', 'second re-entry is allowed with Unlimited');

-- switching to Limited 2 mid-game: zero has used 2, so a third is refused; the Log labels the key
select lives_ok($$ update public.games set settings = settings || '{"reentryLimit":2}' where id = '10000000-0000-4000-8000-0000000000e2' $$, 'Re-entries may change mid-game');
select is((select summary from public.event_log where game_id = :R and kind = 'settings_changed' order by id desc limit 1),
  'Changed game settings · Re-entries —→2', 'the Log line says Re-entries');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000e2', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":70}]'::jsonb, false) $$, 'round 3: zero out a third time');
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000008') $$,
  'P0001', 'They have used all 2 re-entries.', 'Limited 2: a third re-entry is refused');

-- Limited 0 = none
update public.games set settings = settings || '{"reentryLimit":0}' where id = :R;
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000008') $$,
  'P0001', 'Re-entries are off for this pool. Allow them in Game settings first.', 'Limited 0 refuses every re-entry');

-- Limited 3 lets the third one through, at the highest score still in (sree 0, harish 30, priya 40 → 40)
update public.games set settings = settings || '{"reentryLimit":3}' where id = :R;
select is((public.reenter_player(:R, :ZERO))->>'score', '40', 'Limited 3: third re-entry at the highest score in');
select is((select entries from public.game_players where game_id = :R and profile_id = :ZERO), 4, 'four entries on the seat');

-- a player who is not out is still refused whatever the setting
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000002') $$,
  'P0001', 'They are still in the pool.', 'still in: refused');

select tests.logout();
select * from finish();
rollback;
