import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryCache } from '../utils/queryCache';
import { isGameBundle, isHomeBundle, legacyScoreRows, totalsAsScoreRows } from '../utils/bundles';
import { REFRESH_MARGIN_S, sessionNeedsRefresh } from '../utils/sessionFreshness';
import { debounceTrailing } from '../utils/debounce';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (path: string): string => readFileSync(join(root, path), 'utf8');
const sql = src('supabase/migrations/020_performance_rpcs_and_indexes.sql');

// ---------- queryCache (M4) ----------

test('queryCache: callers asking for the same key at the same moment share one request', async () => {
  queryCache.clear();
  let calls = 0;
  const fetcher = async () => { calls += 1; await new Promise((r) => setTimeout(r, 5)); return { calls }; };
  const [a, b, c] = await Promise.all([
    queryCache.read('t:dedupe', fetcher),
    queryCache.read('t:dedupe', fetcher),
    queryCache.read('t:dedupe', fetcher),
  ]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(queryCache.inflightCount(), 0);
});

test('queryCache: with no staleTime every read fetches again (stale-while-revalidate stays in the screens)', async () => {
  queryCache.clear();
  let calls = 0;
  const fetcher = async () => { calls += 1; return calls; };
  assert.equal(await queryCache.read('t:fresh', fetcher), 1);
  assert.equal(await queryCache.read('t:fresh', fetcher), 2);
});

test('queryCache: a memory copy younger than staleTime is served without a request; invalidate drops it', async () => {
  queryCache.clear();
  let calls = 0;
  const fetcher = async () => { calls += 1; return calls; };
  assert.equal(await queryCache.read('profile:u1', fetcher, { staleTime: 60_000 }), 1);
  assert.equal(await queryCache.read('profile:u1', fetcher, { staleTime: 60_000 }), 1);
  assert.equal(calls, 1);
  queryCache.invalidate('profile:');
  assert.equal(queryCache.peek('profile:u1'), null);
  assert.equal(await queryCache.read('profile:u1', fetcher, { staleTime: 60_000 }), 2);
});

test('queryCache: a failed fetch is not cached and releases the in-flight slot', async () => {
  queryCache.clear();
  await assert.rejects(queryCache.read('t:fail', async () => { throw new Error('boom'); }));
  assert.equal(queryCache.inflightCount(), 0);
  assert.equal(queryCache.peek('t:fail'), null);
  assert.equal(await queryCache.read('t:fail', async () => 'ok'), 'ok');
});

test('queryCache: set() primes a value that arrived inside a bundle; clear() forgets everything', async () => {
  queryCache.clear();
  queryCache.set('myPlayers:u1', [{ id: 'p1' }]);
  assert.deepEqual(await queryCache.read('myPlayers:u1', async () => { throw new Error('should not fetch'); }, { staleTime: 1000 }), [{ id: 'p1' }]);
  queryCache.clear();
  assert.equal(queryCache.size(), 0);
});

// ---------- bundle mappers (M1–M3) ----------

test('legacyScoreRows: bundle score rows become the scores…rounds(round_number, undone_at) shape the game mapper reads', () => {
  const rows = legacyScoreRows([
    { profile_id: 'a', score_type: 'count', value: -20, round_number: 2 },
    { profile_id: null, score_type: 'expense', value: 5, round_number: 1 },
  ]);
  assert.deepEqual(rows[0], { profile_id: 'a', score_type: 'count', value: -20, rounds: { round_number: 2, undone_at: null } });
  assert.equal(rows[1].profile_id, null);
  assert.deepEqual(legacyScoreRows(null), []);
});

test('totalsAsScoreRows: one count row per player so a candidate game sums to the server total', () => {
  const rows = totalsAsScoreRows({ a: 30, b: -60, c: 0 });
  assert.equal(rows.length, 3);
  assert.equal(rows.reduce((sum, row) => sum + row.value, 0), -30);
  assert.ok(rows.every((row) => row.rounds.round_number === 1 && row.rounds.undone_at === null));
  assert.deepEqual(totalsAsScoreRows(undefined), []);
});

test('bundle guards reject anything that is not the expected shape, so the app falls back to the old requests', () => {
  assert.equal(isGameBundle({ game: {}, game_players: [], scores: [] }), true);
  assert.equal(isGameBundle({ game: {} }), false);
  assert.equal(isGameBundle(null), false);
  assert.equal(isHomeBundle({ profile: null, games: [] }), true);
  assert.equal(isHomeBundle({ games: 'no' }), false);
  assert.equal(isHomeBundle([]), false);
});

// ---------- session freshness (Q4) ----------

test('ensureFreshSession refreshes only when the token is within five minutes of expiry', () => {
  const now = 1_700_000_000_000;
  const seconds = now / 1000;
  assert.equal(REFRESH_MARGIN_S, 300);
  assert.equal(sessionNeedsRefresh({ expires_at: seconds + 3600 }, now), false);
  assert.equal(sessionNeedsRefresh({ expires_at: seconds + 299 }, now), true);
  assert.equal(sessionNeedsRefresh({ expires_at: seconds - 10 }, now), true);
  assert.equal(sessionNeedsRefresh({ expires_at: null }, now), true, 'no expiry: refresh as before');
  assert.equal(sessionNeedsRefresh(null, now), false, 'no session: nothing to refresh');
});

// ---------- realtime debounce (Q3) ----------

test('debounceTrailing: a burst of realtime events runs the reload once, after the quiet period', async () => {
  let runs = 0;
  const fn = debounceTrailing(() => { runs += 1; }, 20);
  fn(); fn(); fn(); fn(); fn();
  assert.equal(runs, 0);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(runs, 1);
  fn();
  fn.cancel();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(runs, 1, 'cancel drops the pending run');
});

test('the scorecard channel follows games, game_players and rounds, debounced, and no longer scores or token_ledger', () => {
  const realtime = src('services/realtime.ts');
  assert.match(realtime, /table: 'games'/);
  assert.match(realtime, /table: 'game_players'/);
  assert.match(realtime, /table: 'rounds'/);
  assert.doesNotMatch(realtime, /table: 'scores'/);
  assert.doesNotMatch(realtime, /token_ledger/);
  assert.match(realtime, /debounceTrailing\(handlers\.onChange, REALTIME_DEBOUNCE_MS\)/);
});

// ---------- services wiring (M1–M3, Q4, Q5) ----------

test('getGame, listGamePlayers and prefetchGame all go through one deduped get_game_bundle loader with a PGRST202 fallback', () => {
  const games = src('services/games.ts');
  assert.equal((games.match(/await loadGameBundle\(gameId\)/g) ?? []).length, 3);
  assert.match(games, /supabase\.rpc\('get_game_bundle', \{ p_game_id: gameId \}\)/);
  assert.match(games, /if \(missingRpc\(error\)\) \{\s*gameBundleAvailable = false;/);
  assert.match(games, /queryCache\.read\(GAME_KEY\(gameId\)/);
});

test('the Results picker asks list_result_candidates once and keeps the per-game fallback for a pre-020 database', () => {
  const games = src('services/games.ts');
  assert.match(games, /supabase\.rpc\('list_result_candidates', \{ p_limit: 50 \}\)/);
  assert.match(games, /if \(error && !missingRpc\(error\)\) throw error;/);
  assert.match(games, /listGamesForCurrentUser\(currentUserId, \{ includeScores: true, email \}\)/);
  const picker = src('app/(screens)/results/index.tsx');
  assert.match(picker, /gamesService\.listResultCandidates\(id, player\?\.email\)/);
  assert.doesNotMatch(picker, /listGamePlayers/);
});

test('Home loads through get_home_bundle with the old sequence as fallback and primes profile and My Players', () => {
  const home = src('services/home.ts');
  assert.match(home, /supabase\.rpc\('get_home_bundle', \{ p_limit: HOME_GAME_LIMIT \}\)/);
  assert.match(home, /homeBundleAvailable = false/);
  assert.match(home, /authService\.primeProfile\(data\.profile\)/);
  assert.match(home, /playersService\.primeMyPlayers\(player\.id, data\.my_players/);
  assert.match(home, /gamesService\.listGamesForCurrentUser\(player\.id, \{\s*limit: HOME_GAME_LIMIT,\s*includeScores: false,/);
  const screen = src('app/(tabs)/index.tsx');
  assert.match(screen, /homeService\.load\(\)/);
  assert.match(screen, /preloaded=\{claimRequests\}/);
});

test('the own profile is memoised and every write to it forgets the copy', () => {
  const auth = src('services/auth.ts');
  assert.match(auth, /queryCache\.read\(PROFILE_KEY\(userId\), \(\) => fetchOwnProfile\(userId\), \{ staleTime: PROFILE_STALE_MS \}\)/);
  assert.match(auth, /if \(!sessionNeedsRefresh\(session\)\) return session;/);
  assert.ok((auth.match(/forgetProfile\(\)/g) ?? []).length >= 4, 'sign-in, sign-up, updateProfile, updatePhone');
  assert.match(auth, /queryCache\.clear\(\)/);
  assert.match(src('services/userSettings.ts'), /queryCache\.invalidate\('profile:'\)/);
});

test('My Players: one request per 30 s shared by the tab bar and the screen, roster written only when it changed', () => {
  const players = src('services/players.ts');
  assert.match(players, /MY_PLAYERS_STALE_MS = 30_000/);
  assert.match(players, /if \(!options\.partial && !rosterChanged\(mine, players\)\) return;/);
  assert.ok((players.match(/this\.forgetMyPlayers\(\)/g) ?? []).length >= 3, 'add, remove, rememberTogether');
  assert.match(src('services/playerIdentity.ts'), /if \(!READ_ONLY_RPCS\.has\(name\)\) playersService\.forgetMyPlayers\(\);/);
  const screen = src('app/(tabs)/players.tsx');
  assert.match(screen, /const firstPage = playersService\.listMyPlayersPage\(player\.id, currentSort, null\);[\s\S]*const open = playerIdentityService\.listUnregistered/, 'the first page (030) and the open set load side by side');
  assert.match(screen, /const shown = useMemo\(/);
  assert.match(screen, /const PlayerCard = React\.memo\(/);
});

test('round entry seeds its grid from the cached game and seats', () => {
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /gameCache\.peekGame\(gameId/);
  assert.match(entry, /gameCache\.peekSeats\(gameId/);
  assert.match(entry, /useState\(!seeded\)/);
});

// ---------- screens (M5, M6, Q6) ----------

test('Home draws the Recent rows with a FlatList and still shows every live game, with no paging and no new filter', () => {
  const screen = src('app/(tabs)/index.tsx');
  assert.match(screen, /<ScreenList\s/);
  assert.match(screen, /data=\{finished\}/);
  assert.match(screen, /live\.map\(\(game\) => <HomeGameRow/);
  assert.doesNotMatch(screen, /Show more/);
  assert.doesNotMatch(screen, /onEndReached/);
  assert.doesNotMatch(screen, /Chip/);
  assert.match(screen, /part="top"/);
  assert.match(screen, /<SectionCardEnd \/>/);
});

test('the split Recent card adds up to the whole card: head open at the bottom, rows with the gap, closing edge with the padding', () => {
  const card = src('components/ui/SectionCard.tsx');
  assert.match(card, /top: \{\s*borderBottomWidth: 0,[\s\S]*?paddingBottom: 0,\s*\}/);
  assert.match(card, /rows: \{[\s\S]*?paddingTop: spacing\.md,\s*\}/);
  assert.match(card, /end: \{[\s\S]*?height: spacing\.lg \+ BORDER,\s*\}/);
});

test('ScoreTable rows are memoised by value so a reload redraws only changed rounds', () => {
  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /const ScoreRow = React\.memo\(/);
  assert.match(table, /sameColumns\(prev\.columns, next\.columns\)\s*&& sameCells\(prev\.cells, next\.cells\)/);
});

test('icons come from subpath imports and the in-app logo is the small asset; the launcher icon stays 1024', () => {
  assert.match(src('app/(tabs)/_layout.tsx'), /from '@expo\/vector-icons\/Ionicons'/);
  assert.match(src('components/share/ShareCardView.tsx'), /from '@expo\/vector-icons\/MaterialCommunityIcons'/);
  for (const path of ['app/(tabs)/_layout.tsx', 'app/index.tsx', 'components/ui/AuthShell.tsx']) {
    assert.match(src(path), /assets\/icon-small\.png/, path);
    assert.doesNotMatch(src(path), /assets\/icon\.png'/, path);
  }
  assert.match(src('app.json'), /"icon": "\.\/assets\/icon\.png"/);
});

test('dead code is gone: stray expo-router copies, dead modules, unused native deps', () => {
  const pkg = JSON.parse(src('package.json'));
  assert.equal(pkg.dependencies['expo-sms'], undefined);
  assert.equal(pkg.dependencies['react-native-vector-icons'], undefined);
  for (const gone of ['hooks/useAuth.ts', 'components/DevTools.tsx', 'services/stats.ts', 'components/PlayerAvatar.tsx', '_ctx.js', 'entry.js', 'index.tsx', '_layout.tsx']) {
    assert.throws(() => src(gone), gone);
  }
});

// ---------- migration 020 shape (the semantics are in supabase/tests/10_bundles_020.sql) ----------

test('020 adds the three visibility indexes, the union RPC rewrites and the (select …) policy wrappers', () => {
  for (const index of ['game_results_declared_by_idx', 'player_links_owner_pending_idx', 'creator_notices_owner_open_idx']) {
    assert.match(sql, new RegExp(`create index if not exists public\\.${index}|create index if not exists ${index}`), index);
  }
  for (const fn of ['list_visible_game_ids', 'list_new_game_candidates', 'list_game_results_page', 'get_game_bundle', 'get_home_bundle', 'list_result_candidates', 'get_game_result']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`), fn);
  }
  assert.match(sql, /using \(\(select public\.is_app_admin\(\)\) or/);
  assert.match(sql, /\(select auth\.uid\(\)\)/);
  assert.match(sql, /\(select public\.is_game_member\(/);
});

test('020 bundles never expose email, phone or zip and keep the 019 role lock and profile grants', () => {
  const start = sql.indexOf('create or replace function public.profile_fields_json');
  assert.ok(start > 0, 'bundle section present');
  const bundleSection = sql.slice(start);
  assert.doesNotMatch(bundleSection, /'email'|\.email\b|'phone'|\.phone\b|zip_code/);
  assert.doesNotMatch(sql, /drop trigger[^;]*lock_profile_role/i);
  assert.doesNotMatch(sql, /grant select on (table )?public\.profiles to/i);
  assert.doesNotMatch(sql, /alter table public\.profiles disable row level security/i);
  assert.match(sql, /set jit = off/);
  assert.match(sql, /revoke all on function public\.get_home_bundle/);
  assert.match(sql, /grant execute on function public\.get_home_bundle\(integer\) to authenticated/);
});

test('020 has a rollback that leaves 019 in place, and CI replays it', () => {
  const rollback = src('supabase/rollback/rollback_020_performance_rpcs_and_indexes.sql');
  assert.match(rollback, /drop function if exists public\.get_home_bundle/);
  assert.match(rollback, /drop function if exists public\.get_game_bundle/);
  assert.match(rollback, /drop index if exists public\.player_links_owner_pending_idx/);
  assert.doesNotMatch(rollback, /lock_profile_role/);
  assert.match(src('../ci/db/replay-rollbacks.sh'), /020_performance_rpcs_and_indexes/);
  assert.match(src('supabase/tests/10_bundles_020.sql'), /select plan\(61\)/);
});
