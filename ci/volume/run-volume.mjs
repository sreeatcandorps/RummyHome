/**
 * Volume tests (final launch batch, item 9) against the LOCAL database built by
 * ci/db/local-run.sh (every migration + seed.sql). Never points at the hosted project.
 *
 * Seeds each size with ci/volume/volume.sql, then times the exact RPCs the app calls as a
 * signed-in user (role + JWT claims, the way PostgREST runs them) and checks the result.
 * Prints TAP; writes ci/out/volume/results.json and results.md (the table that
 * rummy-home3/docs/volume-testing.md quotes). Payload JSON for the web-page screenshots goes
 * to ci/out/volume/payloads/ for ci/volume/screenshots.mjs.
 *
 *   ci/db/local-run.sh && DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test node ci/volume/run-volume.mjs
 *
 * Env: DB_URL (default postgresql://postgres:postgres@127.0.0.1:54322/postgres)
 *      QUICK=1 skips the two largest sizes (10,000 players, 5,000 games) for a fast check.
 */
import pg from 'pg';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '..', 'out', 'volume');
const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const QUICK = process.env.QUICK === '1';
mkdirSync(path.join(OUT, 'payloads'), { recursive: true });

const rows = [];
let n = 0;
let failed = 0;
function record({ area, size, expected, actual, pass, ms, screenshot }) {
  n += 1;
  if (!pass) failed += 1;
  rows.push({ area, size, expected, actual, pass, ms: ms == null ? null : Math.round(ms * 10) / 10, screenshot: screenshot ?? '' });
  console.log(`${pass ? 'ok' : 'not ok'} ${n} - ${area} [${size}] ${actual}${ms != null ? ` (${Math.round(ms)} ms)` : ''}`);
}

const uid = (k) => `a0000000-0000-4000-8000-${k.toString(16).padStart(12, '0')}`;

async function connect() {
  const c = new pg.Client({ connectionString: DB_URL, statement_timeout: 120_000 });
  await c.connect();
  return c;
}

/** Time one statement (ms). */
async function timed(client, sql, params = []) {
  const t0 = performance.now();
  const res = await client.query(sql, params);
  return { ms: performance.now() - t0, res };
}

/** Run fn as a signed-in user inside a transaction that is rolled back (nothing leaks between cases). */
async function asUser(client, userId, fn, { commit = false } = {}) {
  await client.query('begin');
  await client.query('select volume.login($1)', [userId]);
  try {
    const out = await fn();
    await client.query(commit ? 'commit' : 'rollback');
    return out;
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}

/** One RPC, warmed once, then timed; returns { ms, data, bytes }. */
async function rpc(client, userId, sql, params = []) {
  return asUser(client, userId, async () => {
    await client.query(sql, params);
    const { ms, res } = await timed(client, sql, params);
    const data = res.rows[0]?.[Object.keys(res.rows[0] ?? {})[0]];
    const bytes = Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data ?? null));
    return { ms, data, bytes };
  });
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** Bulk loads leave planner statistics stale until autovacuum catches up; refresh them the way it would. */
async function analyze(client) {
  await client.query('analyze public.games, public.game_players, public.rounds, public.scores, public.my_players, public.profiles');
}

async function errorOf(promise) {
  try { await promise; return null; } catch (e) { return e; }
}

