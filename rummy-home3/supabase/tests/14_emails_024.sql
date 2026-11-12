-- 024: emails are queued server-side, once per (event, recipient), only for registered
-- players with an email who have the preference on; the public results page reader shows
-- the saved result without account ids or contact details; unsubscribe works by token.
begin;
select plan(49);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set B '''10000000-0000-4000-8000-00000000000b'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set R1 '''20000000-0000-4000-8000-0000000000e1'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''

-- ---------- objects ----------
select has_table('public', 'email_outbox', 'email_outbox exists');
select ok((select relrowsecurity from pg_class where oid = 'public.email_outbox'::regclass), 'email_outbox has RLS (no policies: service role only)');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'email_outbox'), 0, 'no row policies on the outbox');
select has_column('public', 'profiles', 'email_game_started', 'profiles.email_game_started');
select has_column('public', 'profiles', 'email_results', 'profiles.email_results');
select has_column('public', 'profiles', 'email_token', 'profiles.email_token');
select is((select count(*)::int from public.profiles where email_token is null), 0, 'every profile has an unsubscribe token');
select is((select count(distinct email_token)::int from public.profiles), (select count(*)::int from public.profiles), 'tokens are unique');
select has_function('public', 'queue_game_started_emails', array['uuid']);
select has_function('public', 'queue_result_saved_emails', array['uuid']);
select has_function('public', 'public_result', array['uuid']);
select has_function('public', 'unsubscribe_email', array['text', 'text']);
select has_function('public', 'set_email_prefs', array['boolean', 'boolean']);

-- ---------- nobody else reads the token or the preferences ----------
select tests.login(:HARISH);
select throws_like($$ select email_token from public.profiles where id = '00000000-0000-4000-8000-000000000001' $$, '%permission denied%', 'another account cannot read a token');
select throws_like($$ select email_results from public.profiles where id = '00000000-0000-4000-8000-000000000001' $$, '%permission denied%', 'another account cannot read a preference');
select is((select email_game_started from public.my_profile), true, 'the owner reads their own preference through my_profile (default on)');
select is((select email_results from public.my_profile), true, 'results preference defaults on');
select throws_like($$ select * from public.email_outbox $$, '%permission denied%', 'a signed-in account cannot read the outbox');
select tests.logout();

-- ---------- game started: creator/admin only, registered + email + preference, once ----------
update public.games set status = 'active' where id = :A;
select tests.login(:PRIYA);
select throws_like($$ select public.queue_game_started_emails('10000000-0000-4000-8000-00000000000a') $$, '%creator or a game admin%', 'a seated player cannot queue the game-started email');
select tests.logout();
-- priya turns Game started off; harish keeps it
select tests.login(:PRIYA);
select is(public.set_email_prefs(false, null), '{"results": true, "gameStarted": false}'::jsonb, 'set_email_prefs answers the saved pair');
select tests.logout();
create temp table t_eligible as select count(*)::int as n from public.game_players gp join public.profiles p on p.id = gp.profile_id
  where gp.game_id = :A and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true) and p.player_status = 'registered' and p.email is not null and p.email_game_started;
grant select on t_eligible to authenticated, anon;
select ok((select n from t_eligible) >= 1, 'at least harish is eligible');
select tests.login(:SREE);
select is(public.queue_game_started_emails(:A), (select n from t_eligible), 'A: one row per eligible seated player (priya opted out, rk is unregistered)');
select is(public.queue_game_started_emails(:A), 0, 'a retry adds nothing (same event keys)');
select tests.logout();
select is((select count(*)::int from public.email_outbox where kind = 'game_started'), (select n from t_eligible), 'exactly the eligible seated players got a row');
select is((select to_email from public.email_outbox where kind = 'game_started' and to_profile_id = :HARISH), 'harish@test.local', 'the row carries the recipient''s email');
select ok((select payload->>'url' like 'https://ezscore.mindweavetech.com/scorecard.html?t=%&g=%' from public.email_outbox where to_profile_id = :HARISH), 'the live link uses the game''s view token and number');
select is((select payload->>'unsubscribeToken' from public.email_outbox where to_profile_id = :HARISH), (select email_token from public.profiles where id = :HARISH), 'the payload carries the recipient''s own unsubscribe token');
select is((select count(*)::int from public.email_outbox where to_profile_id = :PRIYA), 0, 'an opted-out player gets no row');
select is((select count(*)::int from public.email_outbox where sent_at is not null), 0, 'nothing is marked sent by the database (the edge function does that)');

