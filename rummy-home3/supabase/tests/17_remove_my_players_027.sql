-- 027 Remove from My Players: a soft remove (removed_at) that hides the row, frees the
-- initials and is refused while the player sits in a live game the owner can see. Undo,
-- Add player (by ID or name) and playing together again all bring the row back with its
-- history; the old initials return when still free.
-- Seed: sree (…0001) knows harish HT, priya PT, zero ZZ, rk RK, cd CD; game A (sree's, active)
-- seats harish, priya, rk, zero; game C (sree's, closed) seats harish, zero, cd.
-- harish (…0002) knows priya PT and ab AB; ab sits in no game.
begin;
select plan(45);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set E '''10000000-0000-4000-8000-00000000000e'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set AB '''00000000-0000-4000-8000-0000000000a2'''
\set CD '''00000000-0000-4000-8000-0000000000a3'''
\set CHITRA '''00000000-0000-4000-8000-0000000000a7'''

-- ---------- objects and grants ----------
select has_column('public', 'my_players', 'removed_at', 'my_players.removed_at exists');
select has_function('public', 'restore_my_player', array['uuid']);
select has_function('public', 'in_live_game_with_me', array['uuid']);
select has_trigger('public', 'my_players', 'my_players_restore_initials', 'restore re-checks the initials');
select ok(has_function_privilege('authenticated', 'public.restore_my_player(uuid)', 'execute'), 'signed-in users can call restore_my_player');
select ok(not has_function_privilege('anon', 'public.restore_my_player(uuid)', 'execute'), 'anon cannot call restore_my_player');
select ok(not has_function_privilege('authenticated', 'public.in_live_game_with_me(uuid)', 'execute'), 'in_live_game_with_me is internal');
select ok((select indpred is not null from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'my_players_owner_initials_key'),
          'the per-owner initials index covers active rows only');
select ok((select indisunique from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'my_players_owner_initials_key'),
          'and is still unique');

-- ---------- setup: an outsider's live game with cd seated, which sree cannot see ----------
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
values (:CHITRA, 'Chitra Devi', 'Chitra', 'Devi', 'unregistered', :SREE, 'CHD007');
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
values (:E, :OUTSIDER, 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEE1', now() - interval '1 hour');
insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  (:E, :OUTSIDER, 0, 'game_admin', true),
  (:E, :CD, 1, 'player', true);
insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by)
values ('30000000-0000-4000-8000-0000000000c1', :C, 1, :HARISH, :SREE);
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000c1', :C, :HARISH, 'count', -40),
  ('30000000-0000-4000-8000-0000000000c1', :C, :CD, 'rummy', 40);

select tests.anon();
select throws_like($$ select public.remove_my_player('00000000-0000-4000-8000-0000000000a3') $$, 'Sign in required', 'anon cannot remove');
select tests.logout();

-- ---------- sree: blocked while in a live game sree can see ----------
select tests.login(:SREE);
select throws_like($$ select public.remove_my_player('00000000-0000-4000-8000-000000000002') $$,
                   'In a live game. Remove them after the game ends.', 'harish is seated in live game A: refused with the exact message');
select throws_like($$ select public.remove_my_player('00000000-0000-4000-8000-0000000000a1') $$,
                   'In a live game. Remove them after the game ends.', 'rk (unregistered, seated in A) is refused too');
select throws_like($$ select public.remove_my_player('00000000-0000-4000-8000-000000000001') $$,
                   '%always in your own list%', 'you cannot remove yourself');
select is((select count(*) from public.my_players where owner_id = :SREE and removed_at is not null), 0::bigint, 'nothing was removed by the refused calls');

-- ---------- sree removes cd: closed game C and an invisible live game E do not block ----------
select lives_ok($$ select public.remove_my_player('00000000-0000-4000-8000-0000000000a3') $$, 'cd (closed C, outsider''s live E) can be removed');
select ok((select removed_at is not null from public.my_players where owner_id = :SREE and player_id = :CD), 'the row stays, flagged removed_at (soft remove)');
select is((select games_together from public.my_players where owner_id = :SREE and player_id = :CD), 1, 'games_together is kept');
select is((select initials from public.my_players where owner_id = :SREE and player_id = :CD), 'CD', 'the old initials stay on the row as a hint');
select is((select count(*) from public.list_my_players()), 4::bigint, 'list_my_players no longer shows cd');
select ok(not exists (select 1 from public.list_my_players() where id = :CD), 'cd is not in the list');
select ok(not exists (select 1 from public.list_new_game_candidates() where id = :CD), 'cd is not offered in the Start game picker either');
select lives_ok($$ select public.remove_my_player('00000000-0000-4000-8000-0000000000a3') $$, 'a second remove is a no-op');

-- history untouched
select is((select label from public.game_players where game_id = :C and profile_id = :CD), 'CD', 'the seat label in closed game C is unchanged');
select is((select sum(value)::int from public.scores where game_id = :C and profile_id = :CD), 40, 'scores in C are untouched');
select is((select player_status from public.profiles where id = :CD), 'unregistered', 'their account is untouched');
select tests.logout();
select is((select count(*) from public.my_players where owner_id <> :SREE), 2::bigint, 'other people''s lists are untouched');
select is((select count(*) from public.creator_notices) + (select count(*) from public.email_outbox), 0::bigint, 'nobody is notified');
select tests.login(:SREE);

-- the freed initials go to the next player
select tests.logout();
select is(public.default_initials(:SREE, 'Chitra Devi'), 'CD', 'CD is free again for sree');
select tests.login(:SREE);
select lives_ok($$ select public.add_my_player('00000000-0000-4000-8000-0000000000a7') $$, 'sree adds Chitra Devi');
select is((select initials from public.my_players where owner_id = :SREE and player_id = :CHITRA), 'CD', 'Chitra takes CD');

-- undo / re-add: history comes back, clash rule picks fresh initials
select lives_ok($$ select public.restore_my_player('00000000-0000-4000-8000-0000000000a3') $$, 'Undo restores cd');
select ok((select removed_at is null from public.my_players where owner_id = :SREE and player_id = :CD), 'removed_at cleared');
select is((select games_together from public.my_players where owner_id = :SREE and player_id = :CD), 1, 'games_together came back with the row');
select isnt((select initials from public.my_players where owner_id = :SREE and player_id = :CD), 'CD', 'CD is taken, so cd gets the next candidate');
select is((select count(distinct initials) from public.my_players where owner_id = :SREE and removed_at is null),
          (select count(*) from public.my_players where owner_id = :SREE and removed_at is null), 'initials stay unique among sree''s active rows');
select is((select count(*) from public.list_my_players()), 6::bigint, 'list shows cd and Chitra');
select throws_like($$ select public.restore_my_player('00000000-0000-4000-8000-000000000005') $$, '%not in your My players%', 'restoring someone never added is refused');
select tests.logout();

-- ---------- harish: remove ab, re-add by ID keeps initials, playing together restores too ----------
select tests.login(:HARISH);
select throws_like($$ select public.remove_my_player('00000000-0000-4000-8000-000000000003') $$,
                   'In a live game. Remove them after the game ends.', 'harish sees A as a player: priya is refused');
select lives_ok($$ select public.remove_my_player('00000000-0000-4000-8000-0000000000a2') $$, 'ab (no game) removed');
select is((select count(*) from public.list_my_players()), 1::bigint, 'harish''s list is down to priya');
select lives_ok($$ select public.add_my_player('00000000-0000-4000-8000-0000000000a2') $$, 'Add player by ID brings ab back');
select is((select initials || ':' || games_together::text from public.my_players where owner_id = :HARISH and player_id = :AB), 'AB:1', 'ab returns with AB and the old games_together');
select lives_ok($$ select public.remove_my_player('00000000-0000-4000-8000-0000000000a2') $$, 'removed again');
select lives_ok($$ select public.touch_my_players(array['00000000-0000-4000-8000-0000000000a2'::uuid]) $$, 'a game together');
select is((select (removed_at is null)::text || ':' || games_together::text from public.my_players where owner_id = :HARISH and player_id = :AB), 'true:2', 'playing together restores the row and counts the game');
select tests.logout();

select * from finish();
rollback;