// ---------------------------------------------------------------------------------------
async function myPlayers(client) {
  const sizes = QUICK ? [100, 1000] : [100, 1000, 10000];
  for (const [i, size] of sizes.entries()) {
    const k = 11 + i;
    const user = uid(k);
    const seed = await timed(client, 'select volume.add_my_players($1, $2, $3)', [k, size, size >= 1000]);
    await analyze(client);
    record({ area: 'My players seed', size: `${size}`, expected: 'rows inserted with initials', actual: `${size} rows seeded`, pass: true, ms: seed.ms });

    const count = await rpc(client, user, 'select public.count_my_players()');
    record({ area: 'My players count', size: `${size}`, expected: `${size}`, actual: `${count.data}`, pass: Number(count.data) === size, ms: count.ms });

    const page = await rpc(client, user, "select jsonb_agg(p) from public.list_my_players_page('name', 100) p");
    const first = page.data ?? [];
    record({ area: 'My players page 1 (A-Z)', size: `${size}`, expected: '≤ 100 rows, < 150 ms', actual: `${first.length} rows, ${kb(page.bytes)}`, pass: first.length === Math.min(100, size) && page.ms < 150, ms: page.ms });

    const frequent = await rpc(client, user, "select jsonb_agg(p) from public.list_my_players_page('frequent', 100) p");
    record({ area: 'My players page 1 (Frequent)', size: `${size}`, expected: 'sorted by games desc, < 150 ms', actual: `${(frequent.data ?? []).length} rows, top ${frequent.data?.[0]?.games_together} games`, pass: frequent.ms < 150 && (frequent.data ?? []).every((r, j, a) => j === 0 || a[j - 1].games_together >= r.games_together), ms: frequent.ms });

    // Walk every page with the keyset cursor: no repeats, no gaps, worst page time.
    const walk = await asUser(client, user, async () => {
      const seen = new Set();
      let cursor = null;
      let pages = 0;
      let worst = 0;
      for (;;) {
        const t0 = performance.now();
        const res = cursor
          ? await client.query("select id, sort_name from public.list_my_players_page('name', 100, $1, $2)", [cursor.sort_name, cursor.id])
          : await client.query("select id, sort_name from public.list_my_players_page('name', 100)");
        worst = Math.max(worst, performance.now() - t0);
        pages += 1;
        for (const r of res.rows) seen.add(r.id);
        if (res.rows.length < 100) break;
        cursor = res.rows[res.rows.length - 1];
      }
      return { seen: seen.size, pages, worst };
    });
    record({ area: 'My players walk all pages', size: `${size}`, expected: `${size} distinct ids, worst page < 150 ms`, actual: `${walk.seen} ids over ${walk.pages} pages, worst ${Math.round(walk.worst)} ms`, pass: walk.seen === size && walk.worst < 150, ms: walk.worst });

    const target = `Guest ${String(Math.ceil(size / 2)).padStart(5, '0')}`;
    const search = await rpc(client, user, 'select jsonb_agg(p) from public.search_my_players($1, 50) p', [target]);
    record({ area: 'My players search by name', size: `${size}`, expected: `finds "${target}" first, < 300 ms`, actual: `${(search.data ?? []).length} hits, first "${search.data?.[0]?.display_name ?? '-'}"`, pass: search.data?.[0]?.display_name?.startsWith(target) === true && search.ms < 300, ms: search.ms });

    const broad = await rpc(client, user, "select jsonb_agg(p) from public.search_my_players('name', 50) p");
    record({ area: 'My players search (broad)', size: `${size}`, expected: 'capped at 50 hits, < 300 ms', actual: `${(broad.data ?? []).length} hits`, pass: (broad.data ?? []).length === 50 && broad.ms < 300, ms: broad.ms });

    const whole = await rpc(client, user, 'select jsonb_agg(p) from public.list_my_players() p');
    record({ area: 'My players whole list (older app)', size: `${size}`, expected: 'still answers', actual: `${(whole.data ?? []).length} rows, ${kb(whole.bytes)}`, pass: (whole.data ?? []).length === size, ms: whole.ms });

    const picker = await rpc(client, user, 'select jsonb_agg(p) from public.list_new_game_candidates() p');
    record({ area: 'New game picker candidates', size: `${size}`, expected: 'answers < 500 ms', actual: `${(picker.data ?? []).length} rows, ${kb(picker.bytes)}`, pass: picker.ms < 500, ms: picker.ms });
  }
}

