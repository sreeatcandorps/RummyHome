-- 053 (D113): Find on EZ Score answers only an exact Player ID, with the name shortened to first name +
-- last initial. Names, initials, partial numbers and email addresses find nobody; My players search (030)
-- is untouched.
begin;
select plan(22);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''

-- Player IDs are assigned by sequence; read them rather than guess.
create temp table t_no as
  select (select public_player_no from public.profiles where id = :HARISH) as harish,
         (select public_player_no from public.profiles where id = :RK) as rk,
         (select max(public_player_no) + 1000 from public.profiles) as unknown;
grant select on t_no to authenticated, anon;

-- ---------- shape ----------
select has_function('public', 'search_players', array['text'], 'the signature old app builds call is kept');
select has_function('public', 'search_my_players', array['text', 'integer'], 'My players search stays');
select ok(not has_function_privilege('anon', 'public.search_players(text)', 'execute'), 'anon still cannot search');

-- ---------- the short name ----------
select is(public.short_player_name('Ravi Kumar'), 'Ravi K.', 'first name + last initial');
select is(public.short_player_name('  ravi   kumar reddy '), 'ravi R.', 'the last word gives the initial; spaces trimmed');
select is(public.short_player_name('Ravi'), 'Ravi', 'one word stays as it is');
select is(public.short_player_name(''), 'Rummy Player', 'no name');
select is(public.short_player_name(null), 'Rummy Player', 'null name');

select throws_like($$ select * from public.search_players('57') $$, '%Sign in required%', 'signed out: refused');

select tests.login(:SREE);

-- ---------- an exact Player ID finds one person ----------
select is((select count(*)::int from public.search_players((select harish from t_no)::text)), 1, 'exact id: one row');
select is((select display_name from public.search_players((select harish from t_no)::text)), 'Harish T.', 'exact id: the short name');
select is((select id from public.search_players((select harish from t_no)::text)), :HARISH::uuid, 'exact id: the right account');
select is((select player_code from public.search_players((select harish from t_no)::text)), '#' || (select harish from t_no), 'exact id: the #ID label');
select is((select count(*)::int from public.search_players(' #' || (select harish from t_no) || ' ')), 1, '#id with spaces: one row');

-- ---------- everything else finds nobody ----------
select is((select count(*)::int from public.search_players('Har')), 0, 'a name finds nobody');
select is((select count(*)::int from public.search_players('Harish Test')), 0, 'a full name finds nobody');
select is((select count(*)::int from public.search_players('HT')), 0, 'initials find nobody');
select is((select count(*)::int from public.search_players('harish@test.local')), 0, 'a full email finds nobody');
select is((select count(*)::int from public.search_players((select unknown from t_no)::text)), 0, 'an unknown id finds nobody');
select is((select count(*)::int from public.search_players((select harish from t_no)::text || 'x')), 0, 'digits with letters find nobody');
select is((select count(*)::int from public.search_players((select rk from t_no)::text)), 0, 'an unregistered player''s own number finds nobody');
select is((select count(*)::int from public.search_players('')), 0, 'empty finds nobody');

select tests.logout();
select * from finish();
rollback;
