-- 025: Link to Player ID needs the account's Player ID and email together, refuses when the
-- account already plays in any game the unregistered player is in, otherwise moves every seat,
-- score and dealer mark to the account, records an undoable link, and folds My players.
begin;
select plan(36);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set VIEWER '''00000000-0000-4000-8000-000000000004'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set COADMIN '''00000000-0000-4000-8000-000000000006'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set CD '''00000000-0000-4000-8000-0000000000a3'''

-- Player IDs are assigned by sequence; read them rather than guess.
create temp table t_no as
  select (select public_player_no from public.profiles where id = :PRIYA) as priya,
         (select public_player_no from public.profiles where id = :COADMIN) as coadmin,
         (select public_player_no from public.profiles where id = :OUTSIDER) as outsider,
         (select public_player_no from public.profiles where id = :VIEWER) as viewer,
         (select public_player_no from public.profiles where id = :RK) as rk;
grant select on t_no to authenticated, anon;

-- ---------- objects and grants ----------
select has_function('public', 'link_player_check', array['uuid', 'bigint', 'text']);
select has_function('public', 'link_player_to_account', array['uuid', 'bigint', 'text']);
select ok(has_function_privilege('authenticated', 'public.link_player_check(uuid, bigint, text)', 'execute'), 'signed-in accounts may preview');
select ok(not has_function_privilege('anon', 'public.link_player_to_account(uuid, bigint, text)', 'execute'), 'anon may not link');
select ok(not has_function_privilege('authenticated', 'public.link_target_for(bigint, text)', 'execute'), 'the raw lookup is internal');

-- ---------- who may link whom ----------
select throws_like($$ select public.link_player_check('00000000-0000-4000-8000-0000000000a1', 1, 'x@test.local') $$, '%Sign in required%', 'anonymous: refused');
select tests.login(:HARISH);
select throws_like(format($$ select public.link_player_check(%L, (select coadmin from t_no), 'coadmin@test.local') $$, :RK), '%own unregistered players%', 'another organiser cannot link my player');
select tests.logout();
select tests.login(:SREE);
select throws_like(format($$ select public.link_player_check(%L, (select coadmin from t_no), 'coadmin@test.local') $$, :HARISH), '%own unregistered players%', 'a registered account is not linkable');

-- ---------- the pair must match ----------
select throws_like(format($$ select public.link_player_check(%L, 999999, 'coadmin@test.local') $$, :RK), '%No registered player has that Player ID%', 'unknown number');
select throws_like(format($$ select public.link_player_check(%L, (select rk from t_no), 'x@test.local') $$, :RK), '%No registered player has that Player ID%', 'an unregistered player''s own number is not a registered account');
select throws_like(format($$ select public.link_player_check(%L, (select coadmin from t_no), 'wrong@test.local') $$, :RK), '%does not match Player ID%', 'wrong email: refused, email not revealed');
select throws_like(format($$ select public.link_player_check(%L, (select coadmin from t_no), '') $$, :RK), '%Type the email%', 'empty email: refused');
select throws_like(format($$ select public.link_player_check(%L, null, 'coadmin@test.local') $$, :RK), '%Type the Player ID%', 'no number: refused');
select lives_ok(format($$ select public.link_player_check(%L, (select coadmin from t_no), '  COADMIN@Test.Local ') $$, :RK), 'email matching ignores case and spaces');

-- ---------- conflicts across every game ----------
select is((select public.link_player_check(:RK, (select priya from t_no), 'priya@test.local')->'conflicts'->0->>'gameId'), '10000000-0000-4000-8000-00000000000a', 'priya already plays in A with rk: A is a conflict');
select is((select public.link_player_check(:RK, (select priya from t_no), 'priya@test.local')->>'gameCount'), '1', 'rk sits in one game');
select throws_like(format($$ select public.link_player_to_account(%L, (select priya from t_no), 'priya@test.local') $$, :RK), '%already plays in%', 'linking onto a conflict is refused');
select is((select profile_id from public.game_players where game_id = :A and profile_id = :RK), :RK::uuid, 'nothing moved on refusal');
select is((select public.link_player_check(:RK, (select viewer from t_no), 'viewer@test.local')->'conflicts'), '[]'::jsonb, 'a viewer of A is not a conflict (they take the seat)');
select is((select public.link_player_check(:RK, (select coadmin from t_no), 'coadmin@test.local')->'conflicts'), '[]'::jsonb, 'a non-playing admin of A is not a conflict');
select is((select public.link_player_check(:RK, (select outsider from t_no), 'outsider@test.local')->'target'->>'name'), 'Otto Outsider', 'the preview names the account');

-- ---------- the link: rk (Game A) -> coadmin, who is A''s non-playing admin ----------
create temp table t_link as select public.link_player_to_account(:RK, (select coadmin from t_no), 'coadmin@test.local') as r;
grant select on t_link to authenticated, anon;
select is((select r->'movedGameIds' from t_link), to_jsonb(array[:A::uuid]), 'A moved');
select is((select r->'target'->>'id' from t_link), :COADMIN, 'the answer names the account');
select is((select count(*)::int from public.game_players where game_id = :A and profile_id = :COADMIN), 1, 'one membership for coadmin in A');
select is((select role from public.game_players where game_id = :A and profile_id = :COADMIN), 'game_admin', 'coadmin keeps the admin role');
select is((select seated from public.game_players where game_id = :A and profile_id = :COADMIN), true, 'and is seated now');
select is((select count(*)::int from public.game_players where profile_id = :RK), 0, 'rk has no seats left');
select is((select value from public.scores where round_id = '30000000-0000-4000-8000-0000000000a1' and profile_id = :COADMIN), 30, 'rk''s round-1 rummy score is coadmin''s');
select is((select count(*)::int from public.scores where game_id = :A and profile_id = :RK), 0, 'no score left on rk');
select is((select player_status from public.profiles where id = :RK), 'merged', 'rk is merged');
select is((select games_together from public.my_players where owner_id = :SREE and player_id = :COADMIN), 1, 'sree''s My players: coadmin added with the moved game');
select is((select count(*)::int from public.my_players where owner_id = :SREE and player_id = :RK), 0, 'and rk left the list');
select is((select status from public.player_links where id = (select (r->>'linkId')::uuid from t_link)), 'claimed', 'a claimed link row records the move');

-- ---------- wrong person: 011 unlink puts everything back ----------
select lives_ok(format($$ select public.unlink_player(%L) $$, (select r->>'linkId' from t_link)), 'unlink_player accepts the 025 link row');
select is((select profile_id from public.game_players where game_id = :A and player_order = 2), :RK::uuid, 'rk is back in seat 2 of A');
select is((select player_status from public.profiles where id = :RK), 'unregistered', 'rk is unregistered again');
select tests.logout();

select * from finish();
rollback;