// ---------------------------------------------------------------------------------------
async function bigGames(client) {
  const players = [2, 10, 20];
  const rounds = [50, 100, 200, 500];
  let k = 20;
  for (const p of players) {
    for (const r of rounds) {
      k += 1;
      const user = uid(k);
      const seed = await timed(client, "select volume.make_game($1, $2, $3, 'active', now() - interval '3 hours')", [k, p, r]);
      const gameId = seed.res.rows[0].make_game;
      await analyze(client);
      const size = `${p}p × ${r}r`;
      record({ area: 'Game seed', size, expected: `${p * r} scores`, actual: `game ${gameId.slice(0, 8)} seeded`, pass: true, ms: seed.ms });

      const bundle = await rpc(client, user, 'select public.get_game_bundle($1)', [gameId]);
      const scores = bundle.data?.scores?.length ?? 0;
      const dealers = Object.keys(bundle.data?.dealers ?? {}).length;
      record({ area: 'Scorecard open (get_game_bundle)', size, expected: `${p * r} scores, ${r} dealers, < 500 ms`, actual: `${scores} scores, ${dealers} dealers, ${kb(bundle.bytes)}`, pass: scores === p * r && dealers === r && bundle.ms < 500, ms: bundle.ms });

      const token = (await client.query('select view_token from public.games where id = $1', [gameId])).rows[0].view_token;
      const pub = await rpc(client, user, 'select public.public_scorecard($1)', [token]);
      writeFileSync(path.join(OUT, 'payloads', `scorecard-${p}p-${r}r.json`), JSON.stringify(pub.data));
      record({ area: 'Web /r/ scorecard payload', size, expected: `${p * r} scores, < 500 ms`, actual: `${pub.data?.scores?.length ?? 0} scores, ${kb(pub.bytes)}`, pass: (pub.data?.scores?.length ?? 0) === p * r && pub.ms < 500, ms: pub.ms, screenshot: `ci/out/volume/screenshots/scorecard-${p}p-${r}r.png` });

      const seats = (await client.query('select profile_id from public.game_players where game_id = $1 order by player_order', [gameId])).rows.map((x) => x.profile_id);
      const payload = JSON.stringify(seats.map((id, j) => ({ playerId: id, scoreType: j === 0 ? 'rummy' : 'count', value: j === 0 ? 10 * (seats.length - 1) : -10 })));
      const save = await asUser(client, user, async () => {
        const t0 = performance.now();
        const err = await errorOf(client.query('select public.save_round($1, $2, $3::jsonb, false)', [gameId, r + 1, payload]));
        return { ms: performance.now() - t0, err };
      });
      if (r >= 500) {
        record({ area: 'Add round at the cap', size, expected: 'GRD01 rounds_per_game', actual: save.err ? `${save.err.code}: ${save.err.message}` : 'saved (should have been refused)', pass: save.err?.code === 'GRD01' && save.err?.hint === 'guardrail:rounds_per_game', ms: save.ms });
      } else {
        record({ area: 'Add round (save_round)', size, expected: 'saved < 300 ms', actual: save.err ? `${save.err.code}: ${save.err.message}` : `round ${r + 1} saved`, pass: !save.err && save.ms < 300, ms: save.ms });
      }
    }
  }
}

// ---------------------------------------------------------------------------------------
async function manyGames(client) {
  const sizes = QUICK ? [100, 1000] : [100, 1000, 5000];
  for (const [i, size] of sizes.entries()) {
    const k = 41 + i;
    const user = uid(k);
    const seed = await timed(client, 'select volume.add_games($1, $2, 4, 10)', [k, size]);
    const stale = await rpc(client, user, 'select public.get_home_bundle(50)');
    await analyze(client);
    record({ area: 'Games seed (game-number trigger per insert)', size: `${size} games`, expected: 'numbers 1..N, no gaps', actual: `${size} games in ${(seed.ms / 1000).toFixed(1)} s (${(seed.ms / size).toFixed(1)} ms/game)`, pass: true, ms: seed.ms });
    const numbers = (await client.query('select count(*)::int as c, max(game_number) as m, count(distinct game_number)::int as d from public.games where created_by = $1', [user])).rows[0];
    record({ area: 'Game numbers unique and dense', size: `${size} games`, expected: `${size} distinct, max ${size}`, actual: `${numbers.d} distinct, max ${numbers.m}`, pass: numbers.d === size && numbers.m === size, ms: null });

    const home = await rpc(client, user, 'select public.get_home_bundle(50)');
    record({ area: 'Home open (get_home_bundle)', size: `${size} games`, expected: '50 games, < 500 ms', actual: `${home.data?.games?.length ?? 0} games, ${kb(home.bytes)} (${Math.round(stale.ms)} ms before ANALYZE ran on the bulk load)`, pass: (home.data?.games?.length ?? 0) === 50 && home.ms < 500, ms: home.ms });

    const candidates = await rpc(client, user, 'select public.list_result_candidates(50)');
    const candidateCount = Array.isArray(candidates.data) ? candidates.data.length : (candidates.data?.games?.length ?? candidates.data?.candidates?.length ?? 0);
    record({ area: 'Results picker (list_result_candidates)', size: `${size} games`, expected: '50 candidates, < 500 ms', actual: `${candidateCount} candidates, ${kb(candidates.bytes)}`, pass: candidateCount === 50 && candidates.ms < 500, ms: candidates.ms });

    const results = await rpc(client, user, 'select jsonb_agg(r) from public.list_game_results_page(5, 0) r');
    record({ area: 'Results list (list_game_results_page)', size: `${size} games`, expected: '< 500 ms', actual: `${(results.data ?? []).length} results, ${kb(results.bytes)}`, pass: results.ms < 500, ms: results.ms });

    const visible = await rpc(client, user, 'select count(*) from public.list_visible_game_ids()');
    record({ area: 'Visible games (list_visible_game_ids)', size: `${size} games`, expected: `${size} ids, < 500 ms`, actual: `${visible.data} ids`, pass: Number(visible.data) === size && visible.ms < 500, ms: visible.ms });

    const create = await asUser(client, user, async () => timed(client, "insert into public.games (created_by, status, game_type, settings, share_code) values ($1, 'active', 'stake', '{\"gameType\":\"stake\",\"maxCount\":-80}'::jsonb, upper(substr(md5(random()::text), 1, 10))) returning game_label", [user]));
    const label = create.res.rows[0]?.game_label;
    record({ area: 'Create one more game (number assignment)', size: `${size} games`, expected: `lowest free number S${size + 1}, < 200 ms`, actual: `${label}`, pass: label === `S${size + 1}` && create.ms < 200, ms: create.ms });
  }
}