-- ---------- result saved: queued inside declare_game_result ----------
insert into public.game_players (game_id, profile_id, player_order, role, seated) values (:B, :SREE, 9, 'game_admin', false);
select tests.login(:SREE);
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-00000000000b']::uuid[]) $$, 'sree saves a result with B (harish 60, priya -25, ab -35)');
select tests.logout();
create temp table t_r2 as select id from public.game_results where declared_by = :SREE order by declared_at desc limit 1;
grant select on t_r2 to authenticated, anon;
select is((select count(*)::int from public.email_outbox where kind = 'result_saved' and to_profile_id = :HARISH), 1, 'harish (registered, email, pref on) gets the result email row');
select is((select count(*)::int from public.email_outbox where kind = 'result_saved' and to_profile_id = '00000000-0000-4000-8000-0000000000a2'), 0, 'the unregistered ab gets none');
select is((select count(*)::int from public.email_outbox where kind = 'result_saved'), 2, 'harish and priya: two rows (priya only opted out of Game started)');
select is((select payload->>'place' from public.email_outbox where kind = 'result_saved' and to_profile_id = :HARISH), '1', 'the payload carries the recipient''s place');
select is((select payload->>'url' from public.email_outbox where kind = 'result_saved' and to_profile_id = :HARISH), 'https://ezscore.mindweavetech.com/r/' || (select id::text from t_r2), 'the result link is /r/<result id> on the share site');
select tests.login(:SREE);
select is(public.queue_result_saved_emails((select id from t_r2)), 0, 'calling the queue again adds nothing');
select tests.logout();

-- ---------- unsubscribe by token (signed out) ----------
select tests.anon();
select is(public.unsubscribe_email('not-a-token-at-all-really', 'result_saved'), false, 'an unknown token changes nothing');
select tests.logout();
create temp table t_tok as select email_token as t from public.profiles where id = :HARISH;
grant select on t_tok to anon, authenticated;
select tests.anon();
select is(public.unsubscribe_email((select t from t_tok), 'result_saved'), true, 'the token turns Results off');
select tests.logout();
select is((select email_results from public.profiles where id = :HARISH), false, 'harish''s Results preference is off');
select is((select email_game_started from public.profiles where id = :HARISH), true, 'Game started is untouched');

-- ---------- public results page: positions, no ids, deleted flag ----------
select tests.anon();
select is(public.public_result('20000000-0000-4000-8000-00000000dead'), null, 'unknown id: null');
select is(public.public_result((select id from t_r2))->'games'->0->>'reused', 'true', 'B is flagged reused (it is also in R1)');
select is(public.public_result((select id from t_r2))->'players'->0->>'label', 'HT', 'players carry their column letters');
select ok(not (public.public_result((select id from t_r2))::text like '%' || :HARISH::text || '%'), 'no account id in the public result');
select ok(not (public.public_result((select id from t_r2))::text like '%@%'), 'no email in the public result');
select is((select jsonb_array_length(public.public_result((select id from t_r2))->'standings')), 3, 'three standings for B');
select is(public.public_result((select id from t_r2))->'games'->0->'scores'->>'0', '60', 'per-game scores are keyed by player position, 60 for harish');
select tests.logout();
select tests.login(:SREE);
select lives_ok($$ select public.delete_result((select id from t_r2)) $$, 'sree deletes the result');
select tests.logout();
select tests.anon();
select is(public.public_result((select id from t_r2))->>'deleted', 'true', 'the page learns the result was deleted');
select tests.logout();

select * from finish();
rollback;
