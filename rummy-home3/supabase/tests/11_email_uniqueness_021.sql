-- 021 email uniqueness: profiles.email is normalised on write, unique case-insensitively
-- across every row, and duplicates are reported (never deleted) by a function app users
-- cannot call. Seed accounts: sree@test.local (…0001), harish@test.local (…0002).
begin;
select plan(20);

-- objects
select has_function('public', 'normalize_profile_email', 'normalize_profile_email exists');
select has_trigger('public', 'profiles', 'profiles_normalize_email', 'profiles_normalize_email trigger is on profiles');
select has_function('public', 'duplicate_profile_emails', 'duplicate_profile_emails exists');
select has_index('public', 'profiles', 'profiles_email_ci_key', 'profiles_email_ci_key exists (seed is clean, so 021 created it)');
select ok((select indisunique from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'profiles_email_ci_key'),
  'profiles_email_ci_key is unique');
select ok((select pg_get_indexdef(c.oid) like '%lower(btrim(email))%' from pg_class c where c.relname = 'profiles_email_ci_key'),
  'profiles_email_ci_key is on lower(btrim(email))');

-- the report is for the SQL editor / service role only
select ok(not has_function_privilege('authenticated', 'public.duplicate_profile_emails()', 'execute'), 'authenticated cannot run the duplicate report');
select ok(not has_function_privilege('anon', 'public.duplicate_profile_emails()', 'execute'), 'anon cannot run the duplicate report');
select ok(has_function_privilege('service_role', 'public.duplicate_profile_emails()', 'execute'), 'service_role can run the duplicate report');
select tests.login('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select * from public.duplicate_profile_emails() $$, '42501', null, 'a signed-in user calling the report is refused');
select tests.logout();

-- clean seed: nothing to report
select is((select count(*) from public.duplicate_profile_emails())::int, 0, 'seeded database has no duplicate emails');

-- A. normalised on insert (a placeholder written directly, as an RPC would)
insert into public.profiles (id, display_name, player_status, managed_by, email)
values ('00000000-0000-4000-8000-0000000000e1', 'Mixed Case', 'unregistered', '00000000-0000-4000-8000-000000000001', '  Mixed.Case@Test.LOCAL ');
select is((select email from public.profiles where id = '00000000-0000-4000-8000-0000000000e1'), 'mixed.case@test.local', 'email is stored lower-case and trimmed');
insert into public.profiles (id, display_name, player_status, managed_by, email)
values ('00000000-0000-4000-8000-0000000000e5', 'Blank Email', 'unregistered', '00000000-0000-4000-8000-000000000001', '   ');
select is((select email from public.profiles where id = '00000000-0000-4000-8000-0000000000e5'), null, 'a blank email is stored as null');

-- B. a second row with the same address in another case is refused
select throws_ok(
  $$ insert into public.profiles (id, display_name, player_status, managed_by, email)
     values ('00000000-0000-4000-8000-0000000000e2', 'Dup', 'unregistered', '00000000-0000-4000-8000-000000000001', 'SREE@Test.Local') $$,
  '23505', null, 'a placeholder with an existing account''s email (different case) is refused');
select throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
     values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated',
             'Harish@TEST.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Harish Two"}') $$,
  '23505', null, 'a sign-up row whose email differs only by case cannot get a second profile');

-- the owner may resend their own address in another case; it stays one normalised value
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok($$ update public.profiles set email = 'SREE@TEST.LOCAL' where id = auth.uid() $$, 'owner saving their own email in upper case is accepted');
select is((select email from public.my_profile), 'sree@test.local', 'and it is still stored normalised');
select throws_like($$ update public.profiles set email = 'Harish@Test.Local' where id = auth.uid() $$,
  'Changing your email is not available yet.%', 'owner cannot switch to another account''s email (011 lock still applies)');
select tests.logout();

-- C. the report lists every row sharing an address, and says which one is a real sign-in.
-- Recreate the pre-021 situation inside this transaction: no case-insensitive guard, no
-- normalising trigger, then a placeholder that spells sree's address differently.
drop index public.profiles_email_ci_key;
drop index if exists public.profiles_email_normalized_key;
alter table public.profiles disable trigger profiles_normalize_email;
insert into public.profiles (id, display_name, player_status, managed_by, email)
values ('00000000-0000-4000-8000-0000000000e4', 'Sree Placeholder', 'unregistered', '00000000-0000-4000-8000-000000000002', 'Sree@Test.Local');
select results_eq(
  $$ select normalized_email, copies::int, profile_id, has_auth_user from public.duplicate_profile_emails() order by has_auth_user desc $$,
  $$ values ('sree@test.local', 2, '00000000-0000-4000-8000-000000000001'::uuid, true),
            ('sree@test.local', 2, '00000000-0000-4000-8000-0000000000e4'::uuid, false) $$,
  'the report pairs the account with the placeholder that reuses its address');
select is((select count(*) from public.profiles where lower(btrim(email)) = 'sree@test.local')::int, 2, 'the report changed nothing: both rows are still there');

select * from finish();
rollback;