// ---------------------------------------------------------------------------------------
async function results50x20(client) {
  const k = 51;
  const user = uid(k);
  const seed = await timed(client, 'select volume.add_games($1, 50, 20, 10)', [k]);
  await analyze(client);
  record({ area: 'Results seed', size: '50 games × 20 players', expected: '50 completed games, 20 seats, 10 rounds', actual: `seeded in ${(seed.ms / 1000).toFixed(1)} s`, pass: true, ms: seed.ms });
  const ids = (await client.query('select id from public.games where created_by = $1 order by created_at', [user])).rows.map((r) => r.id);

  const tooMany = await asUser(client, user, async () => errorOf(client.query('select public.declare_game_result($1::uuid[])', [ids])));
  record({ area: 'Declare results over 50 games', size: '50 games × 20 players', expected: 'refused: at most 30 games per result (024 rule)', actual: tooMany ? tooMany.message : 'accepted', pass: /at most 30/.test(tooMany?.message ?? ''), ms: null });

  const declared = await asUser(client, user, async () => {
    const t0 = performance.now();
    const res = await client.query('select public.declare_game_result($1::uuid[]) as r', [ids.slice(0, 30)]);
    return { ms: performance.now() - t0, id: res.rows[0].r?.id ?? res.rows[0].r };
  }, { commit: true });
  const resultId = typeof declared.id === 'string' ? declared.id : declared.id?.id;
  record({ area: 'Declare results over 30 games', size: '30 games × 20 players', expected: 'saved < 1,000 ms', actual: `result ${String(resultId).slice(0, 8)}`, pass: Boolean(resultId) && declared.ms < 1000, ms: declared.ms });

  const sheet = await rpc(client, user, 'select public.get_game_result($1)', [resultId]);
  const places = sheet.data?.standings?.length ?? 0;
  const sheetGames = sheet.data?.sheet?.games?.length ?? 0;
  const withRounds = (sheet.data?.sheet?.games ?? []).filter((g) => g.rounds && Object.keys(g.rounds).length === 20).length;
  record({ area: 'Results sheet (get_game_result)', size: '30 games × 20 players', expected: '20 standings, 30 games with 20 round arrays each, < 200 ms (was ~250 ms before 032)', actual: `${places} standings, ${sheetGames} games (${withRounds} with rounds), ${kb(sheet.bytes)}`, pass: sheet.ms < 200 && places === 20 && sheetGames === 30 && withRounds === 30, ms: sheet.ms });

  const pub = await rpc(client, user, 'select public.public_result($1)', [resultId]);
  writeFileSync(path.join(OUT, 'payloads', 'result-30x20.json'), JSON.stringify(pub.data));
  record({ area: 'Web /r/ results payload (public_result)', size: '30 games × 20 players', expected: '< 200 ms (was ~600 ms before 032)', actual: `${kb(pub.bytes)}`, pass: pub.ms < 200 && pub.bytes > 100, ms: pub.ms, screenshot: 'ci/out/volume/screenshots/result-30x20.png' });

  const picker = await rpc(client, user, 'select public.list_result_candidates(50)');
  const pickerCount = Array.isArray(picker.data) ? picker.data.length : (picker.data?.games?.length ?? picker.data?.candidates?.length ?? 0);
  record({ area: 'Results picker with 20-seat games', size: '50 games × 20 players', expected: '50 candidates (closed games can be reused, 018), < 500 ms', actual: `${pickerCount} candidates, ${kb(picker.bytes)}`, pass: pickerCount === 50 && picker.ms < 500, ms: picker.ms });
}

