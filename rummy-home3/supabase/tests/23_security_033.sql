-- 033 security advisor cleanup: my_profile is a security-invoker view that still shows the
-- owner (and only the owner) their whole row; the twelve functions carry a fixed search_path;
-- anon can call exactly the five public RPCs (plus the policy helpers) and every signed-in
-- flow the app uses still works.
begin;
select plan(65);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''

-- ---------- 1. my_profile ----------
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.my_profile'::regclass), 'my_profile runs as the caller (security_invoker)');
select ok((select reloptions @> array['security_barrier=true'] from pg_class where oid = 'public.my_profile'::regclass), 'my_profile keeps security_barrier');
select is(
  (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'my_profile'),
  (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'profiles'),
  'my_profile has exactly the columns of profiles, in the same order');
select has_function('public', 'my_profile_rows', array[]::text[], 'my_profile_rows() exists');
select is_definer('public', 'my_profile_rows', array[]::text[], 'my_profile_rows is security definer');
select ok((select proconfig @> array['search_path=public, pg_temp'] from pg_proc where oid = 'public.my_profile_rows()'::regprocedure), 'my_profile_rows has a fixed search_path');
select ok(not has_function_privilege('anon', 'public.my_profile_rows()', 'execute'), 'anon cannot call my_profile_rows');
select ok(has_function_privilege('authenticated', 'public.my_profile_rows()', 'execute'), 'signed-in users can');
select ok(not has_table_privilege('anon', 'public.my_profile', 'select'), 'anon cannot select from my_profile');
select ok(has_table_privilege('authenticated', 'public.my_profile', 'select'), 'signed-in users select from my_profile');
select ok(not has_table_privilege('authenticated', 'public.my_profile', 'update'), 'my_profile is read-only (the app never wrote through it)');

select tests.login(:SREE);
select is((select count(*)::int from public.my_profile), 1, 'sree sees one row in my_profile');
select is((select id from public.my_profile), :SREE::uuid, 'and it is their own');
select is((select email from public.my_profile), 'sree@test.local', 'the owner reads their email through the view');
select lives_ok($$ select phone, zip_code, email_token, email_game_started, email_results from public.my_profile $$, 'the owner reads every private column through the view');
select is((select email_game_started from public.my_profile), true, 'the app''s emails query (email_game_started, email_results) answers');
select is((select count(*)::int from public.my_profile where id = :HARISH), 0, 'the app''s auth query with .eq(id, me) finds nothing for another id');
select throws_like($$ select email from public.profiles where id = '00000000-0000-4000-8000-000000000002' $$, '%permission denied%', 'another account''s email is still refused on the table');
select tests.logout();

select tests.login(:HARISH);
select is((select id from public.my_profile), :HARISH::uuid, 'harish sees only harish');
select is((select email from public.my_profile), 'harish@test.local', 'with his own email');
select tests.logout();

select tests.anon();
select throws_like($$ select * from public.my_profile $$, '%permission denied%', 'anon is refused on my_profile');
select tests.logout();

-- ---------- 2. search_path pinned ----------
select is((
  select count(*)::int from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and (p.proname, pg_get_function_identity_arguments(p.oid)) in (
      ('initials_words', 'p_name text'), ('initials_push', 'p_list text[], p_label text'), ('initials_candidates', 'p_name text'),
      ('player_label', 'p profiles'), ('site_base_url', ''), ('link_request_days', ''),
      ('lock_profile_email', ''), ('lock_public_player_no', ''), ('touch_updated_at', ''),
      ('game_label_text', 'p_label text, p_number integer'), ('game_label_prefix', 'p_type game_type'), ('lock_game_label', ''))
    and coalesce(p.proconfig, '{}') @> array['search_path=public, pg_temp']
), 12, 'all twelve functions carry search_path = public, pg_temp');
select is((
  select count(*)::int from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
), 0, 'no function of ours is left without a search_path');

select is((public.initials_candidates('Sree Koneru'))[1:3], array['SK', 'SRK', 'SKO'], 'initials_candidates still answers');
select is((select public.player_label(p) from public.profiles p where p.id = :SREE), '#' || (select public_player_no::text from public.profiles where id = :SREE), 'player_label still answers');
select ok(public.site_base_url() like 'https://%', 'site_base_url still answers');
select ok(public.link_request_days() > 0, 'link_request_days still answers');
select is((select game_label from public.games where id = :A), 'S1', 'game labels are still readable (028)');

select tests.login(:SREE);
select lives_ok($$ update public.profiles set display_name = 'Sree Test' where id = auth.uid() $$, 'owner updates their own profile (touch_updated_at fires)');
select ok((select updated_at >= now() - interval '5 seconds' from public.profiles where id = :SREE), 'updated_at was touched');
select throws_like($$ update public.profiles set email = 'Harish@Test.Local' where id = auth.uid() $$, 'Changing your email is not available yet.%', 'lock_profile_email still fires');
select throws_ok($$ update public.profiles set public_player_no = 999999 where id = auth.uid() $$, null, null, 'lock_public_player_no still fires');
select tests.logout();

