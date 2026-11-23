/**
 * Staging population — docs/test-environment-plan.md §3 ("Fill it up").
 *
 * Builds a believable 18-month history so screens are judged on what a busy app really shows:
 * 2,000 accounts in 150 circles, 20,000 games (70 % Points / 30 % Pool), 3,000 results, 60 live
 * games, one power user ("Sree at scale": 1,500 games, 400 My players, 120 results) and one
 * 20 × 500 pool table. Deterministic: the same SCALE gives the same population every time.
 *
 * Targets ONLY the local CI database or the ezscore-staging project. The live project's host is
 * refused: DB_URL must be loopback or carry the staging ref (erurahfybkxemgtkfzkn).
 *
 *   ci/db/local-run.sh && DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test SCALE=0.05 node ci/volume/seed-staging.mjs
 *   DB_URL=<staging pooler URL from the EAS/GitHub secret> node ci/volume/seed-staging.mjs      # full set, ~10 min
 *
 * Env: DB_URL   connection string (never printed)
 *      SCALE    0 < SCALE <= 1, scales every count (default 1). Minimums keep the shape at any scale.
 *      WIPE=1   remove everything this script created (people, guests, games, results) before seeding.
 *      OUT      where summary.json goes (default ci/out/staging-seed)
 *
 * Seeding staging itself waits for Sree's yes (Q12); this script is the generator, not the trigger.
 */
import pg from 'pg';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { allowedTarget, SCALE, SIZES, STAGING_REF } from './seed-staging-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '..', 'out', 'staging-seed');
const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const WIPE = process.env.WIPE === '1';

const POWER = 1; // person #1 is "Sree at scale"
const MONTHS = 18;

