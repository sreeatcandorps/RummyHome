-- 022 initials: one label per player per owner, unique within that owner's My players, with
-- a deterministic default (two letters, then three letters from the name, digits last),
-- a per-seat label fixed when the seat is created, and owner-only RPCs. Lists always show
-- the live profile name; a rename never changes initials.
-- Seed: sree (…0001) knows Harish Test, Priya Test, Zed Zero, R K, C D; harish (…0002) knows
-- Priya Test and A B. Game A (…000a) is sree's, with harish, priya, rk, zero seated.
begin;
select plan(55);

-- ---------- objects ----------
select has_column('public', 'my_players', 'initials', 'my_players.initials exists');
select hasnt_column('public', 'my_players', 'name_snapshot', 'names are not copied into my_players (live profile name is shown)');
select has_column('public', 'game_players', 'label', 'game_players.label exists');
select has_index('public', 'my_players', 'my_players_owner_initials_key', 'per-owner unique index exists');
select ok((select indisunique from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname = 'my_players_owner_initials_key'), 'my_players_owner_initials_key is unique');
select has_trigger('public', 'my_players', 'my_players_fill_defaults', 'my_players gets defaults on insert');
select has_trigger('public', 'game_players', 'game_players_fill_label', 'game_players gets a label on insert');

-- ---------- generator: same table as tests/initials-022.test.ts ----------
select is((public.initials_candidates('Sree Koneru'))[1:3], array['SK', 'SRK', 'SKO'], 'Sree Koneru → SK, SRK, SKO');
select is((public.initials_candidates('Suresh Kumar'))[1:9], array['SK', 'SUK', 'SKU', 'SRK', 'SEK', 'SSK', 'SHK', 'SKM', 'SKA'], 'Suresh Kumar: 2 letters, then 3-letter forms from the name');
select is((public.initials_candidates('Ravi'))[1:3], array['RA', 'RAV', 'RAI'], 'single word: RA, RAV, RAI');
select is((public.initials_candidates('Anita Rao'))[1:7], array['AR', 'ANR', 'ARA', 'AIR', 'ATR', 'AAR', 'ARO'], 'Anita Rao candidates');
select is((public.initials_candidates('Mary Jane Watson'))[1:4], array['MW', 'MAW', 'MWA', 'MJW'], 'middle name initial is the first three-letter form after the plain ones');
select is((public.initials_candidates('Player 10'))[1:3], array['PL', 'PLA', 'PLY'], 'digits in a name are not letters');
select is((public.initials_candidates(''))[1], 'PL', 'an empty name falls back to PLAYER');
select is((public.initials_candidates('Jo'))[1:2], array['JO', 'JO2'], 'a two-letter single word has no three-letter form; digits follow');
select ok((select min(ord) filter (where c ~ '[0-9]') > max(ord) filter (where c !~ '[0-9]') from unnest(public.initials_candidates('Suresh Kumar')) with ordinality t(c, ord)), 'no digit form before every letter form (Suresh Kumar)');
select ok((select bool_and(c ~ '^[A-Z]{2,3}$') from unnest((public.initials_candidates('Suresh Kumar'))[1:9]) c), 'the first nine Suresh Kumar forms are letters only');
select is((public.initials_candidates('José Núñez'))[1], 'JN', 'accents are folded');

-- ---------- seed got defaults through the trigger ----------
select tests.login('00000000-0000-4000-8000-000000000001');
select is((select initials from public.list_my_players() where id = '00000000-0000-4000-8000-000000000002'), 'HT', 'sree sees Harish Test as HT');
select is((select display_name from public.list_my_players() where id = '00000000-0000-4000-8000-000000000002'), 'Harish Test', 'list_my_players shows the profile name');
select ok((select bool_and(initials ~ '^[A-Z][A-Z0-9]{1,2}$') from public.list_my_players()), 'every row has initials');
select is((select count(distinct initials) from public.list_my_players())::int, 5, 'sree''s five players have five different labels');
select tests.logout();

-- ---------- clash on insert: later player gets three letters, earlier keeps two ----------
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
values ('00000000-0000-4000-8000-0000000000b1', 'Suresh Kumar', 'Suresh', 'Kumar', 'unregistered', '00000000-0000-4000-8000-000000000001', 'SK0001'),
       ('00000000-0000-4000-8000-0000000000b2', 'Sree Koneru', 'Sree', 'Koneru', 'unregistered', '00000000-0000-4000-8000-000000000001', 'SK0002'),
       ('00000000-0000-4000-8000-0000000000b3', 'Sunil Kohli', 'Sunil', 'Kohli', 'unregistered', '00000000-0000-4000-8000-000000000002', 'SK0003');
