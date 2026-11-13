-- PR 9 (docs/results-delete.md): Delete result and Restore on the 023/034/036 functions. No
-- migration. 9.1 delete → the games go back to Completed (closed_at cleared, status kept) and the
-- result leaves every list; 9.2 a game held by two live results stays Closed when one goes;
-- 9.3 a player who is not an admin is refused, an admin of every game may delete; 9.4 restore
-- reverses 9.1 and only the deleter or an admin may; 9.5 /r/ keeps the summary with deleted: true;
-- the Logs rows result_deleted / result_restored are written by the 036 trigger.
-- Seed: game C (…000c) is completed, created by sree, with harish, zero and cd seated.
begin;
select plan(53);

\set C '''10000000-0000-4000-8000-00000000000c'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''

-- ---------- shape ----------
select has_function('public', 'delete_result', array['uuid']);
select has_function('public', 'restore_result', array['uuid']);
select has_function('public', 'can_manage_result', array['uuid']);
select ok(has_function_privilege('authenticated', 'public.delete_result(uuid)', 'execute'), 'signed-in users may call delete_result (the function checks who)');
select ok(not has_function_privilege('anon', 'public.delete_result(uuid)', 'execute'), 'anon may not delete');
select ok(not has_function_privilege('anon', 'public.restore_result(uuid)', 'execute'), 'anon may not restore');
select ok(has_function_privilege('authenticated', 'public.can_manage_result(uuid)', 'execute'), 'the app may ask can_manage_result for the Delete chip on Past results rows');

-- ---------- sree saves a result for C ----------
select tests.login(:SREE);
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000c']::uuid[]) $$, 'sree saves RC = C');
select tests.logout();
create temp table t_rc as select id, declared_at from public.game_results where declared_by = :SREE order by declared_at desc limit 1;
grant select on t_rc to authenticated, anon;
\set RC '(select id from t_rc)'
\set RC_AT '(select declared_at from t_rc)'
select ok((select closed_at is not null from public.games where id = :C), 'C is Closed');
select is((select status from public.games where id = :C), 'completed', 'the status column still reads completed (Closed = closed_at set)');

-- ---------- who may delete ----------
select tests.login(:SREE);
select ok(public.can_manage_result(:RC), 'the declarer may manage RC');
select tests.logout();
select tests.login(:HARISH);
select ok(not public.can_manage_result(:RC), 'a player in C who is not an admin may not');
select throws_like($$ select public.delete_result((select id from t_rc)) $$, '%saved this result%', '9.3: a player cannot delete');
select tests.logout();
select tests.login(:OUTSIDER);
select ok(not public.can_manage_result(:RC), 'someone outside the games may not');
select throws_like($$ select public.delete_result((select id from t_rc)) $$, '%saved this result%', '9.3: an outsider cannot delete');
select tests.logout();
select throws_like($$ select public.delete_result((select id from t_rc)) $$, '%Sign in required%', 'signed out: refused');
select throws_like($$ select public.delete_result('00000000-0000-4000-8000-00000000dead') $$, '%Sign in required%', 'signed out: refused before the lookup');
select tests.login(:SREE);
select throws_like($$ select public.delete_result('00000000-0000-4000-8000-00000000dead') $$, '%not available%', 'an unknown result');
select tests.logout();

-- ---------- 9.1 delete: C goes back to Completed, RC leaves the lists ----------
select tests.login(:SREE);
select is((select public.delete_result(:RC))->>'deleted', 'true', '9.1: the declarer deletes RC');
select is((select (public.delete_result(:RC))->'gameIds'), to_jsonb(array[:C]), 'the reply names the games that reopened (and a second call is harmless)');
select ok(not exists (select 1 from jsonb_array_elements(public.list_game_results_page(50, 0)) c where (c->>'id')::uuid = :RC), 'RC is off Past results');
select is((select public.get_game_result(:RC)->>'deleted'), 'true', 'get_game_result says deleted');
select is((select public.get_game_result(:RC)->>'canRestore'), 'true', 'and that the declarer may restore');
select is((select count(*) from public.results_holding_game(:C))::int, 0, 'no live result holds C');
select is((select jsonb_array_length(public.list_hidden_and_deleted()->'deletedResults')), 1, 'the Deleted list has one row');
select is((select d->>'gameCount' from jsonb_array_elements(public.list_hidden_and_deleted()->'deletedResults') d where (d->>'id')::uuid = :RC), '1', 'the row counts its game');
select is((select d->>'playerCount' from jsonb_array_elements(public.list_hidden_and_deleted()->'deletedResults') d where (d->>'id')::uuid = :RC), '3', 'and its three players');
select is((select d->>'deletedByMe' from jsonb_array_elements(public.list_hidden_and_deleted()->'deletedResults') d where (d->>'id')::uuid = :RC), 'true', 'deleted by me');
select tests.logout();
select ok((select closed_at is null from public.games where id = :C), '9.1 / D9.1: C is Completed again (closed_at cleared)');
select is((select status from public.games where id = :C), 'completed', 'its status is untouched');
select ok((select deleted_at is null from public.games where id = :C), 'the game itself is not deleted');
select ok((select deleted_at is not null and deleted_by = :SREE from public.game_results where id = :RC), 'the result row carries the stamp and who');
select is((select count(*) from public.event_log e where e.result_id = :RC and e.kind = 'result_deleted')::int, 1, 'Logs: one result_deleted row (036 trigger)');
select is((select e.summary from public.event_log e where e.result_id = :RC and e.kind = 'result_deleted'), 'Result deleted · 1 game back to Completed · can be restored from Past results', 'its summary');

-- ---------- 9.4 restore: only the deleter or an admin; reverses 9.1 ----------
select tests.login(:HARISH);
select is((select public.get_game_result(:RC)->>'deleted'), 'true', 'a player in C sees the deleted state');
select is((select public.get_game_result(:RC)->>'canRestore'), 'false', 'but may not restore');
select throws_like($$ select public.restore_result((select id from t_rc)) $$, '%deleted this result%', 'restore by a player: refused');
select tests.logout();
select tests.login(:SREE);
select is((select public.restore_result(:RC))->>'restored', 'true', 'the deleter restores RC (Undo on the toast, or Restore on the row)');
select ok(exists (select 1 from jsonb_array_elements(public.list_game_results_page(50, 0)) c where (c->>'id')::uuid = :RC), 'RC is back on Past results');
select is((select jsonb_array_length(public.list_hidden_and_deleted()->'deletedResults')), 0, 'the Deleted list is empty again');
select tests.logout();
select is((select closed_at from public.games where id = :C), :RC_AT, 'C is Closed by RC again');
select is((select count(*) from public.event_log e where e.result_id = :RC and e.kind = 'result_restored')::int, 1, 'Logs: one result_restored row');

-- ---------- 9.2 a game in two live results stays Closed when one is deleted ----------
select tests.login(:SREE);
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000c']::uuid[]) $$, 'sree saves RC2 = C again (reused, with the warning)');
select tests.logout();
create temp table t_rc2 as select id from public.game_results where declared_by = :SREE and id <> (select id from t_rc) order by declared_at desc limit 1;
grant select on t_rc2 to authenticated, anon;
\set RC2 '(select id from t_rc2)'
select is((select closed_at from public.games where id = :C), :RC_AT, 'C is Closed from the earlier result');
select tests.login(:SREE);
select is((select public.delete_result(:RC2))->>'deleted', 'true', 'delete RC2');
select tests.logout();
select is((select closed_at from public.games where id = :C), :RC_AT, '9.2: C stays Closed — RC still holds it');
select tests.login(:SREE);
select is((select public.delete_result(:RC))->>'deleted', 'true', 'delete RC too');
select tests.logout();
select ok((select closed_at is null from public.games where id = :C), 'now nothing holds C: Completed');

-- ---------- 9.5 /r/ keeps the summary of a deleted result ----------
select tests.anon();
select is(public.public_result(:RC)->>'deleted', 'true', '9.5: the page knows RC is deleted');
select is(jsonb_array_length(public.public_result(:RC, 1)->'standings'), 3, 'the saved standings are still there, read-only');
select tests.logout();

-- ---------- 9.3 an admin of every game (not the declarer) may delete / restore ----------
update public.game_players set role = 'game_admin' where game_id = :C and profile_id = :HARISH;
select tests.login(:HARISH);
select ok(public.can_manage_result(:RC), 'harish, now an admin of C, may manage RC');
select is((select public.restore_result(:RC))->>'restored', 'true', 'an admin restores RC');
select is((select public.delete_result(:RC))->>'deleted', 'true', 'and may delete it again');
select tests.logout();

select * from finish();
rollback;