// mulberry32: small, deterministic, good enough for a population.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261121);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
/** Skewed towards lo: median ~ lo + (hi-lo)/5. */
const skewed = (lo, hi) => lo + Math.floor((hi - lo) * rand() ** 2.3);
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (arr, k) => shuffle(arr).slice(0, k);
const personId = (n) => `c0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const guestId = (owner, g) => `d${owner.toString(16).padStart(7, '0')}-0000-4000-8000-${g.toString(16).padStart(12, '0')}`;
const daysAgo = (d, minutes = 0) => new Date(Date.now() - d * 86400000 - minutes * 60000).toISOString();

const steps = [];
async function step(name, fn) {
  const t0 = performance.now();
  const out = await fn();
  const ms = Math.round(performance.now() - t0);
  steps.push({ name, ms, out: typeof out === 'number' ? out : undefined });
  console.log(`${name}${typeof out === 'number' ? ` → ${out.toLocaleString()}` : ''} (${(ms / 1000).toFixed(1)} s)`);
  return out;
}

/** Run fn signed in as uid inside one committed transaction (PostgREST shape: role + JWT claims). */
async function asUser(client, uid, fn) {
  await client.query('begin');
  try {
    await client.query('select staging.login($1)', [uid]);
    const out = await fn();
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}

const GUARDS = [['games', 'games_0_guard'], ['game_players', 'game_players_0_guard'], ['my_players', 'my_players_0_guard']];
/** Everyone in `members` knows everyone. Chunked by owner (20 a time) so a 241-person circle is ~12 short statements
 *  with a progress line, not one 58k-row insert that runs for minutes in silence. */
async function knowEachOther(client, members) {
  const CHUNK = 20;
  if (members.length <= 2 * CHUNK) {
    await client.query('select staging.know_each_other($1::uuid[])', [members]);
    return;
  }
  for (let i = 0; i < members.length; i += CHUNK) {
    await client.query('select staging.know_each_other_from($1::uuid[], $2::uuid[])', [members.slice(i, i + CHUNK), members]);
    console.log(`  … know each other ${Math.min(i + CHUNK, members.length).toLocaleString()} / ${members.length.toLocaleString()} owners`);
  }
}

async function guards(client, on) {
  for (const [table, trig] of GUARDS) await client.query(`alter table public.${table} ${on ? 'enable' : 'disable'} trigger ${trig}`);
}

/** Circle: a group that always plays together. Regulars sit in 1–3 circles, one-timers in exactly one. */
function buildCircles(S) {
  const regulars = Array.from({ length: S.regulars }, (_, i) => i + 1);
  const others = Array.from({ length: S.people - S.regulars }, (_, i) => S.regulars + 1 + i);
  const circles = Array.from({ length: S.circles }, () => []);
  for (const p of regulars) for (const c of sample(circles, between(1, 3))) c.push(p);
  others.forEach((p, i) => circles[i % circles.length].push(p));
  return circles.map((members) => {
    const uniq = [...new Set(members)];
    return uniq.length >= 4 ? uniq.slice(0, 20) : [...uniq, ...sample(regulars, 4 - uniq.length)];
  });
}

/** One game's recipe. Players come from one circle; the first is the creator. */
function gameRecipe(circle, { live = false, creator = null } = {}) {
  const size = Math.min(circle.length, Math.max(2, Math.round(2 + 18 * rand() ** 2.6)));
  let players = sample(circle, size);
  if (creator != null) players = [creator, ...players.filter((p) => p !== creator)].slice(0, Math.max(2, size));
  const type = rand() < 0.3 ? 'pool' : 'stake';
  const rounds = live ? between(1, 12) : skewed(3, 60);
  const joined = players.length >= 4 && rand() < 0.08 ? between(2, Math.max(2, rounds - 1)) : 1;
  const deleted = !live && rand() < 0.05;
  const age = live ? rand() * 0.2 : rand() * MONTHS * 30.4;
  return {
    players: players.map(personId),
    rounds,
    type,
    status: live ? 'active' : 'completed',
    createdAt: daysAgo(age, live ? 0 : between(60, 23 * 60)),
    multiplier: type === 'stake' && rand() < 0.15 ? pick([2, 2, 5, 10, 100]) : 1,
    poolLimit: pick([101, 101, 101, 201, 251, 501]),
    joined,
    deleted,
    archived: !live && !deleted && rand() < 0.01,
    hiddenBy: !live && rand() < 0.03 ? personId(players[players.length - 1]) : null,
  };
}

async function makeGames(client, recipes) {
  const ids = [];
  for (let i = 0; i < recipes.length; i += 200) {
    const batch = recipes.slice(i, i + 200);
    const res = await client.query(
      `select staging.make_game((select array_agg(x::uuid) from jsonb_array_elements_text(g->'players') x), (g->>'rounds')::int, g->>'type',
                                g->>'status', (g->>'createdAt')::timestamptz, (g->>'multiplier')::int, (g->>'poolLimit')::int,
                                (g->>'joined')::int, (g->>'deleted')::boolean, nullif(g->>'hiddenBy', '')::uuid, (g->>'archived')::boolean) as id
         from jsonb_array_elements($1::jsonb) g`,
      [JSON.stringify(batch)],
    );
    ids.push(...res.rows.map((r) => r.id));
    if ((i / 200) % 10 === 9 && i + 200 < recipes.length) console.log(`  … games ${ids.length.toLocaleString()} / ${recipes.length.toLocaleString()}`);
  }
  return ids;
}

/** Results through the real RPCs as the creator: awards first for pools, then declare; 3 % deleted and restored. */
async function declareResults(client, creator, gameIds, { maxGames = 30 } = {}) {
  const pools = (await client.query(`select id from public.games where id = any($1::uuid[]) and game_type = 'pool' and awarded_at is null`, [gameIds])).rows;
  await asUser(client, creator, async () => {
    for (const { id } of pools) {
      const seats = (await client.query('select profile_id from public.game_players where game_id = $1 order by player_order', [id])).rows;
      const awards = Object.fromEntries(seats.map((s, i) => [s.profile_id, i === 0 ? 100 * (seats.length - 1) : -100]));
      await client.query('select public.set_pool_awards($1, $2::jsonb, $3::jsonb)', [id, JSON.stringify(awards), JSON.stringify({ presetLabel: 'Winner takes all' })]);
    }
  });
  return asUser(client, creator, async () => {
    const r = await client.query('select public.declare_game_result($1::uuid[]) as r', [gameIds.slice(0, maxGames)]);
    const resultId = r.rows[0].r.id ?? r.rows[0].r.resultId ?? r.rows[0].r;
    if (rand() < 0.03) {
      await client.query('select public.delete_result($1)', [resultId]);
      await client.query('select public.restore_result($1)', [resultId]);
    }
    return resultId;
  });
}

/** Completed, undeleted, not-yet-closed games by creator, oldest first, grouped so one result spans 1–30 of them. */
async function resultCandidates(client, creator, limit) {
  const r = await client.query(
    `select id from public.games where created_by = $1 and status = 'completed' and deleted_at is null and closed_at is null and archived_at is null
      order by created_at limit $2`, [creator, limit]);
  return r.rows.map((x) => x.id);
}

async function main() {
  if (!allowedTarget(DB_URL)) {
    console.error(`Refusing: DB_URL is neither local nor the staging project (${STAGING_REF}). This script never seeds live.`);
    process.exit(2);
  }
  mkdirSync(OUT, { recursive: true });
  const S = SIZES;
  console.log(`# seed-staging SCALE=${SCALE} → ${JSON.stringify(S)}`);
  // Nov 23 run 45246986120: the power user's 241-person circle (≈58k my_players rows through the per-row initials
  // trigger) went silent for 44 min and the job hit its 45-min timeout — statement_timeout never fired, so the
  // connection had died under us (no keepalive; the transaction pooler does not carry startup parameters).
  // keepAlive keeps NAT from dropping the idle socket; query_timeout is client-side and fails instead of hanging;
  // the big insert is chunked below so progress shows and no single statement runs for minutes.
  const client = new pg.Client({ connectionString: DB_URL, statement_timeout: 600_000, query_timeout: 900_000, keepAlive: true, keepAliveInitialDelayMillis: 5_000 });
  await client.connect();
  await client.query("set statement_timeout = '600s'").catch(() => {}); // honoured on the session pooler / direct; a no-op through the transaction pooler
  const t0 = performance.now();
  try {
    await client.query(readFileSync(path.join(HERE, 'seed-staging.sql'), 'utf8'));
    if (WIPE) await step('wipe previous population', async () => (await client.query('select staging.wipe() as n')).rows[0].n);
    await guards(client, false);

    const circles = buildCircles(S);

    await step('people (sign in with 123456)', async () => {
      await client.query('select staging.ensure_person(n) from generate_series(1, $1) n', [S.people]);
      await client.query('select staging.fix_auth_tokens()');
      return S.people;
    });

    await step('circles know each other', async () => {
      for (const c of circles) await knowEachOther(client, c.map(personId));
      return circles.length;
    });

    await step('unregistered placeholders (10 %)', async () => {
      // Regulars keep a few guests each — people who come to the table but never installed the app.
      const perRegular = Math.ceil((S.people * 0.1) / S.regulars);
      for (let p = 1; p <= S.regulars; p++) await client.query('select staging.add_guests($1, $2)', [p, perRegular]);
      return perRegular * S.regulars;
    });

    const powerCircle = circles.find((c) => c.includes(POWER)) ?? circles[0];
    await step('power user: 400 My players', async () => {
      const known = sample(Array.from({ length: S.people - 1 }, (_, i) => i + 2), Math.max(0, Math.round(S.powerPlayers * 0.6)));
      await knowEachOther(client, [POWER, ...known].map(personId));
      await client.query('select staging.add_guests($1, $2)', [POWER, Math.round(S.powerPlayers * 0.4)]);
      return S.powerPlayers;
    });

    await step('games: 18 months of history', async () => {
      const weights = circles.map((c) => (c.some((p) => p <= S.regulars) ? 4 : 1) * c.length);
      const total = weights.reduce((a, b) => a + b, 0);
      const recipes = [];
      for (let i = 0; i < S.games - S.powerGames; i++) {
        let r = rand() * total;
        let k = 0;
        while ((r -= weights[k]) > 0) k++;
        recipes.push(gameRecipe(circles[k]));
      }
      const ids = await makeGames(client, recipes);
      // 0.5 % reopened once (completed → active → completed), so the log shows it.
      const reopened = sample(ids, Math.max(1, Math.round(ids.length * 0.005)));
      await client.query(`update public.games set status = 'active', completed_at = null where id = any($1::uuid[]) and deleted_at is null`, [reopened]);
      await client.query(`update public.games set status = 'completed', completed_at = created_at + interval '3 hours' where id = any($1::uuid[]) and deleted_at is null`, [reopened]);
      return ids.length;
    });

    await step('power user: 1,500 games', async () => {
      const pool = [...new Set([...powerCircle, ...sample(Array.from({ length: S.people }, (_, i) => i + 1), 40)])];
      const recipes = Array.from({ length: S.powerGames }, () => gameRecipe(pool, { creator: POWER }));
      return (await makeGames(client, recipes)).length;
    });

    await step('live right now', async () => {
      const recipes = Array.from({ length: S.live }, (_, i) => gameRecipe(circles[i % circles.length], { live: true }));
      recipes.push(gameRecipe(powerCircle, { live: true, creator: POWER }));
      return (await makeGames(client, recipes)).length;
    });

    await step('results', async () => {
      let made = 0;
      const creators = (await client.query(
        `select created_by, count(*)::int as n from public.games where status = 'completed' and deleted_at is null and closed_at is null and created_by <> $1
          group by created_by having count(*) >= 1 order by n desc limit $2`, [personId(POWER), S.results])).rows;
      for (const { created_by } of creators) {
        if (made >= S.results) break;
        const ids = await resultCandidates(client, created_by, 30);
        while (ids.length && made < S.results) {
          const span = Math.min(ids.length, skewed(1, 30));
          await declareResults(client, created_by, ids.splice(0, span));
          made += 1;
        }
      }
      return made;
    });

    await step('power user: 120 results', async () => {
      let made = 0;
      const ids = await resultCandidates(client, personId(POWER), S.powerGames);
      while (ids.length && made < S.powerResults) {
        await declareResults(client, personId(POWER), ids.splice(0, Math.min(ids.length, skewed(1, 30))));
        made += 1;
      }
      return made;
    });

    await step('one huge table (20 × 500 pool)', async () => {
      const seats = [POWER, ...sample(Array.from({ length: S.people - 1 }, (_, i) => i + 2), 19)].map(personId);
      const [game] = await makeGames(client, [{
        players: seats, rounds: S.hugeRounds, type: 'pool', status: 'active', createdAt: daysAgo(0.1), multiplier: 1,
        poolLimit: 1000000, joined: 1, deleted: false, archived: false, hiddenBy: null,
      }]);
      // Three re-entries written directly (pool_recompute would clear out_round at this limit) and two dealer overrides via the RPC.
      const third = Math.floor(S.hugeRounds / 3);
      for (let i = 0; i < 3; i++) {
        const round = third * (i + 1) - between(0, 5);
        await client.query(
          `update public.game_players set out_round = $3, reentered_round = $3 + 1, entries = 2,
                  reentry_score = (select max(t.s) from (select sum(s.value) s from public.scores s join public.rounds r on r.id = s.round_id
                                   where s.game_id = $1 and r.round_number <= $3 group by s.profile_id) t)
            where game_id = $1 and profile_id = $2`, [game, seats[5 + i], round]);
      }
      await asUser(client, seats[0], async () => {
        await client.query('select public.set_round_dealer($1, $2, $3, true)', [game, S.hugeRounds + 1, seats[9]]);
        await client.query('select public.set_round_dealer($1, $2, $3, false)', [game, S.hugeRounds + 1, seats[12]]);
      });
      writeFileSync(path.join(OUT, 'huge-table.txt'), `${game}\n`);
      return S.hugeRounds;
    });

    await step('guardrail caps on screen (link requests pending, live games)', async () => {
      const cap = (await client.query(`select value from public.guardrails where key = 'link_requests_pending'`)).rows[0].value;
      await client.query('select staging.add_guests($1, $2)', [POWER, cap]);
      const guests = Array.from({ length: cap }, (_, g) => guestId(POWER, g + 1));
      await client.query(
        `insert into public.player_links (owner_id, player_id, email, kind, status, invited_at, last_sent_at)
         select $1, g, 'invite' || row_number() over () || '@staging.test', 'signup', 'pending', now() - interval '3 days', now() - interval '3 days'
           from unnest($2::uuid[]) g on conflict do nothing`, [personId(POWER), guests]);
      const liveCap = (await client.query(`select value from public.guardrails where key = 'live_games_per_user'`)).rows[0].value;
      const have = (await client.query(`select count(*)::int n from public.games where created_by = $1 and status = 'active' and deleted_at is null`, [personId(POWER)])).rows[0].n;
      const recipes = Array.from({ length: Math.max(0, liveCap - have) }, () => gameRecipe(powerCircle, { live: true, creator: POWER }));
      await makeGames(client, recipes);
      return cap + recipes.length;
    });

    await step('analyze', async () => { await client.query('analyze'); });
  } finally {
    await guards(client, true).catch(() => {});
  }

  const counts = (await client.query(`
    select (select count(*) from public.profiles where id::text like 'c0000000-%') as people,
           (select count(*) from public.profiles where id::text like 'd%' and player_status = 'unregistered') as guests,
           (select count(*) from public.games) as games,
           (select count(*) from public.games where status = 'active' and deleted_at is null) as live,
           (select count(*) from public.games where deleted_at is not null) as deleted,
           (select count(*) from public.games where archived_at is not null) as archived,
           (select count(*) from public.games where game_type = 'pool') as pools,
           (select count(*) from public.rounds) as rounds,
           (select count(*) from public.scores) as scores,
           (select count(*) from public.game_results where deleted_at is null) as results,
           (select count(*) from public.my_players where owner_id = $1 and removed_at is null) as power_my_players,
           (select count(*) from public.games where created_by = $1) as power_games,
           (select count(*) from public.game_results where declared_by = $1 and deleted_at is null) as power_results,
           (select count(*) from public.event_log) as log_rows`, [personId(POWER)])).rows[0];
  await client.end();
  const summary = { scale: SCALE, sizes: S, seconds: Math.round((performance.now() - t0) / 100) / 10, steps, counts, powerUser: { email: 'sree.koneru.1@staging.test', passcode: '123456' } };
  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`# done in ${summary.seconds} s`);
  console.log(JSON.stringify(counts));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