insert into public.my_players (owner_id, player_id) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1');
insert into public.my_players (owner_id, player_id) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2');
insert into public.my_players (owner_id, player_id) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b2');
select is((select initials from public.my_players where owner_id = '00000000-0000-4000-8000-000000000001' and player_id = '00000000-0000-4000-8000-0000000000b1'), 'SK', 'Suresh Kumar was first in sree''s list: SK');
select is((select initials from public.my_players where owner_id = '00000000-0000-4000-8000-000000000001' and player_id = '00000000-0000-4000-8000-0000000000b2'), 'SRK', 'Sree Koneru came later: SRK');
select is((select initials from public.my_players where owner_id = '00000000-0000-4000-8000-000000000002' and player_id = '00000000-0000-4000-8000-0000000000b2'), 'SK', 'in harish''s list Sree Koneru is SK: labels are per owner');

-- ---------- backfill is deterministic: oldest row first ----------
alter table public.my_players disable trigger my_players_fill_defaults;
insert into public.my_players (owner_id, player_id, created_at) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b3', now() - interval '10 days'),   -- Sunil Kohli, older
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b1', now() - interval '1 day');     -- Suresh Kumar, newer
alter table public.my_players enable trigger my_players_fill_defaults;
drop index public.my_players_owner_initials_key;
alter table public.my_players disable trigger my_players_fill_defaults;
update public.my_players set initials = null where owner_id = '00000000-0000-4000-8000-000000000002' and player_id = '00000000-0000-4000-8000-0000000000b2';
alter table public.my_players enable trigger my_players_fill_defaults;
select is((select count(*) from public.my_players where initials is null)::int, 3, 'three of harish''s rows wait for the backfill');
\i rummy-home3/supabase/migrations/022_player_initials.sql
select is((select count(*) from public.my_players where initials is null)::int, 0, 're-running 022 backfills every row');
select is((select initials from public.my_players where owner_id = '00000000-0000-4000-8000-000000000002' and player_id = '00000000-0000-4000-8000-0000000000b3'), 'SK', 'backfill: the oldest row keeps the short form (Sunil Kohli, 10 days ago)');
select is((select initials from public.my_players where owner_id = '00000000-0000-4000-8000-000000000002' and player_id = '00000000-0000-4000-8000-0000000000b1'), 'SUK', 'backfill: Suresh Kumar (1 day ago) gets SUK');
select is((select initials from public.my_players where owner_id = '00000000-0000-4000-8000-000000000002' and player_id = '00000000-0000-4000-8000-0000000000b2'), 'SRK', 'backfill: Sree Koneru (newest) gets SRK');
select has_index('public', 'my_players', 'my_players_owner_initials_key', 'the unique index is back after the re-run');

-- ---------- uniqueness per owner is enforced by the database ----------
select throws_ok(
  $$ update public.my_players set initials = 'SK' where owner_id = '00000000-0000-4000-8000-000000000001' and player_id = '00000000-0000-4000-8000-0000000000b2' $$,
  '23505', null, 'two players in one list cannot share initials');
select throws_ok(
  $$ update public.my_players set initials = '2SK' where owner_id = '00000000-0000-4000-8000-000000000001' and player_id = '00000000-0000-4000-8000-0000000000b2' $$,
  '23514', null, 'the check constraint refuses initials that do not start with a letter');

-- ---------- owner RPCs ----------
select tests.login('00000000-0000-4000-8000-000000000001');
select is(public.set_my_player_initials('00000000-0000-4000-8000-0000000000b2', 'sko'), 'SKO', 'the owner types any 2–3 letters; stored upper-case');
select throws_ok($$ select public.set_my_player_initials('00000000-0000-4000-8000-0000000000b2', 'SK') $$,
  'P0001', 'SK is already used for Suresh Kumar in your My players.', 'a clash names the other player');
select throws_ok($$ select public.set_my_player_initials('00000000-0000-4000-8000-0000000000b2', 'S2') $$,
  'P0001', 'Initials are 2 or 3 letters, A to Z.', 'digits are refused when typed');
