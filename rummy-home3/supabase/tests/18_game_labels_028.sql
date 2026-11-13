-- 028 game labels: S<n> for Points games, P<n> for Pool games; the lowest number not used by
-- a live or completed (not closed, not deleted) game of that prefix in the creator's circle
-- (creator + My players, created by or seated). Assigned at insert under a lock, backfilled in
-- creation order, never changed. Readers carry the label; the link-conflict sentence is new.
-- Seed: C (sree, closed, 10 days ago), B (harish, closed, 5 days ago), A (sree, active, 2 days
-- ago; harish, priya, rk, zero seated). Sree knows harish, priya, zero, rk, cd; harish knows
-- priya and ab. Outsider (…0005) knows nobody.
begin;
select plan(54);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set B '''10000000-0000-4000-8000-00000000000b'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set STAKE '''{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}'''
\set POOL '''{"gameType":"pool","expenseEnabled":false,"expenseAmount":0,"poolDrop":-25,"poolMiddleDrop":-50,"maxCount":-80,"poolAmount":100}'''

-- ---------- objects ----------
select has_column('public', 'games', 'game_label', 'games.game_label exists');
select has_column('public', 'player_links', 'game_labels', 'player_links.game_labels exists');
select has_function('public', 'next_game_number', array['uuid', 'text']);
select has_function('public', 'game_labels_for', array['uuid']);
select has_function('public', 'game_label_text', array['text', 'integer']);
select has_trigger('public', 'games', 'games_assign_number', 'labels are assigned on insert');
select has_trigger('public', 'games', 'games_lock_label', 'labels are locked');
select has_trigger('public', 'player_links', 'player_links_fill_labels', 'link rows get labels');
select ok(not has_function_privilege('authenticated', 'public.next_game_number(uuid, text)', 'execute'), 'next_game_number is internal');
select is(public.game_label_prefix('stake'), 'S', 'Points games are S');
select is(public.game_label_prefix('pool'), 'P', 'Pool games are P');
select is(public.game_label_text(null, 7), 'G7', 'a never-backfilled row still reads as G7');
select is(public.game_label_text('S3', 3), 'S3', 'the stored label wins');

-- ---------- backfill ----------
select is((select count(*) from public.games where game_label is null), 0::bigint, 'every seeded game has a label');
select is((select game_label from public.games where id = :C), 'S1', 'C (oldest) is S1');
select is((select game_label from public.games where id = :B), 'S1', 'B is S1 too: C is closed so it does not block');
select is((select game_label from public.games where id = :A), 'S1', 'A is S1: B and C are closed');
select is((select game_number from public.games where id = :A), 1, 'game_number carries the numeric part for the old app');

-- ---------- assignment at creation ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000d0', :SREE, 'active', 'stake', :STAKE::jsonb, 'GAMED0');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000d0'), 'S2', 'sree''s next Points game is S2 (A holds S1)');
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000e0', :SREE, 'active', 'pool', :POOL::jsonb, 'GAMEE0');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000e0'), 'P1', 'a Pool game starts its own series: P1');
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000e1', :SREE, 'active', 'pool', :POOL::jsonb, 'GAMEE1');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000e1'), 'P2', 'second Pool game is P2');

-- circle: the outsider knows nobody and sits nowhere, so S1 is free for them
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000f0', :OUTSIDER, 'active', 'stake', :STAKE::jsonb, 'GAMEF0');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000f0'), 'S1', 'the outsider''s first game is S1: another circle, numbers do not collide across circles');

-- circle: harish knows priya, who is seated in live A (S1), so harish''s game skips S1
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000f1', :HARISH, 'active', 'stake', :STAKE::jsonb, 'GAMEF1');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000f1'), 'S2', 'harish gets S2: a My players member sits in live S1');

-- 038: a completed game frees its number, but harish (in sree's list) holds S2 live (f1); closed frees; deleted frees
update public.games set status = 'completed', completed_at = now() where id = '10000000-0000-4000-8000-0000000000d0';
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000d1', :SREE, 'active', 'stake', :STAKE::jsonb, 'GAMED1');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000d1'), 'S3', 'd0 (completed) no longer holds S2 (038), but harish''s live f1 is S2, so the next is S3');
update public.games set closed_at = now() where id = '10000000-0000-4000-8000-0000000000d0';
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000d2', :SREE, 'active', 'stake', :STAKE::jsonb, 'GAMED2');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000d2'), 'S4', 'once d0 is closed its S2 is free, but harish (in sree''s list) holds S2 live, so sree gets S4');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000d0'), 'S2', 'the closed game keeps its own S2');
update public.games set deleted_at = now(), deleted_by = :SREE where id = '10000000-0000-4000-8000-0000000000d1';
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000d3', :SREE, 'active', 'stake', :STAKE::jsonb, 'GAMED3');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000d3'), 'S3', 'a deleted game frees its number: S3 is reused');
update public.games set closed_at = now() where id = '10000000-0000-4000-8000-0000000000f1';
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000d4', :SREE, 'active', 'stake', :STAKE::jsonb, 'GAMED4');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000d4'), 'S2', 'once harish''s S2 is closed too, S2 is reused in sree''s circle');

-- never changes
select throws_like($$ update public.games set game_label = 'S9' where id = '10000000-0000-4000-8000-0000000000d3' $$,
                   '%never changes%', 'a label cannot be changed');
select lives_ok($$ update public.games set current_round = 2 where id = '10000000-0000-4000-8000-0000000000d3' $$, 'other columns still update');

-- the sequence is unbounded: fill 1..N and the next is N+1
select is(public.next_game_number(:OUTSIDER, 'S'), 2, 'the outsider''s next Points number is 2');
select is(public.next_game_number(:OUTSIDER, 'P'), 1, 'and their first Pool number is 1');

-- removed My players (027) leave the circle
select is(public.next_game_number(:HARISH, 'S'), 2, 'harish: he sits in live A (S1); his own S2 is closed; sree''s games do not involve him');
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-0000000000f2', :OUTSIDER, 'active', 'stake', :STAKE::jsonb, 'GAMEF2');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000f2'), 'S2', 'the outsider''s second game is S2');
insert into public.game_players (game_id, profile_id, player_order, role, seated) values ('10000000-0000-4000-8000-0000000000f2', :PRIYA, 1, 'player', true);
select is(public.next_game_number(:HARISH, 'S'), 3, 'priya (in harish''s list) now sits in the outsider''s live S2, so harish''s next is 3');
update public.my_players set removed_at = now() where owner_id = :HARISH and player_id = :PRIYA;
select is(public.next_game_number(:HARISH, 'S'), 2, 'with priya removed from harish''s list (027), her games stop counting for him');
update public.my_players set removed_at = null where owner_id = :HARISH and player_id = :PRIYA;
update public.my_players set removed_at = null where owner_id = :HARISH and player_id = :PRIYA;

-- ---------- readers ----------
select tests.login(:SREE);
select is((public.get_game_bundle(:A))->'game'->>'game_label', 'S1', 'get_game_bundle carries game_label');
select is((public.get_home_bundle())->'games'->0->>'game_label', (select game_label from public.games where id = ((public.get_home_bundle())->'games'->0->>'id')::uuid), 'home bundle rows carry game_label');
select is((public.get_game_bundle('10000000-0000-4000-8000-0000000000d1'))->'game'->>'game_label', 'S3', 'the deleted answer carries the label');
select is((public.list_hidden_and_deleted())->'deletedGames'->0->>'gameLabel', 'S3', 'list_hidden_and_deleted carries gameLabel');
select tests.logout();
select is(public.game_labels_for(:RK), array['S1'], 'game_labels_for lists the labels of the player''s games');
select tests.login(:SREE);
select is((public.link_player_check(:RK, 2))->>'gameLabels', '["S1"]', 'link_player_check carries gameLabels');
select is((public.link_player_check(:RK, 2))->'conflicts'->0->>'gameLabel', 'S1', 'conflict rows carry the label');
select tests.logout();
select is(public.link_conflict_message(:RK, :HARISH),
          format('Can''t link yet. Game S1 (creator Sree Test, started %s) has both R K and #2. In that game, clear one of their scores to zero and remove them from the game first.',
                 to_char((select created_at from public.games where id = :A), 'Mon FMDD')),
          'the conflict sentence names the game by label, creator and start date, not by id');
select ok(public.link_conflict_message(:RK, :HARISH) !~ '[0-9a-f]{8}-[0-9a-f]{4}', 'no UUID in the sentence');
select tests.login(:SREE);
select ok(public.queue_game_started_emails(:A) >= 2, 'game-started emails queued for the registered seats');
select tests.logout();
select is((select payload->>'gameLabel' from public.email_outbox where kind = 'game_started' and to_profile_id = :HARISH), 'S1', 'the email payload carries gameLabel');
select ok((select payload->>'url' like '%&g=S1' from public.email_outbox where kind = 'game_started' and to_profile_id = :HARISH), 'the scorecard link carries &g=S1');

select is((public.public_scorecard((select view_token from public.games where id = :A)))->>'gameLabel', 'S1', 'public_scorecard carries gameLabel');
select is((public.public_result('20000000-0000-4000-8000-0000000000e1'))->'games'->0->>'label', 'S1', 'public_result labels the game S1');
select tests.login(:HARISH);
select is((public.get_game_result('20000000-0000-4000-8000-0000000000e1'))->'sheet'->'games'->0->>'label', 'S1', 'get_game_result labels the game S1');
select tests.logout();

-- link rows get labels by trigger
insert into public.player_links (owner_id, player_id, kind, status, target_id, token_hash, expires_at, game_numbers)
values (:SREE, :RK, 'link_request', 'pending', :OUTSIDER, repeat('a', 64), now() + interval '7 days', public.game_numbers_for(:RK));
select is((select game_labels from public.player_links where player_id = :RK and kind = 'link_request'), array['S1'], 'a new link row is labelled by the trigger');
select tests.login(:SREE);
select is((select game_labels from public.list_my_link_requests_v2()), array['S1'], 'list_my_link_requests_v2 returns game_labels');
select tests.logout();
select tests.login(:OUTSIDER);
select is((select game_labels from public.list_link_requests_for_me_v2()), array['S1'], 'list_link_requests_for_me_v2 returns game_labels');
select tests.logout();

select * from finish();
rollback;
