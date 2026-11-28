-- 047 (PR 24): the re-entry and late-entry score rules. X24-7: a game without the keys keeps the 041
-- rule (the highest score still in); reentryPlus 1 starts a re-entry at that score + 1; lateEntryPlus 1
-- does the same for a pool late joiner; both keys may change mid-game and the Log says it in words.
-- Game S: sree (admin, seated) with harish, priya, zero; limit 60 so zero goes out fast; RK joins late.
begin;
select plan(25);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set S '''10000000-0000-4000-8000-0000000000e7'''

-- ---------- A. pool_entry_plus / entry_plus_text ----------
select has_function('public', 'pool_entry_plus', array['jsonb', 'text'], 'X24-7 pool_entry_plus exists');
select is(public.pool_entry_plus('{}'::jsonb, 'reentryPlus'), 0, 'no key: the 041 rule (highest score)');
select is(public.pool_entry_plus(null, 'reentryPlus'), 0, 'null settings: the 041 rule');
select is(public.pool_entry_plus('{"reentryPlus":1}'::jsonb, 'reentryPlus'), 1, 'reentryPlus 1 → + 1');
select is(public.pool_entry_plus('{"reentryPlus":0}'::jsonb, 'reentryPlus'), 0, 'reentryPlus 0 → highest score');
select is(public.pool_entry_plus('{"reentryPlus":true}'::jsonb, 'reentryPlus'), 1, 'a boolean true reads as + 1');
select is(public.pool_entry_plus('{"reentryPlus":1,"lateEntryPlus":0}'::jsonb, 'lateEntryPlus'), 0, 'each key is read on its own');
select is(public.entry_plus_text('1'::jsonb), 'Highest score + 1', 'the Log words for 1');
select is(public.entry_plus_text('0'::jsonb), 'Highest score', 'the Log words for 0');
select is(public.entry_plus_text(null), '—', 'the Log words for an absent key');

-- ---------- game S: limit 60, no entry keys (a pool saved before 047) ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:S, :SREE, 'active', 'pool',
        '{"gameType":"pool","poolLimit":60,"dropAmount":20,"mdAmount":40,"maxCount":80}', 'POOL47');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:S, :SREE, 0, 1, 'game_admin', true),
  (:S, :HARISH, 1, 2, 'player', true),
  (:S, :PRIYA, 2, 3, 'player', true),
  (:S, :ZERO, 3, 4, 'player', true);

select tests.login(:SREE);

-- round 1: zero 70 → out; sree 0, harish 10, priya 20
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000e7', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":70}]'::jsonb, false) $$, 'round 1');
select is((select out_round from public.game_players where game_id = :S and profile_id = :ZERO), 1, 'zero is out in round 1');

-- no key: the 041 rule — re-enter at the highest score still in (priya 20)
select is((public.reenter_player(:S, :ZERO))->>'score', '20', 'X24-7 no key: re-enters at the highest score still in (20)');
select is((select reentry_score from public.game_players where game_id = :S and profile_id = :ZERO), 20, '… and the seat carries 20');

-- the rule may change mid-game (only the pool limit is locked) and the Log says it in words
select lives_ok($$ update public.games set settings = settings || '{"reentryPlus":1,"lateEntryPlus":1}' where id = '10000000-0000-4000-8000-0000000000e7' $$,
  'X24-7 the entry rules may change mid-game');
select is((select summary from public.event_log where game_id = :S and kind = 'settings_changed' order by id desc limit 1),
  'Changed game settings · Late entry score —→Highest score + 1 · Re-entry score —→Highest score + 1', 'X24-7 the Log line says both rules in words');

-- round 2: zero 70 → out again; sree 0, harish 20, priya 40 (the highest still in)
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000e7', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":70}]'::jsonb, false) $$, 'round 2: zero out again');
select is((select out_round from public.game_players where game_id = :S and profile_id = :ZERO), 2, 'zero is out in round 2');

-- reentryPlus 1: re-enter at 40 + 1
select is((public.reenter_player(:S, :ZERO))->>'score', '41', 'X24-7 Highest + 1: re-enters at 41 (priya 40 + 1)');
select is((select reentry_score from public.game_players where game_id = :S and profile_id = :ZERO), 41, '… and the seat carries 41');
select is((select summary from public.event_log where game_id = :S and kind = 'player_reentered' order by id desc limit 1),
  'Zed Zero re-entered at 41 · Before round 3 · Entry 3 · Seat 4 → 3 (left of Harish Test)', 'X24-7 the Log says the start score, not the typed one (and since 056 / 057 the seat: harish deals round 3)');

-- lateEntryPlus 1: RK joins before round 3 at the highest score still in + 1 (zero 41 → 42)
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000000e7', '00000000-0000-4000-8000-0000000000a1', 'RK') $$, 'X24-7 RK joins mid-pool');
select is((select reentry_score from public.game_players where game_id = :S and profile_id = :RK), 42, 'X24-7 late entry at Highest + 1 (zero 41 + 1 = 42)');
select is((select reentered_round from public.game_players where game_id = :S and profile_id = :RK), 3, '… from round 3');

-- back to the 041 rule for late entry only: a second late joiner would start at the plain highest
update public.games set settings = settings || '{"lateEntryPlus":0}' where id = :S;
select is((select summary from public.event_log where game_id = :S and kind = 'settings_changed' order by id desc limit 1),
  'Changed game settings · Late entry score Highest score + 1→Highest score', 'X24-7 switching back is logged in words');

select tests.logout();
select * from finish();
rollback;
