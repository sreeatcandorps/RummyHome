/**
 * Stress against the LOCAL Supabase only (PR 17, B16-1..B16-3): latency budgets for the RPCs the app calls
 * under sequential and concurrent load, the 500-round guard, the 20 × 60 read. Complements
 * ci/volume/run-volume.mjs (the size ladder: 10,000 players, 5,000 games, result sizes — see
 * docs/volume-testing.md). Never point DB_URL at the hosted project: this creates hundreds of games.
 *
 *   node ci/volume/run-stress.mjs            (env DB_URL, default the Supabase CLI local database)
 *
 * Every call goes through the same RPCs the app uses (create_game, save_round) as an authenticated
 * user, one Postgres transaction per request like PostgREST. Prints TAP and writes stress.md
 * (VOLUME_OUT, default ci/out/volume). Budgets (fail when exceeded):
 *
 *   V1  40 games × 25 rounds for one creator, sequential      save_round p95 ≤ 250 ms
 *   V2  8 clients saving rounds to 8 games at once, 400 saves  p95 ≤ 600 ms, zero errors
 *   V3  home list for a user in 100+ games (the app's query)   ≤ 400 ms
 *   V4  one game pushed to the 500-round guard                 round 501 refused with the guard message
 *   V5  a 20-seat game × 60 rounds read back (scorecard load)  ≤ 300 ms
 *
 * Exits 1 when a budget is missed. Env: VOLUME_SCALE (1 = the numbers above, 0.25 for a quick local pass).
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (/supabase\.co|pooler\.supabase|gngcrplcldfiubvhcdin/i.test(DB_URL)) {
  console.error('refusing to run volume against a hosted Supabase URL');
  process.exit(2);
}
const SCALE = Number(process.env.VOLUME_SCALE ?? 1);
const OUT = process.env.VOLUME_OUT ?? 'ci/out/volume';
fs.mkdirSync(OUT, { recursive: true });

// Seed users (seed.sql): Sree creates, the others sit. Volume players come from seed-break (p01..p20).
const SREE = '00000000-0000-4000-8000-000000000001';
const HARISH = '00000000-0000-4000-8000-000000000002';
const PRIYA = '00000000-0000-4000-8000-000000000003';
const P = (i) => `00000000-0000-4000-8000-000000${(512 + i).toString(16).padStart(6, '0')}`;
const POINTS = { gameType: 'stake', expenseEnabled: false, expenseAmount: 0, stakeDrop: -10, stakeMiddleDrop: -30, maxCount: -80, dropAmount: -10, mdAmount: -30 };

let n = 0; let failed = 0; const report = [];
function ok(cond, name, detail) {
  n += 1;
  console.log(`${cond ? 'ok' : 'not ok'} ${n} - ${name}`);
  if (detail) console.log(`# ${String(detail).replace(/\n/g, '\n# ')}`);
  report.push(`| ${name} | ${cond ? 'pass' : '**FAIL**'} | ${detail ?? ''} |`);
  if (!cond) failed += 1;
}
const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
const ms = (t0) => Number(process.hrtime.bigint() - t0) / 1e6;

async function connect() { const c = new pg.Client({ connectionString: DB_URL, statement_timeout: 30_000 }); await c.connect(); return c; }
async function beginAs(c, uid) {
  await c.query('begin');
  const claims = JSON.stringify({ sub: uid, role: 'authenticated', email: `${uid.slice(-4)}@volume.local` });
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
  await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  await c.query(`select set_config('request.jwt.claim.role', 'authenticated', true)`);
  await c.query('set local role authenticated');
}
/** One PostgREST-like request: begin as uid → fn → commit (rollback on error, error rethrown). */
async function as(c, uid, fn) {
  await beginAs(c, uid);
  try { const r = await fn(); await c.query('commit'); return r; } catch (e) { await c.query('rollback'); throw e; }
}
const scoresJson = (ids, round) => JSON.stringify(ids.map((playerId, i) => {
  // Everyone but the round's winner loses something; the winner takes the sum (Rummy).
  const win = round % ids.length;
  const value = i === win ? 0 : -(10 + ((round * 7 + i * 3) % 60));
  return { playerId, scoreType: i === win ? 'rummy' : 'count', value };
}).map((s, _, all) => (s.scoreType === 'rummy' ? { ...s, value: -all.filter((x) => x.scoreType !== 'rummy').reduce((a, x) => a + x.value, 0) } : s)));