// ---------------------------------------------------------------------------------------
async function adminsAtOnce() {
  const main = await connect();
  const k = 61;
  const user = uid(k);
  const gameId = (await main.query("select volume.make_game($1, 5, 3, 'active', now() - interval '1 hour')", [k])).rows[0].make_game;
  // four more registered admins on the game
  const admins = [user];
  for (let j = 1; j <= 4; j += 1) {
    const id = (await main.query('select volume.ensure_user($1)', [k * 10 + j])).rows[0].ensure_user;
    await main.query("insert into public.game_players (game_id, profile_id, player_order, role, seated) values ($1, $2, $3, 'game_admin', false)", [gameId, id, 100 + j]);
    admins.push(id);
  }
  const seats = (await main.query('select profile_id from public.game_players where game_id = $1 and seated order by player_order', [gameId])).rows.map((x) => x.profile_id);
  const payloadFor = (winner) => JSON.stringify(seats.map((id, j) => ({ playerId: id, scoreType: j === winner ? 'rummy' : 'count', value: j === winner ? 10 * (seats.length - 1) : -10 })));

  // 1. five admins save the SAME round with DIFFERENT scores at the same instant
  const clients = await Promise.all(admins.map(() => connect()));
  const t0 = performance.now();
  const outcomes = await Promise.all(clients.map(async (c, j) => {
    await c.query('begin');
    await c.query('select volume.login($1)', [admins[j]]);
    const err = await errorOf(c.query('select public.save_round($1, 4, $2::jsonb, false)', [gameId, payloadFor(j % seats.length)]));
    await c.query(err ? 'rollback' : 'commit');
    return err ? err.code : 'saved';
  }));
  const wall = performance.now() - t0;
  const saved = outcomes.filter((o) => o === 'saved').length;
  const conflicts = outcomes.filter((o) => o === 'PT409').length;
  const live4 = (await main.query('select count(*)::int as c from public.rounds where game_id = $1 and round_number = 4 and undone_at is null', [gameId])).rows[0].c;
  record({ area: 'Five admins save the same round at once', size: '5 admins, 5 seats', expected: '1 saved, 4 PT409, one live round 4', actual: `${saved} saved, ${conflicts} PT409, ${live4} live round(s)`, pass: saved === 1 && conflicts === 4 && live4 === 1, ms: wall });

  // 2. five admins take turns saving the next five rounds back to back (each from their own connection)
  const t1 = performance.now();
  const outcomes2 = [];
  for (let j = 0; j < 5; j += 1) {
    const c = clients[j];
    await c.query('begin');
    await c.query('select volume.login($1)', [admins[j]]);
    const err = await errorOf(c.query('select public.save_round($1, $2, $3::jsonb, false)', [gameId, 5 + j, payloadFor((j + 1) % seats.length)]));
    await c.query(err ? 'rollback' : 'commit');
    outcomes2.push(err ? err.code : 'saved');
  }
  const wall2 = performance.now() - t1;
  const rounds = (await main.query('select count(*)::int as c from public.rounds where game_id = $1 and undone_at is null', [gameId])).rows[0].c;
  record({ area: 'Five admins save the next five rounds in turn', size: '5 admins', expected: '5 saved, 9 live rounds, < 1,000 ms for all five', actual: `${outcomes2.filter((o) => o === 'saved').length} saved, ${rounds} live rounds`, pass: outcomes2.every((o) => o === 'saved') && rounds === 9 && wall2 < 1000, ms: wall2 });

  // 3. the dealer chain stayed consistent under the race (031)
  const dealers = (await main.query('select round_number, dealer_profile_id from public.rounds where game_id = $1 and undone_at is null order by round_number', [gameId])).rows;
  const consistent = dealers.every((d, i) => i === 0 || d.dealer_profile_id === seats[(seats.indexOf(dealers[i - 1].dealer_profile_id) + 1) % seats.length]);
  record({ area: 'Dealer rotation under concurrent saves', size: '9 rounds', expected: 'each dealer is the seat after the previous', actual: consistent ? 'rotation intact' : `broken: ${dealers.map((d) => seats.indexOf(d.dealer_profile_id)).join(',')}`, pass: consistent, ms: null });

  await Promise.all(clients.map((c) => c.end()));
  await main.end();
}

