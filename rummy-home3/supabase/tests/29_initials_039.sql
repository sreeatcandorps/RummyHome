-- 039 (PR 6, D6 as Sree decided): initials are any free 2–3 characters whose FIRST character
-- is a letter; digits may follow (SK2). Add new players by initials makes a player whose name
-- is the stored initials; on a clash the first free digit form is stored and the holder of
-- the typed form is named. The editors accept the same rule; a player named by initials is
-- renamed when their initials change.
-- Seed: sree (…0001) knows Harish Test (HT), Priya Test, Zed Zero, R K, C D; Game A is sree's
-- with harish seated.
begin;
select plan(55);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set GAME_A '''10000000-0000-4000-8000-00000000000a'''

-- ---------- shape ----------
select has_function('public', 'pick_free_initials', array['text', 'text[]']);
select has_function('public', 'create_player_by_initials', array['text']);
select ok(has_function_privilege('authenticated', 'public.create_player_by_initials(text)', 'execute'), 'signed-in users may add players by initials');
select ok(not has_function_privilege('anon', 'public.create_player_by_initials(text)', 'execute'), 'anon may not');
select ok((select prosrc like '%[A-Z][A-Z0-9]{1,2}%' from pg_proc where proname = 'set_my_player_initials' and pronamespace = 'public'::regnamespace), '039: set_my_player_initials accepts a trailing digit');
select ok((select prosrc like '%[A-Z][A-Z0-9]{1,2}%' from pg_proc where proname = 'set_seat_label' and pronamespace = 'public'::regnamespace), '039: set_seat_label accepts a trailing digit');

-- ---------- the shared table: same rows as tests/initials-pr6.test.ts ----------
create temp table initials_cases (typed text, taken text, expected text, note text);
\copy initials_cases from 'rummy-home3/supabase/tests/fixtures/initials-cases.csv' with (format csv, header true)
select is((select count(*) from initials_cases)::int, 13, 'fixture has 13 rows');
select is(public.pick_free_initials(typed, string_to_array(coalesce(taken, ''), ';')), expected, 'pick_free_initials: ' || note) from initials_cases;

-- ---------- add by initials ----------
select throws_ok($$ select * from public.create_player_by_initials('XY') $$, 'P0001', 'Sign in required', 'signed out: refused');

select tests.login(:SREE);
create temp table made_ht as select * from public.create_player_by_initials('HT');
select is((select initials from made_ht), 'HT2', 'HT is Harish Test''s, so the new player is HT2');
select is((select taken_by from made_ht), 'Harish Test', 'taken_by names who holds the typed letters');
select is((select display_name from made_ht), 'HT2', 'D6.2: the name is the stored initials');
select is((select first_name from made_ht), 'HT2', 'first_name carries the same');
select is((select last_name from made_ht), null, 'no last name');
select is((select player_status from made_ht), 'unregistered', 'an unregistered player');
select is((select managed_by from made_ht), :SREE::uuid, 'managed by the caller');
select ok((select player_code is not null from made_ht), 'a player code was issued');
select is((select m.initials from public.my_players m where m.owner_id = :SREE and m.player_id = (select id from made_ht)), 'HT2', 'the My players row carries HT2');
select is((select initials from public.list_my_players() where id = (select id from made_ht)), 'HT2', 'list_my_players agrees');

create temp table made_ht_again as select * from public.create_player_by_initials('HT');
select is((select initials from made_ht_again), 'HT3', 'HT and HT2 held: the next is HT3');
select is((select taken_by from made_ht_again), 'Harish Test', 'still names the holder of HT');

create temp table made_xy as select * from public.create_player_by_initials('xy');
select is((select initials from made_xy), 'XY', 'free letters are stored as typed, upper-cased');
select is((select taken_by from made_xy), null, 'no clash, nobody named');
select is((select display_name from made_xy), 'XY', 'named XY');

create temp table made_sk2 as select * from public.create_player_by_initials('SK2');
select is((select initials from made_sk2), 'SK2', 'a digit may be typed when the first character is a letter');

select throws_ok($$ select * from public.create_player_by_initials('4K') $$, 'P0001', 'The first character must be a letter, A to Z.', '4K refused');
select throws_ok($$ select * from public.create_player_by_initials('S') $$, 'P0001', 'Type at least 2 characters.', 'S refused');
select throws_ok($$ select * from public.create_player_by_initials('SK45') $$, 'P0001', 'Up to 3 characters.', 'SK45 refused');
select throws_ok($$ select * from public.create_player_by_initials('S-K') $$, 'P0001', 'Letters and digits only.', 'S-K refused');
select throws_ok($$ select * from public.create_player_by_initials('') $$, 'P0001', 'Type 2 or 3 characters.', 'empty refused');

-- ---------- editors ----------
select is(public.set_my_player_initials((select id from made_xy), 'xyz'), 'XYZ', 'the owner types three letters');
select is((select display_name from public.profiles where id = (select id from made_xy)), 'XYZ', 'a player named by initials is renamed with them');
select is(public.set_my_player_initials((select id from made_xy), 'XY2'), 'XY2', 'a digit after the letters is accepted');
select is((select display_name from public.profiles where id = (select id from made_xy)), 'XY2', 'the name follows again');
select is(public.set_my_player_initials(:HARISH, 'HT9'), 'HT9', 'Harish may be HT9');
select is((select display_name from public.profiles where id = :HARISH), 'Harish Test', 'a player with a real name keeps it');
select throws_ok($$ select public.set_my_player_initials('00000000-0000-4000-8000-000000000002', '2SK') $$,
  'P0001', 'Initials are 2 or 3 characters: a letter, then letters or digits.', 'a leading digit is refused');
select throws_ok($$ select public.set_my_player_initials('00000000-0000-4000-8000-000000000002', 'SKOR') $$,
  'P0001', 'Initials are 2 or 3 characters: a letter, then letters or digits.', 'four characters are refused');
select throws_ok($$ select public.set_my_player_initials((select id from made_xy), 'HT9') $$,
  'P0001', 'HT9 is already used for Harish Test in your My players.', 'a clash names the other player');

select is(public.set_seat_label(:GAME_A, :HARISH, 'h2'), 'H2', 'a game admin types a label with a digit');
select is((select label from public.game_players where game_id = :GAME_A and profile_id = :HARISH), 'H2', 'the seat carries it');
select is((select m.initials from public.my_players m where m.owner_id = :SREE and m.player_id = :HARISH), 'H2', 'the creator''s My players entry follows');
select throws_ok($$ select public.set_seat_label('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', '2H') $$,
  'P0001', 'Initials are 2 or 3 characters: a letter, then letters or digits.', 'a seat label must start with a letter');
select tests.logout();

select * from finish();
rollback;
