-- New game picker and My players as the server returns them (007 / 011 / 012).
-- Nov 10 finding: list_new_game_candidates and list_my_players exclude the caller; the app pins
-- the organiser client-side (pinOrganiser / withOwnerFirst). These tests lock the server shape
-- so a future SQL change that starts (or stops) including the caller is noticed.
begin;
select plan(10);

select tests.login('00000000-0000-4000-8000-000000000001');
select ok(not exists (select 1 from public.list_new_game_candidates() c where c.id = auth.uid()), 'candidates: the organiser is NOT in the server list (client pins them)');
select ok(not exists (select 1 from public.list_my_players() m where m.id = auth.uid()), 'my players: the owner is NOT in the server list (client pins them)');
select is((select count(*) from public.list_new_game_candidates())::int, 5, 'sree''s candidates: harish, priya, zero, rk, cd (viewer and co-admin are not seated players)');
select ok(not exists (select 1 from public.list_new_game_candidates() c where c.id = '00000000-0000-4000-8000-000000000004'), 'a spectator never becomes a candidate');
select ok(exists (select 1 from public.list_new_game_candidates() c where c.id = '00000000-0000-4000-8000-0000000000a1' and c.player_status = 'unregistered'), 'an unregistered placeholder is a candidate with its status');
select is((select count(*) from public.list_my_players())::int, 5, 'sree''s My players has five rows');
select ok((select bool_and(player_code like '#%') from public.list_my_players()), 'My players shows #numbers, never the old letter codes');

-- merged / deleted placeholders drop out
select tests.logout();
update public.profiles set player_status = 'merged' where id = '00000000-0000-4000-8000-0000000000a3';
select tests.login('00000000-0000-4000-8000-000000000001');
select ok(not exists (select 1 from public.list_new_game_candidates() c where c.id = '00000000-0000-4000-8000-0000000000a3'), 'a merged placeholder is not a candidate');

-- an outsider has nobody
select tests.login('00000000-0000-4000-8000-000000000005');
select is((select count(*) from public.list_new_game_candidates())::int, 0, 'outsider has no candidates');
select is((select count(*) from public.list_my_players())::int, 0, 'outsider has an empty My players');

select * from finish();
rollback;