select throws_ok($$ select public.set_my_player_initials('00000000-0000-4000-8000-0000000000b2', 'SKOR') $$,
  'P0001', 'Initials are 2 or 3 letters, A to Z.', 'four letters are refused');
select throws_ok($$ select public.set_my_player_initials('00000000-0000-4000-8000-0000000000a2', 'AB') $$,
  'P0001', 'This player is not in your My players.', 'only the owner''s own rows can be edited');
select tests.logout();

-- a profile rename shows at once in every list and changes nobody's initials
update public.profiles set display_name = 'Suresh K. Nair' where id = '00000000-0000-4000-8000-0000000000b1';
select tests.login('00000000-0000-4000-8000-000000000001');
select is((select display_name from public.list_my_players() where id = '00000000-0000-4000-8000-0000000000b1'), 'Suresh K. Nair', 'the renamed player shows the new name in My players without any action');
select is((select initials from public.list_my_players() where id = '00000000-0000-4000-8000-0000000000b1'), 'SK', 'the rename did not change the owner''s initials for him');
select tests.logout();
select tests.login('00000000-0000-4000-8000-000000000002');
select is((select initials from public.list_my_players() where id = '00000000-0000-4000-8000-0000000000b1'), 'SUK', 'nor the other owner''s');
select tests.logout();
-- the owner renaming their own placeholder: same rule, initials stay
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok($$ select * from public.update_unregistered_player('00000000-0000-4000-8000-0000000000a1', 'Ravi', 'Kiran') $$, 'owner renames a placeholder');
select is((select display_name || '/' || initials from public.list_my_players() where id = '00000000-0000-4000-8000-0000000000a1'), 'Ravi Kiran/RK', 'the list shows Ravi Kiran and keeps RK');
select tests.logout();

-- ---------- seat labels ----------
select is((select label from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000002'), 'HT', 'game A seat for harish carries sree''s initials for him');
select ok((select bool_and(label is not null) from public.game_players), 'every seeded seat has a label');
select is((select (s->>'label') from public.seat_rows_json(array['10000000-0000-4000-8000-00000000000a']::uuid[], array['10000000-0000-4000-8000-00000000000a']::uuid[], true) r, jsonb_array_elements(r.seats) s where s->>'profile_id' = '00000000-0000-4000-8000-000000000003'), 'PT', 'seat_rows_json returns the label');
-- a seat label is fixed at seat time: changing My players later does not change the game
select tests.login('00000000-0000-4000-8000-000000000001');
select is(public.set_my_player_initials('00000000-0000-4000-8000-000000000002', 'HAT'), 'HAT', 'owner changes Harish to HAT in My players');
select is((select label from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000002'), 'HT', 'the existing game still shows HT');
-- in-game edit by the creator: the game and the creator's My players both change
select is(public.set_seat_label('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', 'hy'), 'HY', 'creator edits a column label in the game');
select is((select initials from public.my_players where owner_id = '00000000-0000-4000-8000-000000000001' and player_id = '00000000-0000-4000-8000-000000000002'), 'HY', 'the creator''s My players entry follows the in-game edit');
select throws_ok($$ select public.set_seat_label('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003', 'HY') $$,
  'P0001', 'HY is already Harish Test in this game.', 'two columns in one game cannot share a label');
select tests.logout();
-- a seated player who is not an admin cannot change labels
select tests.login('00000000-0000-4000-8000-000000000003');
select throws_ok($$ select public.set_seat_label('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003', 'PRT') $$,
  '42501', null, 'a plain player cannot change initials, not even their own');
select tests.logout();

-- ---------- RLS: initials are the owner's ----------
select tests.login('00000000-0000-4000-8000-000000000002');
select is((select count(*) from public.my_players where owner_id = '00000000-0000-4000-8000-000000000001')::int, 0, 'harish cannot read sree''s rows (initials included)');
select is((select initials from public.list_my_players() where id = '00000000-0000-4000-8000-000000000003'), 'PT', 'harish''s own list shows his own labels');
select tests.logout();
select tests.anon();
select throws_ok($$ select public.set_my_player_initials('00000000-0000-4000-8000-000000000002', 'HT') $$, '42501', null, 'anon cannot call set_my_player_initials');
select tests.logout();

select * from finish();
rollback;