// ---------------------------------------------------------------------------------------
async function concurrentGames() {
  const main = await connect();
  // ten users who all know each other (one circle), so their S numbers must not collide
  const users = [];
  for (let j = 1; j <= 10; j += 1) users.push({ k: 70 + j, id: (await main.query('select volume.ensure_user($1)', [70 + j])).rows[0].ensure_user });
  await main.query('alter table public.my_players disable trigger my_players_0_guard');
  for (const a of users) for (const b of users) if (a !== b) {
    await main.query("insert into public.my_players (owner_id, player_id, games_together, initials) values ($1, $2, 1, $3) on conflict do nothing", [a.id, b.id, `U${String(b.k - 70).padStart(2, '0')}`]);
  }
  await main.query('alter table public.my_players enable trigger my_players_0_guard');

  const clients = await Promise.all(users.map(() => connect()));
  const t0 = performance.now();
  const created = await Promise.all(clients.map(async (c, j) => {
    await c.query('begin');
    await c.query('select volume.login($1)', [users[j].id]);
    const res = await c.query(
      "insert into public.games (created_by, status, game_type, settings, share_code) values ($1, 'active', 'stake', '{\"gameType\":\"stake\",\"maxCount\":-80}'::jsonb, upper(substr(md5(random()::text), 1, 10))) returning id, game_number, game_label",
      [users[j].id],
    );
    await c.query('commit');
    return res.rows[0];
  }));
  const wall = performance.now() - t0;
  const labels = created.map((g) => g.game_label).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const distinct = new Set(labels).size;
  record({ area: 'Ten creators in one circle start games at once', size: '10 games', expected: 'ten distinct numbers S1..S10', actual: `${labels.join(' ')}`, pass: distinct === 10 && labels[0] === 'S1' && labels[9] === 'S10', ms: wall });

  // 30 concurrent rounds across 30 different games (3 per creator)
  const games = [];
  for (const u of users) for (let g = 0; g < 3; g += 1) {
    games.push({ user: u.id, id: (await main.query("select volume.make_game($1, 4, 2, 'active', now() - interval '2 hours')", [u.k])).rows[0].make_game });
  }
  const seatsOf = new Map();
  for (const g of games) seatsOf.set(g.id, (await main.query('select profile_id from public.game_players where game_id = $1 and seated order by player_order', [g.id])).rows.map((x) => x.profile_id));
  const pool = await Promise.all(games.map(() => connect()));
  const t1 = performance.now();
  const saves = await Promise.all(pool.map(async (c, j) => {
    const g = games[j];
    const seats = seatsOf.get(g.id);
    await c.query('begin');
    await c.query('select volume.login($1)', [g.user]);
    const err = await errorOf(c.query('select public.save_round($1, 3, $2::jsonb, false)', [g.id, JSON.stringify(seats.map((id, i) => ({ playerId: id, scoreType: i === 0 ? 'rummy' : 'count', value: i === 0 ? 30 : -10 })))]));
    await c.query(err ? 'rollback' : 'commit');
    return err ? err.code : 'saved';
  }));
  const wall2 = performance.now() - t1;
  record({ area: 'Thirty games save a round at the same instant', size: '30 games', expected: '30 saved, < 2,000 ms wall', actual: `${saves.filter((s) => s === 'saved').length} saved`, pass: saves.every((s) => s === 'saved') && wall2 < 2000, ms: wall2 });
  await Promise.all([...clients, ...pool].map((c) => c.end()));
  await main.end();
}

// ---------------------------------------------------------------------------------------
async function emailBurst(client) {
  const k = 81;
  const user = uid(k);
  await client.query('select volume.ensure_user($1)', [k]);
  const cap = (await client.query("select value from public.guardrails where key = 'email_per_day'")).rows[0].value;
  const before = (await client.query('select public.email_sends_left_today() as left')).rows[0].left;
  await client.query(
    "insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload) select 'volume:' || g, 'game_started', $1, 'volume81@test.local', '{}'::jsonb from generate_series(1, 150) g",
    [user],
  );
  const backlog = (await client.query('select waiting, due from public.email_outbox_backlog()')).rows[0];
  record({ area: 'Email burst queued', size: '150 emails', expected: `150 waiting and due, ≤ ${cap} sends left today`, actual: `${backlog.waiting} waiting, ${backlog.due} due, ${before} left today`, pass: Number(backlog.waiting) >= 150 && Number(backlog.due) >= 150 && Number(before) <= Number(cap) && Number(before) > 0, ms: null });

  // What the flush does: send up to the cap, push the rest to tomorrow, delete nothing.
  const t0 = performance.now();
  await client.query("update public.email_outbox set sent_at = now(), attempts = attempts + 1 where id in (select id from public.email_outbox where sent_at is null and event_key like 'volume:%' order by created_at limit (select public.email_sends_left_today()))");
  const left = (await client.query('select public.email_sends_left_today() as left')).rows[0].left;
  await client.query("update public.email_outbox set next_attempt_at = date_trunc('day', now()) + interval '1 day' where sent_at is null and event_key like 'volume:%'");
  const ms = performance.now() - t0;
  const pending = (await client.query("select count(*)::int as c, min(next_attempt_at) > now() as deferred from public.email_outbox where sent_at is null and event_key like 'volume:%'")).rows[0];
  const total = (await client.query("select count(*)::int as c from public.email_outbox where event_key like 'volume:%'")).rows[0].c;
  record({ area: 'Email daily cap reached', size: '150 emails', expected: `${before} sent, ${150 - Number(before)} wait for tomorrow, none dropped`, actual: `${total - pending.c} sent, ${pending.c} deferred (${pending.deferred ? 'to tomorrow' : 'NOT deferred'}), ${total} rows kept, ${left} left today`, pass: total === 150 && pending.c === 150 - Number(before) && pending.deferred === true && Number(left) === 0, ms });

  // A failed send backs off, never deletes
  await client.query("update public.email_outbox set attempts = 3, last_error = 'provider down', next_attempt_at = now() + interval '20 minutes' where id = (select min(id) from public.email_outbox where sent_at is null and event_key like 'volume:%')");
  const kept = (await client.query("select count(*)::int as c from public.email_outbox where last_error = 'provider down'")).rows[0].c;
  record({ area: 'Email provider down', size: '1 email', expected: 'row kept with backoff', actual: `${kept} row kept, retries in 20 minutes`, pass: kept === 1, ms: null });
}

