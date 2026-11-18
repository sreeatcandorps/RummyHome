import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  appendPage,
  mergeSearchResults,
  MY_PLAYERS_PAGE_SIZE,
  MY_PLAYERS_SEARCH_LIMIT,
  nextPageCursor,
  SEARCH_FULL_NOTE,
  sectionLetter,
  sectionsByLetter,
  shouldLoadMore,
} from '../utils/myPlayersList';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('030: pages carry a keyset cursor and never repeat a row', () => {
  const page = Array.from({ length: MY_PLAYERS_PAGE_SIZE }, (_, i) => ({ id: `p${i}`, name: `Name ${String(i).padStart(3, '0')}`, gamesTogether: 100 - i, sortName: `name ${String(i).padStart(3, '0')}` }));
  assert.deepEqual(nextPageCursor(page, MY_PLAYERS_PAGE_SIZE), { afterName: 'name 099', afterId: 'p99', afterGames: 1 }, 'the cursor is the last row of a full page');
  assert.equal(nextPageCursor(page.slice(0, 40), MY_PLAYERS_PAGE_SIZE), null, 'a short page is the last page');
  assert.equal(nextPageCursor([], MY_PLAYERS_PAGE_SIZE), null);
  assert.deepEqual(nextPageCursor([{ id: 'x', name: 'Zed Z' }], 1), { afterName: 'zed z', afterId: 'x', afterGames: 0 }, 'without a server sort key the lower-cased name stands in');
  const merged = appendPage(page.slice(0, 3), [page[2], page[3]]);
  assert.deepEqual(merged.map((r) => r.id), ['p0', 'p1', 'p2', 'p3'], 'a row that moved between pages is shown once');
  assert.equal(shouldLoadMore(true, false), true);
  assert.equal(shouldLoadMore(true, true), false, 'not while a page is loading');
  assert.equal(shouldLoadMore(false, false), false, 'not after the last page');
});

test('030: A–Z sections follow list order, file digits and symbols under #, and keep You on top', () => {
  assert.equal(sectionLetter('harish'), 'H');
  assert.equal(sectionLetter(' Ärni'), 'Ä', 'a non-ASCII letter is its own heading');
  assert.equal(sectionLetter('42 Rao'), '#');
  assert.equal(sectionLetter(''), '#');
  const players = [
    { id: 'me', name: 'Sree Koneru' },
    { id: 'a1', name: 'Anil' }, { id: 'a2', name: 'anjali' },
    { id: 'b1', name: 'Bala' },
    { id: 'n1', name: '7 Up' },
  ];
  const sections = sectionsByLetter(players, 'me');
  assert.deepEqual(sections.map((s) => [s.title, s.data.map((p) => p.id)]), [
    ['You', ['me']], ['A', ['a1', 'a2']], ['B', ['b1']], ['#', ['n1']],
  ]);
  assert.deepEqual(sectionsByLetter([], 'me'), []);
});

test('030: search merges the server answer with local matches and says when it is full', () => {
  const local = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(mergeSearchResults(local, null), local, 'before the server answers the local matches show');
  assert.deepEqual(mergeSearchResults(local, [{ id: 'c' }, { id: 'a' }]).map((r) => r.id), ['c', 'a', 'b'], 'server rows first, local-only rows kept');
  assert.equal(MY_PLAYERS_SEARCH_LIMIT, 50);
  assert.equal(SEARCH_FULL_NOTE(50), 'Showing the first 50 matches. Type more to narrow it down.');
});

test('030: the screen pages from the database, shows sections for A–Z, and searches the server; the picker searches beyond its page', () => {
  const screen = src('app/(tabs)/players.tsx');
  assert.match(screen, /playersService\.listMyPlayersPage\(player\.id, currentSort, null\)/, 'first page on load');
  assert.match(screen, /playersService\.listMyPlayersPage\(me\.id, sort, cursor\)/, 'next page on scroll');
  assert.match(screen, /onEndReached=\{onEndReached\}/);
  assert.match(screen, /<SectionList[\s\S]*stickySectionHeadersEnabled/, 'A–Z sections with sticky headers');
  assert.match(screen, /sort === 'name' && !query\.trim\(\) \? sectionsByLetter\(shown, me\?\.id\) : null/, 'sections only in alphabetical order without a search');
  assert.match(screen, /playersService\.searchMyPlayers\(me\.id, trimmed\)/, 'server search after the debounce');
  assert.match(screen, /MY_PLAYERS_SEARCH_DEBOUNCE_MS/);
  assert.match(screen, /title: `My players · \$\{total \?\? players\.length\}`/, 'the header counts everyone, not the loaded page');
  assert.match(screen, /filter === 'unregistered' && hasMore && !loadingMore\) void loadMore\(\)/, 'the Unregistered filter pulls in every page');

  const picker = src('app/(screens)/games/new.tsx');
  assert.match(picker, /playersService\.searchMyPlayers\(me\.id, trimmed\)/, 'the picker asks the server for people beyond its recent-first page');
  assert.match(picker, /mergeSearchResults\(others\.filter/);
  assert.match(src('utils/playerIdentity.ts'), /lastPlayedAt >= now\(\) - interval '14 days'|recent/i, 'recent partners come first');

  const service = src('services/players.ts');
  assert.match(service, /supabase\.rpc\('list_my_players_page'/);
  assert.match(service, /supabase\.rpc\('search_my_players'/);
  assert.match(service, /supabase\.rpc\('count_my_players'/);
  assert.match(service, /if \(!missingRpc\(rpc\.error\)\) throw rpc\.error;\s*supportsPaging = false;/, 'an older server falls back to the whole list, once');
  assert.match(service, /rememberMyPlayers\(ownerId, page, \{ partial: page\.length >= pageSize \}\)/, 'a first page refreshes the offline copy without dropping the rest');
});

test('030: the migration adds only new functions and the two indexes', () => {
  const sql = src('supabase/migrations/030_my_players_at_scale.sql');
  assert.match(sql, /create or replace function public\.list_my_players_page\(/);
  assert.match(sql, /create or replace function public\.search_my_players\(p_query text, p_limit integer default 50\)/);
  assert.match(sql, /create or replace function public\.count_my_players\(\)/);
  assert.doesNotMatch(sql, /create or replace function public\.list_my_players\(\)/, 'list_my_players (027) is untouched for the old APK and the home bundle');
  assert.match(sql, /limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/, 'page size clamped to 1..200');
  assert.match(sql, /position\('@' in q\.text_\) = 0/, 'an email matches nobody');
  assert.match(sql, /create index if not exists profiles_display_name_lower_idx/);
  assert.match(sql, /create index if not exists my_players_owner_active_idx/);
  src('supabase/rollback/rollback_030_my_players_at_scale.sql');
});
