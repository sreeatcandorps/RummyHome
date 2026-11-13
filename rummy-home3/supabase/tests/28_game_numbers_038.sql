-- 038 (PR 5, D5.1): a short game number is unique among ACTIVE games in the creator's circle
-- only. Completed, Closed and Deleted games free their number at once, so a new day starts at
-- S1 again; another circle can hold the same number at the same time; a label never changes.
-- Seed: the outsider (…0005) knows nobody and sits nowhere; harish knows priya and ab; priya
-- sits in sree's live A (S1).
begin;
select plan(22);

\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set STAKE '''{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}'''
\set POOL '''{"gameType":"pool","expenseEnabled":false,"expenseAmount":0,"poolDrop":-25,"poolMiddleDrop":-50,"maxCount":-80,"poolAmount":100}'''

-- ---------- shape ----------
select has_function('public', 'next_game_number', array['uuid', 'text']);
select ok((select prosrc like '%g.status = ''active''%' and prosrc not like '%''completed''%' from pg_proc where proname = 'next_game_number' and pronamespace = 'public'::regnamespace),
  '038: only active games hold a number');
select ok(not has_function_privilege('authenticated', 'public.next_game_number(uuid, text)', 'execute'), 'still internal');
select has_trigger('public', 'games', 'games_assign_number', 'labels are still assigned on insert');
select has_trigger('public', 'games', 'games_lock_label', 'labels are still locked');

-- ---------- 5.1 a fresh circle: S1, S2; complete S1 → the next game is S1 again ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-000000000501', :OUTSIDER, 'active', 'stake', :STAKE::jsonb, 'GN0501');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000501'), 'S1', '5.1 first game S1');
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-000000000502', :OUTSIDER, 'active', 'stake', :STAKE::jsonb, 'GN0502');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000502'), 'S2', '5.1 second live game S2');
update public.games set status = 'completed', completed_at = now() where id = '10000000-0000-4000-8000-000000000501';
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-000000000503', :OUTSIDER, 'active', 'stake', :STAKE::jsonb, 'GN0503');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000503'), 'S1', '5.1 a Completed game frees its number: the new game is S1 (028 would have said S3)');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000501'), 'S1', '5.1 the completed game keeps its own S1');

-- ---------- 5.2 closed and deleted free too; the sequence fills the lowest hole ----------
update public.games set status = 'completed', completed_at = now(), closed_at = now() where id = '10000000-0000-4000-8000-000000000502';
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-000000000504', :OUTSIDER, 'active', 'stake', :STAKE::jsonb, 'GN0504');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000504'), 'S2', '5.2 a Closed game frees its number');
update public.games set deleted_at = now(), deleted_by = :OUTSIDER where id = '10000000-0000-4000-8000-000000000503';
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-000000000505', :OUTSIDER, 'active', 'stake', :STAKE::jsonb, 'GN0505');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000505'), 'S1', '5.2 a Deleted game frees its number');
select is(public.next_game_number(:OUTSIDER, 'S'), 3, '5.2 S1 (505) and S2 (504) are live, so the next is 3');
select is(public.next_game_number(:OUTSIDER, 'P'), 1, '5.2 Pool has its own series');

-- ---------- 5.3 another circle holds the same numbers at the same time ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values ('10000000-0000-4000-8000-000000000506', :HARISH, 'active', 'pool', :POOL::jsonb, 'GN0506');
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000506'), 'P1', '5.3 harish''s Pool game is P1 while the outsider''s circle is unrelated');
select is(public.next_game_number(:HARISH, 'S'), 2, '5.3 harish: priya (in his list) sits in sree''s live A = S1, so his next Points number is 2');
-- seating the outsider's live S2 with priya makes it count for harish
insert into public.game_players (game_id, profile_id, player_order, role, seated) values ('10000000-0000-4000-8000-000000000504', :PRIYA, 1, 'player', true);
select is(public.next_game_number(:HARISH, 'S'), 3, '5.3 a live game a My players member sits in counts, whoever created it');
update public.games set status = 'completed', completed_at = now() where id = '10000000-0000-4000-8000-000000000504';
select is(public.next_game_number(:HARISH, 'S'), 2, '5.3 …and stops counting the moment it is Completed');

-- ---------- 5.4 reopen keeps the label (flagged) ----------
update public.games set status = 'active', completed_at = null where id = '10000000-0000-4000-8000-000000000501';
select is((select game_label from public.games where id = '10000000-0000-4000-8000-000000000501'), 'S1', '5.4 a reopened game keeps its S1 even though 505 is also S1 now');
select is((select count(*) from public.games where created_by = :OUTSIDER and status = 'active' and deleted_at is null and game_label = 'S1'), 2::bigint,
  '5.4 two live S1 in one circle after a reopen (each keeps its own share code and date)');
select is(public.next_game_number(:OUTSIDER, 'S'), 2, '5.4 the next free number skips the shared S1 once');
select throws_like($$ update public.games set game_label = 'S9' where id = '10000000-0000-4000-8000-000000000501' $$, '%never changes%', '5.4 a label still never changes');

-- ---------- 5.5 no backfill: the seeded labels are what 028 gave them ----------
select is((select count(*) from public.games where game_label is null), 0::bigint, '5.5 every game still has a label');

select * from finish();
rollback;
