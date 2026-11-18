-- 040 (PR 10b): the account holder's own initials live on profiles.initials, set through
-- set_my_initials; the creator's own seat takes them when free in that game. repair_round_gaps
-- renumbers live rounds 1..N for games whose pre-035 undo left a hole, and is a no-op otherwise.
-- Seed: sree (…0001) knows Harish Test as HT; Game A is sree's with live rounds 1 and 2 only.
begin;
select plan(34);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set GAME_A '''10000000-0000-4000-8000-00000000000a'''
\set GAME_G '''10000000-0000-4000-8000-0000000000f4'''
\set GAME_H '''10000000-0000-4000-8000-0000000000f5'''

-- ---------- shape ----------
select has_column('public', 'profiles', 'initials', 'profiles.initials exists');
select col_type_is('public', 'profiles', 'initials', 'text', 'it is text');
select ok(has_column_privilege('authenticated', 'public.profiles', 'initials', 'select'), 'signed-in users may read the column');
select has_column('public', 'my_profile', 'initials', 'my_profile carries the new column (view re-created)');
select has_function('public', 'set_my_initials', array['text']);
select ok(has_function_privilege('authenticated', 'public.set_my_initials(text)', 'execute'), 'signed-in users may set their initials');
select ok(not has_function_privilege('anon', 'public.set_my_initials(text)', 'execute'), 'anon may not');
select has_function('public', 'repair_round_gaps', array['uuid']);
select ok(not has_function_privilege('authenticated', 'public.repair_round_gaps(uuid)', 'execute'), 'the repair is not callable from the app');
select throws_ok($$ update public.profiles set initials = '2sk' where id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'the check refuses a leading digit');

-- ---------- set_my_initials ----------
select throws_ok($$ select public.set_my_initials('SK') $$, 'P0001', 'Sign in required', 'signed out: refused');

select tests.login(:SREE);
select is(public.set_my_initials(' s k '), 'SK', 'spaces dropped, upper-cased, stored');
select is((select initials from public.profiles where id = :SREE), 'SK', 'the profile carries SK');
select is((select initials from public.my_profile where id = :SREE), 'SK', 'my_profile shows it to the owner');
select is(public.set_my_initials('sk2'), 'SK2', 'a digit after the letter is fine');
select throws_ok($$ select public.set_my_initials('HT') $$, 'P0001', 'HT is already used for Harish Test in your My players.', 'a label one of your My players has is refused');
select throws_ok($$ select public.set_my_initials('2SK') $$, 'P0001', 'Initials are 2 or 3 characters: a letter, then letters or digits.', 'a leading digit is refused');
select throws_ok($$ select public.set_my_initials('SKOR') $$, 'P0001', 'Initials are 2 or 3 characters: a letter, then letters or digits.', 'four characters are refused');
select is(public.set_my_initials(''), null, 'empty clears');
select is((select initials from public.profiles where id = :SREE), null, 'cleared on the row');
select is(public.set_my_initials('SK'), 'SK', 'set again for the seat test');
select tests.logout();

-- ---------- the creator's own seat ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:GAME_G, :SREE, 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}', 'GAMEG1');
insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  (:GAME_G, :SREE, 0, 'game_admin', true),
  (:GAME_G, :HARISH, 1, 'player', true);
select is((select label from public.game_players where game_id = :GAME_G and profile_id = :SREE), 'SK', 'the creator''s seat takes their profile initials');
select is((select label from public.game_players where game_id = :GAME_G and profile_id = :HARISH), 'HT', 'other seats still take the creator''s My players initials');

-- A second game where SK is already a column: the creator falls back to a form of their name.
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:GAME_H, :SREE, 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}', 'GAMEH1');
insert into public.game_players (game_id, profile_id, player_order, role, seated, label) values (:GAME_H, :PRIYA, 0, 'player', true, 'SK');
insert into public.game_players (game_id, profile_id, player_order, role, seated) values (:GAME_H, :SREE, 1, 'game_admin', true);
select isnt((select label from public.game_players where game_id = :GAME_H and profile_id = :SREE), 'SK', 'a clash in the game falls back to the name');
select is((select label from public.game_players where game_id = :GAME_H and profile_id = :SREE), (public.initials_candidates((select display_name from public.profiles where id = :SREE)))[1], 'the first free candidate of the name');

-- ---------- repair_round_gaps ----------
-- Game G: rounds 1, 2, 4, 5 live (a pre-035 undo gap at 3), current_round 6, plus an undone row parked at 1003.
insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values
  (:GAME_G, 1, :SREE, :SREE), (:GAME_G, 2, :HARISH, :SREE), (:GAME_G, 4, :SREE, :SREE), (:GAME_G, 5, :HARISH, :SREE);
insert into public.rounds (game_id, round_number, dealer_profile_id, created_by, undone_at, undone_by, undo_reason)
values (:GAME_G, 1003, :SREE, :SREE, now(), :SREE, 'old undo');
update public.games set current_round = 6 where id = :GAME_G;

select is(public.repair_round_gaps(:GAME_G), 1, 'one game repaired');
select is((select array_agg(round_number order by round_number) from public.rounds where game_id = :GAME_G and undone_at is null), array[1, 2, 3, 4], 'live rounds are 1..4 again');
select is((select round_number from public.rounds where game_id = :GAME_G and undone_at is not null), 1003, 'the undone row is untouched');
select is((select current_round from public.games where id = :GAME_G), 5, 'current_round follows (next round is 5)');
select is(public.repair_round_gaps(:GAME_G), 0, 'a second run finds nothing');
select is(public.repair_round_gaps(null), 0, 'no other seeded game has a gap (Game A: live 1 and 2)');
select is((select array_agg(round_number order by round_number) from public.rounds where game_id = :GAME_A and undone_at is null), array[1, 2], 'Game A untouched');
select is((select current_round from public.games where id = :GAME_A), 3, 'Game A current_round untouched');

-- The dealer of the renumbered round keeps its row (only the number moved).
select is((select dealer_profile_id from public.rounds where game_id = :GAME_G and round_number = 3 and undone_at is null), :SREE::uuid, 'old round 4 is now round 3 with its dealer');

select * from finish();
rollback;