-- ---------- 3. anon executes only the public RPCs and the policy helpers ----------
select is((
  select string_agg(p.proname, ' ' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and has_function_privilege('anon', p.oid, 'execute')
), 'answer_link_request_by_token can_see_profile is_app_admin is_game_admin is_game_member peek_link_request public_result public_scorecard unsubscribe_email',
  'anon executes exactly the five public RPCs and the four policy helpers');
select ok(not has_function_privilege('anon', 'public.add_my_player(uuid)', 'execute'), 'anon cannot add_my_player');
select ok(not has_function_privilege('anon', 'public.search_players(text)', 'execute'), 'anon cannot search_players');
select ok(not has_function_privilege('anon', 'public.peek_claim_link(text)', 'execute'), 'anon cannot peek_claim_link (the app peeks signed in)');
select ok(not has_function_privilege('anon', 'public.list_my_player_links()', 'execute'), 'anon cannot list_my_player_links');
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'anon cannot call the sign-up trigger function');
select ok(not has_function_privilege('public', 'public.handle_new_user()', 'execute'), 'nor can PUBLIC');
select ok(has_function_privilege('authenticated', 'public.add_my_player(uuid)', 'execute'), 'signed-in users still add_my_player');
select ok(has_function_privilege('authenticated', 'public.search_players(text)', 'execute'), 'signed-in users still search_players');
select ok(has_function_privilege('authenticated', 'public.peek_claim_link(text)', 'execute'), 'signed-in users still peek_claim_link');

-- the web pages, signed out
select set_config('tests.token', (select view_token from public.games where id = '10000000-0000-4000-8000-00000000000a'), true);
select tests.anon();
select ok((select public.public_scorecard(current_setting('tests.token'))) is not null, 'anon opens /scorecard.html with the token');
select is(public.public_result('20000000-0000-4000-8000-00000000dead'), null, 'anon calls public_result (/r/)');
select is(public.unsubscribe_email('not-a-token-at-all-really', 'result_saved'), false, 'anon calls unsubscribe_email (/unsubscribe.html)');
select is(public.peek_link_request('wrong-token-xxxxxxxxxxxxxxxxx'), null, 'anon calls peek_link_request (/link.html)');
select is(public.answer_link_request_by_token('wrong-token-xxxxxxxxxxxxxxxxx', true)->>'ok', 'false', 'anon calls answer_link_request_by_token (/link.html)');
select throws_like($$ select public.add_my_player('00000000-0000-4000-8000-0000000000a7') $$, '%permission denied%', 'anon is refused on add_my_player');
select throws_like($$ select * from public.search_players('Har') $$, '%permission denied%', 'anon is refused on search_players');
select throws_like($$ select * from public.peek_claim_link('x') $$, '%permission denied%', 'anon is refused on peek_claim_link');
select throws_like($$ select public.my_verified_email() $$, '%permission denied%', 'anon is refused on my_verified_email');
-- tables with policies that call the kept helpers answer zero rows, not an error
select is((select count(*)::int from public.games), 0, 'anon lists no games (policy helpers still callable)');
select is((select count(*)::int from public.game_players), 0, 'anon lists no seats');
select is((select count(*)::int from public.my_players), 0, 'anon lists no my_players');
select is((select count(*)::int from public.prize_sessions), 0, 'anon lists no prize sessions');
select tests.logout();

-- ---------- 4. the app's signed-in flows ----------
select tests.login(:SREE);
select lives_ok($$ select public.add_my_player('00000000-0000-4000-8000-000000000005') $$, 'sree adds a player to My players');
select is((select count(*)::int from public.search_players('Har')), 1, 'sree searches players');
select lives_ok($$ select * from public.list_my_player_links() $$, 'sree lists player links');
select lives_ok($$ select * from public.list_claim_requests() $$, 'sree lists claim requests');
select lives_ok($$ select * from public.list_prize_sessions() $$, 'sree lists prize sessions');
select lives_ok($$ select public.create_unregistered_player('Test', 'Guest') $$, 'sree adds an unregistered player (generate_player_code fires)');
select lives_ok($$ insert into public.games (id, created_by, status, game_type, settings, share_code)
  values ('10000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-000000000001', 'active', 'stake',
          (select settings from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'GAMEF3') $$,
  'sree starts a game (guard_games and assign_game_number fire)');
select ok((select game_label from public.games where id = '10000000-0000-4000-8000-0000000000f3') is not null, 'the new game got a label');
select tests.logout();

-- sign-up still creates a profile (handle_new_user fires as the auth role, not as anon)
select lives_ok($$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f4', 'authenticated', 'authenticated',
          'newbie033@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Newbie Thirty"}') $$,
  'a new sign-up row is accepted');
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-0000000000f4'), 'Newbie Thirty', 'and its profile was created');

select * from finish();
rollback;