async function createGame(c, creator, seats, code) {
  const { rows } = await as(c, creator, () => c.query(
    `select public.create_game('stake', $1::jsonb, $2::uuid[], '{}'::jsonb, $3) as id`, [JSON.stringify(POINTS), seats, code],
  ));
  return rows[0].id;
}
async function saveRound(c, uid, gameId, round, seats) {
  return as(c, uid, () => c.query('select public.save_round($1, $2, $3::jsonb, false)', [gameId, round, scoresJson(seats, round)]));
}

const admin = await connect();
// The per-day / live-game guards (029) would stop a volume run at 10 live games; they are the
// subject of V4 only, so they are lifted for the rest (local database, re-enabled at the end).
await admin.query(`alter table public.games disable trigger games_0_guard`);
await admin.query(`insert into public.my_players (owner_id, player_id) select $1, p from unnest($2::uuid[]) p on conflict do nothing`, [SREE, [HARISH, PRIYA, ...Array.from({ length: 20 }, (_, i) => P(i + 1))]]);
const hasBreakSeed = (await admin.query(`select count(*)::int as c from public.profiles where id = any($1::uuid[])`, [[P(1), P(2), P(3)]])).rows[0].c === 3;
const seats4 = hasBreakSeed ? [SREE, P(1), P(2), P(3)] : [SREE, HARISH, PRIYA];