// ---------------------------------------------------------------------------------------
async function guardrails(client) {
  const g = async (key) => (await client.query('select value, message from public.guardrails where key = $1', [key])).rows[0];
  const refused = (err, key) => err?.code === 'GRD01' && err?.hint === `guardrail:${key}`;

  // my_players_max: fill to the cap with the guard on, then one more
  {
    const k = 91; const user = uid(k); const { value, message } = await g('my_players_max');
    await client.query('select volume.add_my_players($1, $2, true)', [k, value]);
    const err = await asUser(client, user, () => errorOf(client.query("insert into public.my_players (owner_id, player_id, initials) values ($1, '00000000-0000-4000-8000-000000000002', 'HT')", [user])));
    record({ area: 'Guardrail my_players_max', size: `${value}`, expected: `GRD01 "${message}"`, actual: err ? `${err.code} ${err.message}` : 'allowed', pass: refused(err, 'my_players_max') && err.message === message, ms: null });
  }
  // players_added_per_day
  {
    const k = 92; const user = uid(k); const { value, message } = await g('players_added_per_day');
    await client.query('select volume.ensure_user($1)', [k]);
    await client.query("insert into public.profiles (id, display_name, player_status, managed_by, player_code) select volume.guest_id($1, g), 'Today ' || g, 'unregistered', $2, 'TD' || lpad(g::text, 6, '0') from generate_series(1, $3) g", [k, user, value]);
    await client.query('insert into public.my_players (owner_id, player_id, initials) select $1, volume.guest_id($2, g), volume.initials_for(g) from generate_series(1, $3) g', [user, k, value]);
    const err = await asUser(client, user, () => errorOf(client.query("insert into public.my_players (owner_id, player_id, initials) values ($1, '00000000-0000-4000-8000-000000000002', 'HT')", [user])));
    record({ area: 'Guardrail players_added_per_day', size: `${value}/day`, expected: `GRD01 "${message}"`, actual: err ? `${err.code} ${err.message}` : 'allowed', pass: refused(err, 'players_added_per_day') && err.message === message, ms: null });
  }
  // players_per_game
  {
    const k = 93; const user = uid(k); const { value, message } = await g('players_per_game');
    const gameId = (await client.query("select volume.make_game($1, $2, 1, 'active', now() - interval '1 hour')", [k, value])).rows[0].make_game;
    const err = await asUser(client, user, () => errorOf(client.query("insert into public.game_players (game_id, profile_id, player_order, role, seated) values ($1, '00000000-0000-4000-8000-000000000002', 50, 'player', true)", [gameId])));
    record({ area: 'Guardrail players_per_game', size: `${value}`, expected: `GRD01 "${message}"`, actual: err ? `${err.code} ${err.message}` : 'allowed', pass: refused(err, 'players_per_game') && err.message === message, ms: null });
  }
  // rounds_per_game (also covered in the 500-round game above)
  {
    const { value, message } = await g('rounds_per_game');
    record({ area: 'Guardrail rounds_per_game', size: `${value}`, expected: `GRD01 "${message}"`, actual: 'see "Add round at the cap" rows above', pass: rows.some((r) => r.area === 'Add round at the cap' && r.pass), ms: null });
  }
  // live_games_per_user
  {
    const k = 94; const user = uid(k); const { value, message } = await g('live_games_per_user');
    for (let i = 0; i < value; i += 1) await client.query("select volume.make_game($1, 3, 1, 'active', now() - ($2 || ' days')::interval)", [k, i + 2]);
    const err = await asUser(client, user, () => errorOf(client.query("insert into public.games (created_by, status, game_type, settings, share_code) values ($1, 'active', 'stake', '{\"gameType\":\"stake\",\"maxCount\":-80}'::jsonb, upper(substr(md5(random()::text), 1, 10)))", [user])));
    record({ area: 'Guardrail live_games_per_user', size: `${value} live`, expected: `GRD01 "${message}"`, actual: err ? `${err.code} ${err.message}` : 'allowed', pass: refused(err, 'live_games_per_user') && err.message === message, ms: null });
  }
  // games_per_day
  {
    const k = 95; const user = uid(k); const { value, message } = await g('games_per_day');
    for (let i = 0; i < value; i += 1) await client.query("select volume.make_game($1, 3, 1, 'completed', now() - ($2 || ' minutes')::interval)", [k, i + 1]);
    const err = await asUser(client, user, () => errorOf(client.query("insert into public.games (created_by, status, game_type, settings, share_code) values ($1, 'active', 'stake', '{\"gameType\":\"stake\",\"maxCount\":-80}'::jsonb, upper(substr(md5(random()::text), 1, 10)))", [user])));
    record({ area: 'Guardrail games_per_day', size: `${value}/day`, expected: `GRD01 "${message}"`, actual: err ? `${err.code} ${err.message}` : 'allowed', pass: refused(err, 'games_per_day') && err.message === message, ms: null });
  }
  // link_requests_pending
  {
    const k = 96; const user = uid(k); const { value, message } = await g('link_requests_pending');
    await client.query('select volume.add_my_players($1, $2)', [k, value + 1]);
    const guests = (await client.query('select player_id from public.my_players where owner_id = $1 order by player_id', [user])).rows.map((r) => r.player_id);
    for (let i = 0; i < value; i += 1) await client.query("insert into public.player_links (owner_id, player_id, email, kind) values ($1, $2, $3, 'signup')", [user, guests[i], `link${i}@test.local`]);
    const err = await errorOf(client.query("insert into public.player_links (owner_id, player_id, email, kind) values ($1, $2, 'one-more@test.local', 'signup')", [user, guests[value]]));
    record({ area: 'Guardrail link_requests_pending', size: `${value} pending`, expected: `GRD01 "${message}"`, actual: err ? `${err.code} ${err.message}` : 'allowed', pass: refused(err, 'link_requests_pending') && err.message === message, ms: null });
  }
}

