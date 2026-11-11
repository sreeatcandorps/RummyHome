/**
 * Two-client concurrency checks for save_round (014), remove_seat_if_no_scores (016) and
 * declare_game_result (009), run against the local / CI Supabase database.
 *
 * Each "client" is its own Postgres connection that behaves like one PostgREST request:
 *   begin → set role authenticated + request.jwt.claims → call the RPC → commit.
 * Holding one transaction open while the other starts makes the race deterministic.
 *
 * Prints TAP. Every expectation must pass since migration 019 (per-game lock in save_round and
 * remove_seat_if_no_scores, PT409 conflicts). The "# TODO" directive is still supported for any
 * future known limitation (same convention as the pgTAP todo() blocks).
 *
 * Env: DB_URL (default postgresql://postgres:postgres@127.0.0.1:54322/postgres — the Supabase CLI default)
 */
import pg from 'pg';

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const SREE = '00000000-0000-4000-8000-000000000001';
const COADMIN = '00000000-0000-4000-8000-000000000006';
const HARISH = '00000000-0000-4000-8000-000000000002';
const PRIYA = '00000000-0000-4000-8000-000000000003';
const ZERO = '00000000-0000-4000-8000-000000000008';
const GAME_A = '10000000-0000-4000-8000-00000000000a';

let n = 0;
let failed = 0;
const findings = [];
function ok(cond, name, { todo, detail } = {}) {
  n += 1;
  const directive = todo ? ` # TODO ${todo}` : '';
  console.log(`${cond ? 'ok' : 'not ok'} ${n} - ${name}${directive}`);
  if (detail) console.log(`# ${String(detail).replace(/\n/g, '\n# ')}`);
  if (!cond && !todo) failed += 1;
  if (!cond && todo) findings.push(`${name}: ${todo}`);
}

async function connect() {
  const c = new pg.Client({ connectionString: DB_URL, statement_timeout: 15_000 });
  await c.connect();
  return c;
}

/** Start a transaction as `uid`, as PostgREST would for one authenticated request. */
async function beginAs(c, uid) {
  await c.query('begin');
  const { rows } = await c.query('select email from auth.users where id = $1', [uid]);
  const claims = JSON.stringify({ sub: uid, role: 'authenticated', email: rows[0]?.email ?? '' });
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
  await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
  await c.query(`select set_config('request.jwt.claim.role', 'authenticated', true)`);
  await c.query('set local role authenticated');
}

const scores = (pairs) => JSON.stringify(pairs.map(([playerId, value]) => ({
  playerId,
  scoreType: value > 0 ? 'rummy' : 'count',
  value,
})));

async function saveRound(c, gameId, round, pairs, replace = false) {
  return c.query('select public.save_round($1, $2, $3::jsonb, $4) as id', [gameId, round, scores(pairs), replace]);
}

/** Run fn, return { ok, error } instead of throwing. */
async function attempt(fn) {
  try { return { ok: true, value: await fn() }; } catch (error) { return { ok: false, error }; }
}

/** Resolve after `ms`, used to let a blocked statement actually block before we commit the other side. */
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function liveRounds(admin, gameId) {
  const { rows } = await admin.query(
    `select r.round_number, count(s.id)::int as scores, coalesce(sum(s.value), 0)::int as total
       from public.rounds r left join public.scores s on s.round_id = r.id
      where r.game_id = $1 and r.undone_at is null
      group by r.round_number order by r.round_number`, [gameId]);
  return rows;
}

