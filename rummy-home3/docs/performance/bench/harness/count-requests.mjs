// Loads the REAL app services (services/*.ts via tsx) with React Native modules stubbed
// and global fetch intercepted, then replays each screen's load sequence exactly as the
// screen code does it, counting every HTTP request. Nothing touches a real backend.
//
// Run from rummy-home3/:
//   node --import ./docs/performance/bench/harness/stubs.mjs --import tsx \
//        docs/performance/bench/harness/count-requests.mjs
import path from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://perf.invalid.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';

const ROOT = process.cwd();
const mod = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const UID = '11111111-1111-4111-8111-111111111111';
const GAMES = Array.from({ length: 12 }, (_, i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`);
const SEATS = [UID, '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
const ROUNDS = 20;

let log = [];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256' })}.${b64({ sub: UID, email: 'me@example.com', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;

const profile = (id, i = 0) => ({ id, email: `p${i}@example.com`, display_name: `Player ${i}`, first_name: 'P', last_name: `${i}`, player_code: 'ABC123', public_player_no: 100 + i, player_status: 'registered', managed_by: null, role: 'player', default_settings: null });
const gameRow = (id, i) => ({ id, created_at: new Date(Date.now() - i * 864e5).toISOString(), status: i < 2 ? 'active' : 'completed', game_type: 'stake', settings: {}, current_round: ROUNDS + 1, share_code: 'X', view_token: 'tok', created_by: UID, prize: null, prize_shares: null, game_number: i + 1, closed_at: null, completed_at: null, spectator_access: false });
const gpRows = (gameId) => SEATS.map((pid, i) => ({ id: `${gameId}-${i}`, game_id: gameId, profile_id: pid, player_order: i, display_number: i + 1, role: i === 0 ? 'game_admin' : 'player', seated: true, is_active: true, profiles: profile(pid, i) }));
const scoreRows = (gameId) => Array.from({ length: ROUNDS }, (_, r) => SEATS.map((pid, i) => ({ id: `${gameId}-${r}-${i}`, round_id: `${gameId}-r${r}`, game_id: gameId, profile_id: pid, score_type: 'count', value: -10, created_at: new Date().toISOString(), rounds: { round_number: r + 1, undone_at: null } }))).flat();

globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = init?.method ?? 'GET';
  log.push({ method, path: url.pathname.replace('/rest/v1', '').replace('/auth/v1', 'auth:') });
  const headers = init?.headers ?? {};
  const single = String(headers.Accept ?? headers.accept ?? '').includes('pgrst.object');
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const p = url.pathname;
  if (p.includes('/auth/v1/token')) return json({ access_token: jwt, refresh_token: 'r2', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: UID, email: 'me@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } });
  if (p.includes('/rpc/list_visible_game_ids')) return json(GAMES);
  if (p.includes('/rpc/save_round')) return json('round-id');
  if (p.includes('/rpc/')) return json([]);
  if (p.endsWith('/profiles') || p.endsWith('/my_profile')) return json(single ? profile(UID) : [profile(UID)]);
  if (p.endsWith('/games')) {
    const ids = url.searchParams.get('id') ?? '';
    const one = ids.match(/eq\.([^,)]+)/);
    if (one) return json(single ? gameRow(one[1], GAMES.indexOf(one[1])) : [gameRow(one[1], GAMES.indexOf(one[1]))]);
    const inList = ids.match(/in\.\((.*)\)/);
    const list = inList ? inList[1].split(',').map((s) => s.replace(/"/g, '')) : GAMES;
    return json(list.map((id, i) => ({ ...gameRow(id, i), game_players: gpRows(id).map(({ profiles, ...rest }) => rest) })));
  }
  if (p.endsWith('/game_players')) return json(gpRows((url.searchParams.get('game_id') ?? '').replace('eq.', '')));
  if (p.endsWith('/scores')) {
    const g = url.searchParams.get('game_id') ?? '';
    const one = g.match(/eq\.(.+)/);
    if (one) return json(scoreRows(one[1]));
    const inList = g.match(/in\.\((.*)\)/);
    return json((inList ? inList[1].split(',').map((s) => s.replace(/"/g, '')) : []).flatMap(scoreRows));
  }
  if (p.endsWith('/rounds')) return json(single ? null : []);
  return json([]);
};

const { supabase } = await mod('services/supabase.ts');
const { authService } = await mod('services/auth.ts');
const { gamesService } = await mod('services/games.ts');
const { playerIdentityService } = await mod('services/playerIdentity.ts');
const { playersService } = await mod('services/players.ts');
const { resultsService } = await mod('services/results.ts');
const { splitHomeGames } = await mod('utils/homeGames.ts');
const { selectableResultGames } = await mod('utils/results.ts');

await supabase.auth.setSession({ access_token: jwt, refresh_token: 'r1' });
log = [];

const report = (name, serialSteps) => {
  const counts = new Map();
  log.forEach((h) => counts.set(`${h.method} ${h.path}`, (counts.get(`${h.method} ${h.path}`) ?? 0) + 1));
  console.log(`\n## ${name}: ${log.length} HTTP requests, ${serialSteps} serial round-trips before first paint`);
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(3)}  ${k}`));
  log = [];
};

const loadScorecard = async () => {
  const userId = await authService.getCurrentUserId();
  const [g, seats] = await Promise.all([gamesService.getGame(GAMES[0]), gamesService.listGamePlayers(GAMES[0])]);
  await gamesService.accessFor(GAMES[0], userId, { game: g, seats });
};

// Home: app/(tabs)/index.tsx loadData + JoinRequestsDialog + ClaimRequestsCard + app/(tabs)/_layout.tsx effects
await authService.ensureFreshSession();
const me = await authService.getCurrentPlayer();
const games = await gamesService.listGamesForCurrentUser(me.id, { limit: 50, includeScores: false, email: me.email });
await Promise.all([
  ...splitHomeGames(games).live.slice(0, 2).map((g) => gamesService.prefetchGame(g.id)),
  playerIdentityService.takeNotices(me.id).catch(() => []),
  playerIdentityService.listClaimRequests(me.id).catch(() => []),
  playerIdentityService.peekPendingClaim().catch(() => null),
  authService.getCurrentPlayer(),
  authService.getCurrentPlayer().then((p) => playersService.listMyPlayers(p.id)),
]);
report('HOME focus (cold, 2 live games)', 4);

await loadScorecard();
report('SCORECARD open (games/[id].tsx loadGameData)', 1);

{
  const userId = await authService.getCurrentUserId();
  const [g, seats] = await Promise.all([gamesService.getGame(GAMES[0]), gamesService.listGamePlayers(GAMES[0]), authService.getCurrentPlayer().catch(() => null)]);
  await gamesService.accessFor(GAMES[0], userId, { game: g, seats });
}
report('ROUND ENTRY open (score-entry.tsx loadGameData)', 1);

{
  const userId = await authService.getCurrentUserId();
  const [g, seats] = await Promise.all([gamesService.getGame(GAMES[0]), gamesService.listGamePlayers(GAMES[0]), authService.getCurrentPlayer()]);
  await gamesService.accessFor(GAMES[0], userId, { game: g, seats });
}
report('PLAYERS page open (useGameRoster.reload + getCurrentPlayer)', 1);

await gamesService.addRound({
  gameId: GAMES[0],
  roundNumber: ROUNDS + 1,
  createdBy: UID,
  scores: SEATS.map((playerId, i) => (i === 0 ? { playerId, scoreType: 'rummy', value: 40 } : { playerId, scoreType: 'count', value: -10 })),
});
report('SAVE ROUND (gamesService.addRound: save_round RPC + refetch)', 2);

{
  const events = 1 + SEATS.length + 1; // rounds insert + one scores insert per seat + games update
  for (let i = 0; i < events + 1; i += 1) await loadScorecard();
  report(`REALTIME ECHO on the scorer's own scorecard after one save (${events} postgres_changes events + 1 focus reload)`, 0);
}