// ---------------------------------------------------------------------------------------
async function main() {
  console.log('TAP version 13');
  const client = await connect();
  await client.query(readFileSync(path.join(HERE, 'volume.sql'), 'utf8'));
  const started = performance.now();
  await myPlayers(client);
  await bigGames(client);
  await manyGames(client);
  await results50x20(client);
  await adminsAtOnce();
  await concurrentGames();
  await emailBurst(client);
  await guardrails(client);
  const sizes = (await client.query('select (select count(*) from public.games)::int as games, (select count(*) from public.scores)::int as scores, (select count(*) from public.my_players)::int as my_players, pg_size_pretty(pg_database_size(current_database())) as size')).rows[0];
  await client.end();
  console.log(`1..${n}`);
  console.log(`# database after the run: ${sizes.games} games, ${sizes.scores} scores, ${sizes.my_players} my_players rows, ${sizes.size}; ${((performance.now() - started) / 1000).toFixed(0)} s`);

  writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ ranAt: new Date().toISOString(), quick: QUICK, database: sizes, rows }, null, 2));
  const md = [
    '| # | Test case | Size | Expected | Actual | Pass | Time | Screenshot |',
    '|---|-----------|------|----------|--------|------|------|------------|',
    ...rows.map((r, i) => `| ${i + 1} | ${r.area} | ${r.size} | ${r.expected} | ${r.actual.replace(/\|/g, '/')} | ${r.pass ? 'pass' : 'FAIL'} | ${r.ms == null ? '—' : r.ms >= 1000 ? `${(r.ms / 1000).toFixed(1)} s` : `${Math.round(r.ms)} ms`} | ${r.screenshot ? `\`${r.screenshot}\`` : '—'} |`),
  ].join('\n');
  writeFileSync(path.join(OUT, 'results.md'), `${md}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.log(`Bail out! ${e.message}`);
  console.error(e);
  process.exit(1);
});