async function main() {
  const admin = await connect(); // owner connection for setup and inspection (no RLS)
  const a = await connect();
  const b = await connect();

  // Fresh copy of game A's state for each run is guaranteed by `supabase db reset` before this script.
  const before = await liveRounds(admin, GAME_A);
  ok(before.length === 2, 'setup: game A starts with two live rounds', { detail: JSON.stringify(before) });

  // ---------------------------------------------------------------------------------------
  // 1. Two admins save the SAME new round number at the same moment with different payloads
  // ---------------------------------------------------------------------------------------
  {
    await beginAs(a, SREE);
    const first = await attempt(() => saveRound(a, GAME_A, 3, [[HARISH, -10], [PRIYA, 10]]));
    ok(first.ok, '1. admin A saves round 3 inside an open transaction', { detail: first.error?.message });

    await beginAs(b, COADMIN);
    const secondP = attempt(() => saveRound(b, GAME_A, 3, [[HARISH, 20], [PRIYA, -20]]));
    await pause(300);                       // B is now blocked on the (game_id, round_number) unique index
    await a.query('commit');
    const second = await secondP;
    if (second.ok) await b.query('commit'); else await b.query('rollback');

    const rounds = await liveRounds(admin, GAME_A);
    const r3 = rounds.filter((r) => r.round_number === 3);
    ok(r3.length === 1, '1. exactly one live round 3 after the race');
    ok(r3[0]?.scores === 2 && r3[0]?.total === 0, '1. round 3 has one balanced set of scores (no merge of the two payloads)', { detail: JSON.stringify(r3) });
    ok(!second.ok, '1. the second save does not silently succeed with a different payload', { detail: second.error?.code });
    ok(!second.ok && second.error?.code === 'PT409',
      '1. the loser gets a PT409 conflict (HTTP 409 through PostgREST), not a raw 23505 unique violation',
      { detail: `${second.error?.code}: ${second.error?.message}` });
    ok(/just saved by someone else/i.test(second.error?.message ?? ''),
      '1. the conflict message is the plain-English one the app shows before refreshing',
      { detail: second.error?.message });
  }

  // ---------------------------------------------------------------------------------------
  // 2. Same payload submitted twice (double tap / retry after a timeout) — sequential
  // ---------------------------------------------------------------------------------------
  {
    const payload = [[HARISH, -5], [PRIYA, 5]];
    await beginAs(a, SREE);
    const r1 = await attempt(() => saveRound(a, GAME_A, 4, payload));
    await a.query('commit');
    await beginAs(b, SREE);
    const r2 = await attempt(() => saveRound(b, GAME_A, 4, payload));
    await b.query(r2.ok ? 'commit' : 'rollback');
    const r4 = (await liveRounds(admin, GAME_A)).filter((r) => r.round_number === 4);
    ok(r1.ok && r2.ok, '2. a retried submit of an already saved round does not error');
    ok(r4.length === 1 && r4[0].scores === 2, '2. the retry adds no second set of scores', { detail: JSON.stringify(r4) });
  }

  // ---------------------------------------------------------------------------------------
  // 3. Admin A edits round 3 while admin B adds round 5
  //    (019: writers to one game run one at a time, so B waits for A's commit, then lands)
  // ---------------------------------------------------------------------------------------
  {
    await beginAs(a, SREE);
    const edit = await attempt(() => saveRound(a, GAME_A, 3, [[HARISH, -40], [PRIYA, 40]], true));
    await beginAs(b, COADMIN);
    const addP = attempt(() => saveRound(b, GAME_A, 5, [[HARISH, 15], [PRIYA, -15]]));
    await pause(300);                       // B waits on the per-game lock until A commits
    await a.query(edit.ok ? 'commit' : 'rollback');
    const add = await addP;
    await b.query(add.ok ? 'commit' : 'rollback');
    const rounds = await liveRounds(admin, GAME_A);
    ok(edit.ok && add.ok, '3. an edit and an add on different rounds both succeed (the add waits for the edit to commit)', { detail: `${edit.error?.message ?? ''} ${add.error?.message ?? ''}`.trim() });
    const r3 = rounds.find((r) => r.round_number === 3);
    ok(r3 && r3.scores === 2 && rounds.filter((r) => r.round_number === 5).length === 1, '3. rounds 3 and 5 each exist once with their own scores');
    const { rows } = await admin.query(`select count(*)::int as c from public.rounds where game_id = $1 and round_number > 1000 and undone_at is not null`, [GAME_A]);
    ok(rows[0].c === 2, '3. the previous round 3 was retired to the 1000+ range (plus the seeded undone round)', { detail: `retired rows: ${rows[0].c}` });
  }

  // ---------------------------------------------------------------------------------------
  // 4. Two admins edit the SAME round at the same moment
  // ---------------------------------------------------------------------------------------
  {
    await beginAs(a, SREE);
    const e1 = await attempt(() => saveRound(a, GAME_A, 4, [[HARISH, -7], [PRIYA, 7]], true));
    await beginAs(b, COADMIN);
    const e2P = attempt(() => saveRound(b, GAME_A, 4, [[HARISH, 9], [PRIYA, -9]], true));
    await pause(300);
    await a.query(e1.ok ? 'commit' : 'rollback');
    const e2 = await e2P;
    await b.query(e2.ok ? 'commit' : 'rollback');
    const r4 = (await liveRounds(admin, GAME_A)).filter((r) => r.round_number === 4);
    ok(e1.ok, '4. the first edit succeeds');
    ok(r4.length === 1 && r4[0].scores === 2 && r4[0].total === 0, '4. exactly one live round 4 with one balanced payload after two simultaneous edits', { detail: JSON.stringify(r4) });
    ok(e2.ok, '4. the second editor gets a graceful outcome (waits for the first, then its edit lands: last writer wins, no 23505)',
      { detail: `${e2.error?.code ?? ''} ${e2.error?.message ?? ''}`.trim() });
    const { rows: h4 } = await admin.query(
      `select s.value from public.scores s join public.rounds r on r.id = s.round_id
        where r.game_id = $1 and r.round_number = 4 and r.undone_at is null and s.profile_id = $2`, [GAME_A, HARISH]);
    ok(h4.length === 1 && h4[0].value === 9,
      "4. the surviving round 4 carries the second editor's payload (last writer wins, as with two sequential edits)", { detail: JSON.stringify(h4) });
  }

  // ---------------------------------------------------------------------------------------
  // 5a. Remove a zero-score seat while another admin's save that includes them is in flight.
  //     019: both take the same per-game lock, so the removal waits for the save, then still
  //     removes the seat (its new score is a 0) and deletes every score row of that seat.
  // ---------------------------------------------------------------------------------------
  {
    await beginAs(a, SREE);
    const save = await attempt(() => saveRound(a, GAME_A, 6, [[HARISH, -12], [PRIYA, 12], [ZERO, 0]]));
    await beginAs(b, COADMIN);
    const removeP = attempt(() => b.query('select * from public.remove_seat_if_no_scores($1, $2)', [GAME_A, ZERO]));
    await pause(300);                       // B is now waiting on the per-game lock held by A
    const { rows: waiting } = await admin.query(
      `select count(*)::int as c from pg_stat_activity where wait_event_type = 'Lock' and wait_event = 'advisory'`);
    await a.query(save.ok ? 'commit' : 'rollback');
    const remove = await removeP;
    await b.query(remove.ok ? 'commit' : 'rollback');
    const { rows: seat } = await admin.query('select count(*)::int as c from public.game_players where game_id = $1 and profile_id = $2', [GAME_A, ZERO]);
    const { rows: orphan } = await admin.query(
      `select count(*)::int as c from public.scores s join public.rounds r on r.id = s.round_id
        where s.game_id = $1 and s.profile_id = $2`, [GAME_A, ZERO]);
    const r6 = (await liveRounds(admin, GAME_A)).filter((r) => r.round_number === 6);
    ok(save.ok, '5a. the save in flight completes', { detail: save.error?.message });
    ok(waiting[0].c >= 1, '5a. the removal waited on the per-game lock while the save was in flight', { detail: `sessions waiting on an advisory lock: ${waiting[0].c}` });
    ok(remove.ok, '5a. the removal completes after the save commits', { detail: `${remove.error?.code ?? ''} ${remove.error?.message ?? ''}`.trim() });
    ok(seat[0].c === 0, '5a. the seat is gone');
    ok(orphan[0].c === 0, '5a. no score row is left behind for the removed player (live or retired)', { detail: `orphan score rows for removed player: ${orphan[0].c}` });
    ok(r6.length === 1 && r6[0].scores === 2 && r6[0].total === 0, "5a. round 6 keeps the other two players' scores", { detail: JSON.stringify(r6) });
  }

  // ---------------------------------------------------------------------------------------
  // 5b. The other order: the removal is in flight when the save starts. The save waits, then
  //     sees the seat is gone and refuses (PT409) instead of writing a score for a non-seat.
  // ---------------------------------------------------------------------------------------
  {
    const NEWCOMER = '00000000-0000-4000-8000-000000000005';   // outsider, seated for this scenario only
    await admin.query(
      `insert into public.game_players (game_id, profile_id, player_order, role, seated) values ($1, $2, 9, 'player', true)`, [GAME_A, NEWCOMER]);
    await beginAs(b, COADMIN);
    const remove = await attempt(() => b.query('select * from public.remove_seat_if_no_scores($1, $2)', [GAME_A, NEWCOMER]));
    await beginAs(a, SREE);
    const saveP = attempt(() => saveRound(a, GAME_A, 7, [[HARISH, -8], [PRIYA, 8], [NEWCOMER, 0]]));
    await pause(300);                       // A is now waiting on the per-game lock held by B
    await b.query(remove.ok ? 'commit' : 'rollback');
    const save = await saveP;
    await a.query(save.ok ? 'commit' : 'rollback');
    const { rows: seat } = await admin.query('select count(*)::int as c from public.game_players where game_id = $1 and profile_id = $2', [GAME_A, NEWCOMER]);
    const { rows: orphan } = await admin.query('select count(*)::int as c from public.scores where game_id = $1 and profile_id = $2', [GAME_A, NEWCOMER]);
    const r7 = (await liveRounds(admin, GAME_A)).filter((r) => r.round_number === 7);
    ok(remove.ok, '5b. the removal in flight completes', { detail: remove.error?.message });
    ok(!save.ok && save.error?.code === 'PT409', '5b. the save that named the removed player is refused with PT409 (players changed)', { detail: `${save.error?.code ?? 'ok'} ${save.error?.message ?? ''}`.trim() });
    ok(seat[0].c === 0 && orphan[0].c === 0, '5b. the seat is gone and no score row exists for the removed player');
    ok(r7.length === 0, '5b. no round 7 was written (the whole save rolled back)', { detail: JSON.stringify(r7) });
  }

  // ---------------------------------------------------------------------------------------
  // 6. Connection dropped mid-save, then retried
  // ---------------------------------------------------------------------------------------
  {
    const c = await connect();
    c.on('error', () => {}); // the drop below is intentional
    await beginAs(c, SREE);
    const partial = await attempt(() => saveRound(c, GAME_A, 7, [[HARISH, -3], [PRIYA, 3]]));
    // The phone loses the network before the commit reaches the server.
    c.connection.stream.destroy();
    await pause(300);
    const afterDrop = (await liveRounds(admin, GAME_A)).filter((r) => r.round_number === 7);
    ok(partial.ok && afterDrop.length === 0, '6. a save whose connection drops before commit leaves no round at all (no blank round)', { detail: JSON.stringify(afterDrop) });
    await beginAs(a, SREE);
    const retry = await attempt(() => saveRound(a, GAME_A, 7, [[HARISH, -3], [PRIYA, 3]]));
    await a.query(retry.ok ? 'commit' : 'rollback');
    const afterRetry = (await liveRounds(admin, GAME_A)).filter((r) => r.round_number === 7);
    ok(retry.ok && afterRetry.length === 1 && afterRetry[0].scores === 2, '6. the retry saves round 7 once', { detail: JSON.stringify(afterRetry) });
  }

  // ---------------------------------------------------------------------------------------
  // 7. Two admins declare the same completed game at the same moment
  //    (product decision from build 3: Closed games stay selectable with a warning, so the
  //    server does not refuse a second result — this records that both succeed.)
  // ---------------------------------------------------------------------------------------
  {
    await admin.query(`update public.games set status = 'completed', completed_at = now() where id = $1`, [GAME_A]);
    await beginAs(a, SREE);
    const d1 = await attempt(() => a.query('select public.declare_game_result($1::uuid[]) as r', [[GAME_A]]));
    await beginAs(b, COADMIN);
    const d2P = attempt(() => b.query('select public.declare_game_result($1::uuid[]) as r', [[GAME_A]]));
    await pause(300);                       // B blocks on the games row lock taken by close_games_in_result
    await a.query(d1.ok ? 'commit' : 'rollback');
    const d2 = await d2P;
    await b.query(d2.ok ? 'commit' : 'rollback');
    const { rows } = await admin.query('select count(*)::int as c from public.game_result_games where game_id = $1', [GAME_A]);
    ok(d1.ok && d2.ok, '7. both declarations succeed (server does not block a second result for a Closed game — by design)', { detail: `${d1.error?.message ?? ''} ${d2.error?.message ?? ''}`.trim() });
    ok(rows[0].c === 2, '7. the game is now in two results; the app warns about this before Declare', { detail: `results containing game A: ${rows[0].c}` });
  }

  await Promise.all([a.end(), b.end(), admin.end()]);
  console.log(`1..${n}`);
  if (findings.length) {
    console.log('# Known limitations recorded by this run:');
    for (const f of findings) console.log(`#   - ${f}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.log(`Bail out! ${error.message}`);
  process.exit(1);
});
