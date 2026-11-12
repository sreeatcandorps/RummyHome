-- 030 My players at scale: keyset pages in A-Z and Frequent order, server search by name,
-- initials or Player ID, and one count for the header. Checked on the seed roster and on a
-- 2,000-row roster built here.
-- Seed: sree (…0001) knows harish HT (3 games), priya PT (2), zero ZZ (1), rk RK (1), cd CD (1).
begin;
select plan(36);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set CD '''00000000-0000-4000-8000-0000000000a3'''

-- ---------- objects and grants ----------
select has_function('public', 'list_my_players_page', array['text', 'integer', 'text', 'uuid', 'integer']);
select has_function('public', 'search_my_players', array['text', 'integer']);
select has_function('public', 'count_my_players', array[]::text[]);
select has_function('public', 'list_my_players', array[]::text[], 'the 027 whole-list function stays for older apps');
select ok(has_function_privilege('authenticated', 'public.list_my_players_page(text, integer, text, uuid, integer)', 'execute'), 'signed-in users can page');
select ok(not has_function_privilege('anon', 'public.search_my_players(text, integer)', 'execute'), 'anon cannot search');
select has_index('public', 'profiles', 'profiles_display_name_lower_idx', 'case-folded name index');
select has_index('public', 'my_players', 'my_players_owner_active_idx', 'owner + games_together partial index');

select tests.anon();
select throws_ok($$ select * from public.search_my_players('ha') $$, '42501', null, 'anon: permission denied');
select tests.logout();

-- ---------- sree's seed roster ----------
select tests.login(:SREE);
select is(public.count_my_players(), 5, 'sree has five active My players');
select is((select array_agg(display_name order by sort_name) from public.list_my_players_page('name', 100)),
          (select array_agg(display_name order by lower(display_name)) from public.list_my_players()), 'A-Z page one lists the same five people as list_my_players');
select is((select display_name from public.list_my_players_page('frequent', 1)), 'Harish Test', 'Frequent: harish (3 games) first');
-- page of two, then the cursor from the last row
select is((select count(*) from public.list_my_players_page('name', 2)), 2::bigint, 'a page of two');
select is((select array_agg(p.display_name order by p.sort_name) from public.list_my_players_page('name', 100,
            (select sort_name from public.list_my_players_page('name', 2) order by sort_name desc limit 1),
            (select id from public.list_my_players_page('name', 2) order by sort_name desc, id desc limit 1)) p),
          (select array_agg(display_name order by lower(display_name)) from (select display_name from public.list_my_players() order by lower(display_name) offset 2) t),
          'the next A-Z page starts after the cursor and holds the other three');
select is((select array_agg(display_name order by games_together desc, sort_name) from public.list_my_players_page('frequent', 100,
            (select sort_name from public.list_my_players_page('frequent', 1)),
            (select id from public.list_my_players_page('frequent', 1)),
            (select games_together from public.list_my_players_page('frequent', 1)))),
          (select array_agg(display_name order by games_together desc, lower(display_name)) from public.list_my_players() where id <> '00000000-0000-4000-8000-000000000002'),
          'the next Frequent page starts after harish');
select is((select count(*) from public.list_my_players_page('name', 0)), 1::bigint, 'the limit is clamped to at least one');
select is((select count(*) from public.list_my_players_page('name', 1000)), 5::bigint, 'and at most 200 (five here)');

-- search
select is((select array_agg(display_name) from public.search_my_players('hari')), array['Harish Test'], 'a name part finds harish');
select is((select array_agg(display_name) from public.search_my_players('PT')), array['Priya Test'], 'initials find priya');
select is((select array_agg(display_name) from public.search_my_players('#' || (select public_player_no from public.profiles where id = :ZERO)::text)),
          array[(select display_name from public.profiles where id = :ZERO)], 'a Player ID with # finds the exact player');
select is((select array_agg(display_name) from public.search_my_players((select public_player_no from public.profiles where id = :RK)::text)),
          array['R K'], 'a Player ID without # too');
select is((select count(*) from public.search_my_players('harish@test.local')), 0::bigint, 'an email matches nobody');
select is((select count(*) from public.search_my_players('')), 0::bigint, 'an empty query returns nothing (the page list is for that)');
select is((select count(*) from public.search_my_players('zzzznothing')), 0::bigint, 'no match: empty');
select ok(not exists (select 1 from public.search_my_players('a') where id = :OUTSIDER), 'only the caller''s roster is searched');
select tests.logout();

-- harish sees his own roster only
select tests.login(:HARISH);
select is(public.count_my_players(), 2, 'harish has two');
select is((select count(*) from public.search_my_players('pri')), 1::bigint, 'harish finds priya in his roster');
select tests.logout();

-- ---------- 2,000 rows for the outsider ----------
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
select ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       chr(65 + (n % 26)) || 'name ' || lpad(n::text, 4, '0'), chr(65 + (n % 26)) || 'name', lpad(n::text, 4, '0'), 'unregistered', :OUTSIDER, 'BLK' || lpad(n::text, 6, '0')
  from generate_series(1, 2000) n;
insert into public.my_players (owner_id, player_id, created_at, games_together, initials)
select :OUTSIDER, ('b0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now() - interval '2 days', n % 37, chr(65 + n / 100) || lpad((n % 100)::text, 2, '0')
  from generate_series(1, 2000) n;

select tests.login(:OUTSIDER);
select is(public.count_my_players(), 2000, 'the outsider has 2,000');
select is((select count(*) from public.list_my_players_page('name', 100)), 100::bigint, 'a page of 100');
select is((select display_name from public.list_my_players_page('name', 1)), 'Aname 0026', 'A-Z: the first A-name (0026 sorts before 0052)');
-- walk every page in A-Z order and make sure nothing is skipped or repeated
create temp table walk (id uuid primary key, pos serial);
do $$
declare
  v_name text := null;
  v_id uuid := null;
  v_count integer;
begin
  loop
    insert into walk (id)
    select p.id from public.list_my_players_page('name', 200, v_name, v_id) p order by p.sort_name, p.id;
    get diagnostics v_count = row_count;
    exit when v_count = 0;
    select p.sort_name, p.id into v_name, v_id
      from public.list_my_players_page('name', 200, v_name, v_id) p order by p.sort_name desc, p.id desc limit 1;
  end loop;
end $$;
select is((select count(*) from walk), 2000::bigint, 'walking A-Z pages of 200 visits all 2,000 exactly once (the primary key forbids repeats)');
select is((select array_agg(display_name) from public.search_my_players('name 1234')), array['Mname 1234'], 'search finds one of 2,000 by a name part');
select is((select count(*) from public.search_my_players('Bname')), 50::bigint, 'the default search limit is 50 (77 B-names exist)');
select is((select count(*) from public.search_my_players('Bname', 200)), 77::bigint, 'with a limit of 200 all 77 B-names come back');
select is((select array_agg(display_name) from public.search_my_players('T05')), array['Hname 1905'], 'initials prefix finds the one row with initials T05');
select tests.logout();

-- timing guard: the three calls stay fast at 2,000 rows (a loose bound; the CI box is slow)
select tests.login(:OUTSIDER);
select ok((select extract(epoch from (clock_timestamp() - t0)) < 0.5 from (select clock_timestamp() as t0) s, lateral (select count(*) from public.list_my_players_page('frequent', 100)) c),
          'a Frequent page of 100 from 2,000 rows takes under 500 ms');
select tests.logout();

select * from finish();
rollback;
