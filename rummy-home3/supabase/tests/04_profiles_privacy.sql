-- 011/019: who can read which profile rows and columns, what Find player gives away,
-- and that nobody can promote themselves to app admin.
-- Placeholders: rk (sree's, seated in A), ab (harish's, seated in B), cd (sree's, seated in C).
begin;
select plan(27);

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

-- 019 (B): email, phone and zip_code are the owner's alone. SELECT on profiles is granted per
-- column to authenticated, so reading a contact column (or `select *`) is refused outright;
-- the row policy from 011 still decides which rows the safe columns come from.
select throws_ok(
  $$ select email from public.profiles where id <> auth.uid() $$,
  '42501', null, 'a stranger cannot read other accounts'' email from profiles');
select throws_ok(
  $$ select phone from public.profiles where id <> auth.uid() $$,
  '42501', null, 'a stranger cannot read other accounts'' phone from profiles');
select throws_ok(
  $$ select zip_code from public.profiles where id <> auth.uid() $$,
  '42501', null, 'a stranger cannot read other accounts'' zip code from profiles');
select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null, 'select * on profiles is refused for signed-in users (name the columns)');
select lives_ok(
  $$ select id, display_name, first_name, last_name, avatar_url, player_code, public_player_no, player_status, managed_by, role from public.profiles $$,
  'name, avatar, Player ID and status columns are still readable');
select ok((select count(*) from public.profiles where id <> auth.uid()) > 0, 'other registered players are still listed by name');

-- the owner reads their own full row through my_profile
select is((select count(*) from public.my_profile)::int, 1, 'my_profile returns exactly the caller''s row');
select is((select email from public.my_profile), 'outsider@test.local', 'my_profile carries the caller''s email');
select is((select id from public.my_profile), auth.uid(), 'my_profile is the caller''s own row');

-- signed out: nothing at all
select tests.anon();
select throws_ok($$ select display_name from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.my_profile $$, '42501', null, 'anon cannot read my_profile');

-- 019 (A): the "users update own profile" policy covers the row, but the role column is
-- locked by profiles_lock_role: only an app admin (or the service role / SQL) may change it.
-- Kept last: it changes the session.
select tests.login('00000000-0000-4000-8000-000000000005');
select throws_ok(
  $$ update public.profiles set role = 'app_admin' where id = auth.uid() $$,
  '42501', 'Only an app admin can change a player''s role.', 'a user cannot grant themselves app_admin');
select is((select role::text from public.profiles where id = auth.uid()), 'player', 'the role is still player');
select ok(not public.is_app_admin(), 'a user who tried is still not an app admin');
select lives_ok(
  $$ update public.profiles set display_name = 'Otto O.' where id = auth.uid() $$,
  'editing other own-profile columns still works');
select lives_ok(
  $$ update public.profiles set role = 'player' where id = auth.uid() $$,
  'sending the unchanged role (whole-profile saves) is not refused');

select * from finish();
rollback;
