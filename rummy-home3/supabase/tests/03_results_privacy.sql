-- 013: a declared result is visible only to people connected to it.
-- R1 = game B (harish declared; harish and priya seated; ab unregistered seat).
begin;
select plan(16);


-- a fresh account with no games: nothing, and no error
select tests.login('00000000-0000-4000-8000-000000000005');
select is(public.list_game_results_page(5, 0), '[]'::jsonb, 'outsider: list_game_results_page is []');
select is(public.list_game_results(), '[]'::jsonb, 'outsider: list_game_results is []');
select ok(public.get_game_result('20000000-0000-4000-8000-0000000000e1') is null, 'outsider: get_game_result is null (not an error)');
select ok(not public.can_see_game_result('20000000-0000-4000-8000-0000000000e1'), 'outsider: can_see_game_result false');

-- someone in a different game only (sree created A and C, never touched B)
select tests.login('00000000-0000-4000-8000-000000000001');
select is(public.list_game_results_page(5, 0), '[]'::jsonb, 'creator of other games: list is []');
select ok(public.get_game_result('20000000-0000-4000-8000-0000000000e1') is null, 'creator of other games: cannot open R1');

-- a viewer of game A (public-link style access elsewhere) is not connected to B
select tests.login('00000000-0000-4000-8000-000000000004');
select ok(public.get_game_result('20000000-0000-4000-8000-0000000000e1') is null, 'viewer of another game: cannot open R1');

-- seated player in B
select tests.login('00000000-0000-4000-8000-000000000003');
select is(jsonb_array_length(public.list_game_results_page(5, 0)), 1, 'seated player: one result listed');
select is(public.get_game_result('20000000-0000-4000-8000-0000000000e1') ->> 'id', '20000000-0000-4000-8000-0000000000e1', 'seated player: opens R1');
select is(jsonb_array_length(public.get_game_result('20000000-0000-4000-8000-0000000000e1') -> 'gameIds'), 1, 'seated player: R1 carries its one game');

-- the declarer (also creator and seated admin of B)
select tests.login('00000000-0000-4000-8000-000000000002');
select ok(public.can_see_game_result('20000000-0000-4000-8000-0000000000e1'), 'declarer: can_see_game_result true');
select is(public.get_game_result('20000000-0000-4000-8000-0000000000e1') ->> 'declaredBy', '00000000-0000-4000-8000-000000000002', 'declarer: opens R1 and is recorded as declarer');

-- app admin sees it
select tests.login('00000000-0000-4000-8000-000000000007');
select ok(public.can_see_game_result('20000000-0000-4000-8000-0000000000e1'), 'app admin: can see R1');

-- a result id that does not exist looks exactly like one you cannot see
select tests.login('00000000-0000-4000-8000-000000000003');
select ok(public.get_game_result('20000000-0000-4000-8000-0000000000ff') is null, 'unknown result id is null, same as a hidden one');

-- the underlying tables are not readable directly by any signed-in user
select throws_like($$ select * from public.game_results $$, '%permission denied%', 'game_results table is not directly readable');
select throws_like($$ select * from public.game_result_games $$, '%permission denied%', 'game_result_games table is not directly readable');

select * from finish();
rollback;