try {
  // ---- V1 sequential ------------------------------------------------------------------------
  {
    const c = await connect();
    const games = Math.max(4, Math.round(40 * SCALE));
    const rounds = Math.max(5, Math.round(25 * SCALE));
    const lat = []; let errors = 0; const t0 = process.hrtime.bigint();
    for (let g = 0; g < games; g += 1) {
      const id = await createGame(c, SREE, seats4, `VOL1${String(g).padStart(3, '0')}`);
      for (let r = 1; r <= rounds; r += 1) {
        const t = process.hrtime.bigint();
        try { await saveRound(c, SREE, id, r, seats4); } catch (e) { errors += 1; if (errors < 3) console.log(`# V1 error: ${e.message}`); }
        lat.push(ms(t));
      }
    }
    const p95 = pct(lat, 0.95);
    ok(p95 <= 250 && errors === 0, `V1 ${games} games × ${rounds} rounds sequential: save_round p95 ≤ 250 ms`, `p50 ${pct(lat, 0.5).toFixed(0)} ms · p95 ${p95.toFixed(0)} ms · max ${Math.max(...lat).toFixed(0)} ms · ${errors} errors · ${(ms(t0) / 1000).toFixed(1)} s total`);
    await c.end();
  }

  // ---- V2 concurrent -----------------------------------------------------------------------
  {
    const clients = 8; const saves = Math.max(40, Math.round(400 * SCALE));
    const conns = await Promise.all(Array.from({ length: clients }, connect));
    const ids = [];
    for (let i = 0; i < clients; i += 1) ids.push(await createGame(conns[i], SREE, seats4, `VOL2${String(i).padStart(3, '0')}`));
    const lat = []; let errors = 0; const t0 = process.hrtime.bigint();
    await Promise.all(conns.map(async (c, i) => {
      for (let r = 1; r <= saves / clients; r += 1) {
        const t = process.hrtime.bigint();
        try { await saveRound(c, SREE, ids[i], r, seats4); } catch (e) { errors += 1; if (errors < 3) console.log(`# V2 error: ${e.message}`); }
        lat.push(ms(t));
      }
    }));
    const p95 = pct(lat, 0.95);
    ok(p95 <= 600 && errors === 0, `V2 ${clients} clients × ${saves / clients} rounds at once: p95 ≤ 600 ms, no errors`, `p50 ${pct(lat, 0.5).toFixed(0)} ms · p95 ${p95.toFixed(0)} ms · ${errors} errors · ${(saves / (ms(t0) / 1000)).toFixed(0)} saves/s`);
    await Promise.all(conns.map((c) => c.end()));
  }

  // ---- V3 home list for a busy user ----------------------------------------------------------
  {
    const c = await connect();
    const { rows } = await c.query(`select count(*)::int as c from public.game_players where profile_id = $1`, [SREE]);
    const t = process.hrtime.bigint();
    const ids = await as(c, SREE, () => c.query(`select game_id from public.game_players where profile_id = $1`, [SREE]));
    const list = await as(c, SREE, () => c.query(
      `select g.*, (select json_agg(json_build_object('profile_id', gp.profile_id, 'player_order', gp.player_order, 'role', gp.role, 'seated', gp.seated)) from public.game_players gp where gp.game_id = g.id) as game_players
         from public.games g where g.id = any($1::uuid[]) order by g.created_at desc limit 50`, [ids.rows.map((r) => r.game_id)],
    ));
    const took = ms(t);
    ok(took <= 400, `V3 home list (membership + 50 newest games with seats) for a user in ${rows[0].c} games ≤ 400 ms`, `${took.toFixed(0)} ms · ${list.rows.length} rows`);
    await c.end();
  }

  // ---- V4 the 500-round guard ------------------------------------------------------------------
  {
    const c = await connect();
    const id = await createGame(c, SREE, seats4, 'VOL4GRD');
    await admin.query(`alter table public.games enable trigger games_0_guard`);
    // 499 rounds straight into the tables (fast), then the RPC for 500 and 501.
    await admin.query(`
      with r as (
        insert into public.rounds (game_id, round_number, created_by)
        select $1, g, $2 from generate_series(1, 499) g returning id
      )
      insert into public.scores (round_id, game_id, profile_id, score_type, value)
      select r.id, $1, p.pid, (case when p.ord = 1 then 'rummy' else 'count' end)::public.score_type,
             case when p.ord = 1 then 10 * (cardinality($3::uuid[]) - 1) else -10 end
        from r cross join unnest($3::uuid[]) with ordinality as p(pid, ord)`, [id, SREE, seats4]);
    await admin.query(`update public.games set current_round = 500 where id = $1`, [id]);
    let r500 = null; let r501 = null;
    try { await saveRound(c, SREE, id, 500, seats4); r500 = 'ok'; } catch (e) { r500 = e.message; }
    try { await saveRound(c, SREE, id, 501, seats4); r501 = 'ok'; } catch (e) { r501 = e.message; }
    ok(r500 === 'ok' && /500 rounds/.test(r501 ?? ''), 'V4 round 500 saves, round 501 is refused by the rounds_per_game guard', `round 500: ${r500} · round 501: ${r501}`);
    await admin.query(`alter table public.games disable trigger games_0_guard`);
    await c.end();
  }

  // ---- V5 scorecard read of the 20 × 60 game -------------------------------------------------
  {
    const c = await connect();
    const big = (await admin.query(`select id from public.games where share_code = 'BREAKP2'`)).rows[0]?.id;
    if (!big) {
      ok(true, 'V5 skipped: BREAKP2 (seed-break.sql) is not loaded', 'apply rummy-home3/supabase/seed-break.sql first');
    } else {
      const t = process.hrtime.bigint();
      const C1 = '00000000-0000-4000-8000-000000000101'; // BREAKP2's creator (RLS: only its members read it)
      const rounds = await as(c, C1, () => c.query(`select r.id, r.round_number, s.profile_id, s.score_type, s.value from public.rounds r join public.scores s on s.round_id = r.id where r.game_id = $1 and r.undone_at is null order by r.round_number`, [big]));
      const took = ms(t);
      ok(took <= 300 && rounds.rows.length >= 1000, `V5 20 seats × 60 rounds read back ≤ 300 ms`, `${took.toFixed(0)} ms · ${rounds.rows.length} score rows`);
    }
    await c.end();
  }
} finally {
  await admin.query(`alter table public.games enable trigger games_0_guard`).catch(() => {});
  await admin.end();
}

const md = ['## Stress (local Supabase)', '', '| Check | Result | Numbers |', '|---|---|---|', ...report, ''].join('\n');
fs.writeFileSync(path.join(OUT, 'stress.md'), md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
console.log(`1..${n}`);
process.exit(failed ? 1 : 0);
