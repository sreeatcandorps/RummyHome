-- 055 (D124): a confirmed email change in Auth reaches the profile; the email lock lets only that through;
-- release_my_whatsapp_number() (Not you?) takes the number off the caller's own account and nobody else's.
-- People: sree (…0001), priya (…0003), and a WhatsApp-only account made here (…0f55, +91 90000 00055).
begin;
select plan(16);

\set S '''00000000-0000-4000-8000-000000000001'''
\set P '''00000000-0000-4000-8000-000000000003'''
\set W '''00000000-0000-4000-8000-000000000f55'''

-- ---------- shape ----------
select has_function('public', 'release_my_whatsapp_number', '{}'::text[]);
select ok(has_function_privilege('authenticated', 'public.release_my_whatsapp_number()', 'execute'), 'signed-in users can call release_my_whatsapp_number');
select ok(not has_function_privilege('anon', 'public.release_my_whatsapp_number()', 'execute'), 'anon cannot call release_my_whatsapp_number');
select ok(not has_function_privilege('authenticated', 'public.sync_profile_email_from_auth()', 'execute'), 'the email copy is internal');
select ok(exists (select 1 from pg_trigger where tgname = 'on_auth_user_email_changed' and tgrelid = 'auth.users'::regclass), 'the trigger is on auth.users');

-- ---------- a WhatsApp-only account: no email on the profile ----------
insert into auth.users (instance_id, id, aud, role, phone, encrypted_password, phone_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', :W, 'authenticated', 'authenticated', '919000000055',
        crypt('123456', gen_salt('bf')), now(), '{"provider":"phone","providers":["phone"]}',
        '{"display_name":"Wasim Whatsapp"}', now(), now());
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (gen_random_uuid(), :W, :W, 'phone', jsonb_build_object('sub', :W, 'phone', '919000000055'), now(), now());

select is((select display_name from public.profiles where id = :W), 'Wasim Whatsapp', 'sign-up by WhatsApp makes a profile with the name');
select is((select email from public.profiles where id = :W), null, '… and no email');

-- ---------- A. a backup email added in Auth reaches the profile ----------
update auth.users set email = 'Wasim.Backup@Test.local', email_confirmed_at = now() where id = :W;
select is((select email from public.profiles where id = :W), 'wasim.backup@test.local', 'the confirmed backup email is copied, normalised');

-- ---------- B. a changed email reaches the profile through the lock ----------
update auth.users set email = 'sree.new@test.local' where id = :S;
select is((select email from public.profiles where id = :S), 'sree.new@test.local', 'a changed email in Auth passes the lock and reaches the profile');

select tests.login(:S);
select throws_ok(
  $$ update public.profiles set email = 'someone.else@test.local' where id = auth.uid() $$,
  'Changing your email is not available yet.',
  'typing a different address into the profile is still refused');
select tests.logout();

-- An address already on another profile: the change in Auth still goes through, the profile keeps its email.
update public.profiles set email = 'taken@test.local' where id = '00000000-0000-4000-8000-0000000000a1';
select lives_ok($$ update auth.users set email = 'taken@test.local' where id = '00000000-0000-4000-8000-000000000003' $$,
  'a clash with a placeholder''s email does not fail the change in Auth');
select is((select email from public.profiles where id = :P), 'priya@test.local', '… and priya''s profile keeps her email');

-- ---------- C. Not you? ----------
select tests.anon();
select throws_like($$ select public.release_my_whatsapp_number() $$, '%permission denied%', 'anon is refused');
select tests.logout();

select tests.login(:W);
select lives_ok($$ select public.release_my_whatsapp_number() $$, 'the account holder releases their number');
select tests.logout();
select ok((select phone is null and phone_confirmed_at is null and lower(email) = 'wasim.backup@test.local' from auth.users where id = :W),
  'the number is off the account; its backup email stays');
select is((select count(*)::int from auth.identities where user_id = :W and provider = 'phone'), 0, 'the phone identity is gone');

select * from finish();
rollback;
