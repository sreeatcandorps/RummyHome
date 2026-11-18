// Is Realtime alive on this (local, throw-away) Supabase? Signs in as c1 (seed-break.sql), subscribes
// exactly the way the scorecard does (one channel, postgres_changes on games / game_players / rounds
// filtered to one game), then two stages: (1) a no-op update of the game row through psql — is CDC
// delivering at all; (2) a real round saved through the `save_round` RPC as c1, the way device B does
// in T1 — does the `rounds` insert reach a subscriber under RLS. The round is deleted again afterwards.
// Run by the two-device CI job before the realtime flow so a red T1 can be read: probe green + flow
// red = the app; probe red = the stack. Local database only: refuses hosted URLs. Exit 1 on no event.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_ANON_KEY || '';
const dbUrl = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const waitMs = Number(process.env.PROBE_WAIT_MS || 20000);
const code = process.env.PROBE_GAME || 'BREAKP6';

if (/supabase\.co|pooler|gngcrplcldfiubvhcdin/.test(url + dbUrl)) {
  console.error('realtime-probe: refuses to run against a hosted Supabase');
  process.exit(2);
}
if (!key) {
  console.error('realtime-probe: SUPABASE_ANON_KEY is not set');
  process.exit(2);
}

const psql = (sql) => execFileSync('psql', [dbUrl, '-tAc', sql], { encoding: 'utf8' }).trim();

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email: 'c1@test.local', password: '123456' });
if (signInError) {
  console.error('sign-in failed:', signInError.message);
  process.exit(1);
}
console.log('signed in as c1');
supabase.realtime.setAuth(signIn.session.access_token);

const gameId = psql(`select id from public.games where share_code = '${code}'`);
if (!gameId) {
  console.error(`no game with share code ${code}`);
  process.exit(1);
}

let resolveEvent = () => {};
let gotEvent = new Promise((resolve) => { resolveEvent = resolve; });
const armEvent = () => { gotEvent = new Promise((resolve) => { resolveEvent = resolve; }); };
const onChange = (payload) => resolveEvent(`${payload.table} ${payload.eventType}`);
let status = 'none';
const channel = supabase
  .channel(`probe:${gameId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, onChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, onChange)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameId}` }, onChange)
  // Realtime confirms (or refuses) the postgres_changes subscription a moment after the join with a
  // `system` message — "Subscribed to PostgreSQL" or the reason it could not. The join reply alone
  // says nothing about CDC, so print it.
  .on('system', {}, (payload) => {
    console.log(`system: ${payload.status ?? ''} ${payload.extension ?? ''} ${payload.message ?? ''}`.trim());
  })
  .subscribe((s, err) => {
    status = s;
    console.log(`channel: ${s}${err ? ` (${err.message})` : ''}`);
  });

const subscribedBy = Date.now() + waitMs;
while (status !== 'SUBSCRIBED' && Date.now() < subscribedBy) {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') break;
  await new Promise((r) => setTimeout(r, 200));
}
if (status !== 'SUBSCRIBED') {
  console.error(`realtime-probe: FAIL — channel never subscribed (last status ${status})`);
  await supabase.removeChannel(channel);
  process.exit(1);
}

// The CDC subscription is registered asynchronously after the join; a change made before the
// subscription row exists is never delivered. Nudge every 2 s until something arrives (run 5 nudged
// once, right after SUBSCRIBED, and the single change was lost in that window).
const t0 = Date.now();
let nudges = 0;
const nudge = () => {
  psql(`update public.games set settings = settings where id = '${gameId}'`);
  nudges += 1;
};
nudge();
console.log(`nudged ${code} (no-op update)`);
const timer = setInterval(nudge, 2000);

const result = await Promise.race([gotEvent, new Promise((r) => setTimeout(() => r(null), waitMs))]);
clearInterval(timer);
if (result) {
  console.log(`stage 1 ok — ${result} event after ${Date.now() - t0} ms (${nudges} nudge${nudges === 1 ? '' : 's'})`);
  // Stage 2: the app's own write path. c1 is the admin of this game; four seats, a balanced Points round.
  armEvent();
  const seats = psql(`select string_agg(profile_id::text, ',' order by player_order) from public.game_players where game_id = '${gameId}' and seated`).split(',');
  const roundNumber = Number(psql(`select coalesce(max(round_number), 0) + 1 from public.rounds where game_id = '${gameId}' and undone_at is null`));
  const values = [30, -10, -10, -10];
  const scores = seats.slice(0, 4).map((playerId, i) => ({ playerId, scoreType: i === 0 ? 'rummy' : 'count', value: values[i] ?? 0 }));
  const t1 = Date.now();
  const { error: saveError } = await supabase.rpc('save_round', { p_game_id: gameId, p_round_number: roundNumber, p_scores: scores, p_replace: false });
  if (saveError) console.log(`stage 2: save_round refused (${saveError.message}) — the stage says nothing then`);
  const roundEvent = saveError ? 'skipped' : await Promise.race([gotEvent, new Promise((r) => setTimeout(() => r(null), waitMs))]);
  try {
    psql(`delete from public.scores where game_id = '${gameId}' and round_id in (select id from public.rounds where game_id = '${gameId}' and round_number = ${roundNumber})`);
    psql(`delete from public.rounds where game_id = '${gameId}' and round_number = ${roundNumber}`);
    psql(`update public.games set current_round = ${roundNumber} where id = '${gameId}'`);
  } catch (e) {
    console.log(`cleanup: ${e.message.split('\n')[0]}`);
  }
  await supabase.removeChannel(channel);
  if (roundEvent) {
    console.log(`realtime-probe: PASS — stage 2 ${roundEvent === 'skipped' ? 'skipped' : `${roundEvent} event after ${Date.now() - t1} ms (save_round as c1)`}`);
    process.exit(0);
  }
  console.error(`realtime-probe: FAIL — stage 1 delivered but no event within ${waitMs} ms after save_round (RLS on rounds / game_players for a subscriber, or the three-table channel)`);
  process.exit(1);
}
await supabase.removeChannel(channel);
console.error(`realtime-probe: FAIL — no event within ${waitMs} ms after ${nudges} nudges (publication, RLS or the Realtime container)`);
try {
  console.error(`realtime.subscription rows: ${psql('select count(*) from realtime.subscription')}`);
  console.error(`supabase_realtime publishes: ${psql("select string_agg(tablename, ', ' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'")}`);
  console.error(`replication slots: ${psql("select string_agg(slot_name || '=' || case when active then 'active' else 'idle' end, ', ') from pg_replication_slots")}`);
  console.error(`wal_level: ${psql('show wal_level')}`);
} catch (e) {
  console.error(`diagnostics failed: ${e.message}`);
}
process.exit(1);
