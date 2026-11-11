-- 011: who can read which profile rows, and what Find player gives away.
-- Placeholders: rk (sree's, seated in A), ab (harish's, seated in B), cd (sree's, seated in C).
begin;
select plan(14);

-- outsider: no placeholders at all
select tests.login('00000000-0000-4000-8000-000000000005');
select is((select count(*) from public.profiles where managed_by is not null)::int, 0, 'outsider sees no unregistered placeholders');
select ok(exists (select 1 from public.profiles where id = auth.uid()), 'outsider sees their own row');

-- seated player in A and B sees rk (A) and ab (B) but not cd (C)
select tests.login('00000000-0000-4000-8000-000000000003');
select ok(exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'player in A sees placeholder rk from A');
select ok(exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'), 'player in B sees placeholder ab from B');
select ok(not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a3'), 'player not in C does not see placeholder cd');

-- the organiser sees their own placeholders even outside a shared game
select tests.login('00000000-0000-4000-8000-000000000001');
select ok(exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a3'), 'organiser sees their placeholder cd');
select ok(not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'), 'organiser does not see another organiser''s placeholder ab');

-- nobody edits someone else's profile
select tests.login('00000000-0000-4000-8000-000000000005');
update public.profiles set display_name = 'Hacked' where id = '00000000-0000-4000-8000-000000000002';
select tests.logout();
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-000000000002'), 'Harish Test', 'outsider update of another profile touches 0 rows');
select tests.login('00000000-0000-4000-8000-000000000005');

-- Find player (search_players): a partial email matches nobody; a full email or a name does
select is((select count(*) from public.search_players('harish@'))::int, 0, 'search: partial email matches nobody');
select is((select count(*) from public.search_players('harish@test.local'))::int, 1, 'search: full email matches one');
select is((select count(*) from public.search_players('Har'))::int, 1, 'search: name prefix matches');

-- KNOWN GAP (documented, not fixed here): any signed-in account can read the email of every
-- registered profile straight from the table, because can_see_profile() returns true whenever
-- managed_by is null. docs/migrations-to-apply.md §011 says signed-in users "see their own row,
-- players they created, and players they have played with" — the policy is wider than that.
select todo('privacy gap: registered profiles (email/phone/zip) readable by any signed-in account', 1);
select is(
  (select count(*) from public.profiles where id <> auth.uid() and email is not null)::int,
  0, 'a stranger reads no other registered account''s email from profiles');

-- KNOWN BUG (found by this suite, not fixed here): the "users update own profile" policy lets a
-- signed-in account change its own `role`, and nothing locks that column. After
--   update profiles set role = 'app_admin' where id = auth.uid()
-- is_app_admin() is true, so every game, every seat and every result in the project opens up.
-- The fix belongs in a migration (a trigger that refuses role changes unless the caller is
-- already an app admin, like profiles_lock_email does for email). Kept last: it changes the session.
select todo('privilege escalation: a user can set their own profiles.role to app_admin', 2);
update public.profiles set role = 'app_admin' where id = auth.uid();
select is((select role::text from public.profiles where id = auth.uid()), 'player', 'a user cannot change their own role');
select ok(not public.is_app_admin(), 'a user who tried is still not an app admin');

select * from finish();
rollback;