{
  // app/(tabs)/players.tsx load() + app/(tabs)/_layout.tsx effects (useMyName + player count) that
  // re-run on every pathname change, + ClaimRequestsCard on the tab.
  const screen = (async () => {
    const me2 = await authService.getCurrentPlayer();
    await playersService.readMyPlayers(me2.id);
    await playersService.listMyPlayers(me2.id);
    await playerIdentityService.listUnregistered(me2.id).catch(() => []);
    await playerIdentityService.listClaimRequests(me2.id).catch(() => []);
  })();
  const layout = Promise.all([
    authService.getCurrentPlayer(),
    authService.getCurrentPlayer().then((p) => playersService.readMyPlayers(p.id).then(() => playersService.listMyPlayers(p.id))),
  ]);
  await Promise.all([screen, layout]);
}
report('MY PLAYERS tab open (players.tsx load + tabs layout effects)', 4);

{
  const id = await authService.getCurrentUserId();
  const player = await authService.getCurrentPlayer();
  const visible = await gamesService.listGamesForCurrentUser(id, { includeScores: true, email: player?.email });
  const listed = selectableResultGames(visible);
  await Promise.all(listed.map((g) => gamesService.listGamePlayers(g.id).catch(() => [])));
  await resultsService.list(0, 5);
}
report(`RESULTS page open (${GAMES.length} visible games)`, 5);
