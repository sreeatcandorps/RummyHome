import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  GUARDRAILS,
  GUARDRAIL_MESSAGES,
  GUARDRAIL_SQLSTATE,
  countInLastDay,
  emailRetryDelayMs,
  guardrailKeyOf,
  isGuardrailError,
  localGameGuard,
  localMyPlayersGuard,
  localRoundsGuard,
} from '../utils/guardrails';
import { GAME_SIZE_MESSAGE, MAX_SEATED_PLAYERS, SEATED_PLAYER_LIMIT } from '../constants/limits';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const sql = src('supabase/migrations/029_guardrails.sql');

test('029: the limits Sree asked for, and the app repeats the exact server wording', () => {
  assert.deepEqual(GUARDRAILS, {
    myPlayersMax: 1000, playersAddedPerDay: 100, playersPerGame: 20, roundsPerGame: 500,
    liveGamesPerUser: 10, gamesPerDay: 50, linkRequestsPending: 20, emailPerDay: 90, emailPerFlush: 50,
  });
  for (const [key, message] of Object.entries(GUARDRAIL_MESSAGES)) {
    assert.match(sql, new RegExp(`\\('${key}', \\d+, '${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "''")}'`), `${key}: the migration inserts the same message`);
  }
  assert.match(sql, /\('my_players_max', 1000,/);
  assert.match(sql, /update public\.guardrails set value = 1000 where key = 'my_players_max' and value = 2000/, 'a database that ran the 2,000 version is brought to 1,000');
  assert.equal(GUARDRAIL_MESSAGES.my_players_max, "You've reached your limit of 1,000 players.");
  assert.equal(GUARDRAIL_MESSAGES.rounds_per_game, 'This game has reached 500 rounds. Create a new game to keep playing.');
  assert.match(sql, /\('players_added_per_day', 100,/);
  assert.match(sql, /\('players_per_game', 20,/);
  assert.match(sql, /\('rounds_per_game', 500,/);
  assert.match(sql, /\('live_games_per_user', 10,/);
  assert.match(sql, /\('games_per_day', 50,/);
  assert.match(sql, /\('link_requests_pending', 20,/);
  assert.match(sql, /\('email_per_day', 90,/);
  assert.match(sql, /on conflict \(key\) do update set message = excluded\.message, description = excluded\.description/, 'a re-run keeps tuned values');
  assert.equal(MAX_SEATED_PLAYERS, 20, 'the seat cap in the app is the guardrail');
  assert.equal(SEATED_PLAYER_LIMIT, GUARDRAIL_MESSAGES.players_per_game);
  assert.equal(GAME_SIZE_MESSAGE, 'A game must have between 2 and 20 players.');
  assert.match(src('constants/help.ts'), /Up to 20 players\./);
});

test('029: enforced by BEFORE triggers on the tables (not only in RPCs), each raising GRD01', () => {
  for (const table of ['my_players', 'game_players', 'rounds', 'games', 'player_links']) {
    assert.match(sql, new RegExp(`create trigger ${table}_0_guard\\s+before insert[^;]*on public\\.${table}`), `${table} is guarded on insert`);
  }
  assert.match(sql, /before insert or update of removed_at on public\.my_players/, 'a restore counts against the My players size');
  assert.match(sql, /before insert or update of is_active, role, seated on public\.game_players/, 'seating an admin counts');
  assert.match(sql, /using errcode = 'GRD01', hint = 'guardrail:' \|\| p_key/);
  assert.equal(GUARDRAIL_SQLSTATE, 'GRD01');
  assert.match(sql, /r\.undone_at is null/, 'undone rounds do not count, so editing round 500 still works');
  assert.match(sql, /g\.status = 'active' and g\.deleted_at is null and g\.closed_at is null/, 'live = active, not deleted, not closed');
  assert.match(sql, /created_at > now\(\) - interval '24 hours'/, 'per day is a rolling 24 hours');
  assert.match(sql, /revoke all on function public\.guardrail_refuse\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant select on public\.guardrails to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all) on public\.guardrails/);
});

test('029: the app recognises a guardrail refusal and names the limit', () => {
  assert.equal(isGuardrailError({ code: 'GRD01', message: 'anything' }), true);
  assert.equal(isGuardrailError({ code: 'P0001', hint: 'guardrail:rounds_per_game', message: 'x' }), true);
  assert.equal(isGuardrailError({ message: 'A game holds at most 20 players.' }), true);
  assert.equal(isGuardrailError({ code: 'PT409', message: 'Round 3 was just saved by someone else.' }), false);
  assert.equal(isGuardrailError(null), false);
  assert.equal(guardrailKeyOf({ hint: 'guardrail:games_per_day', message: '' }), 'games_per_day');
  assert.equal(guardrailKeyOf({ message: 'You have 10 live games. Finish or close one first.' }), 'live_games_per_user');
  assert.equal(guardrailKeyOf({ message: 'nope' }), null);
});

test('029: the local prototype applies the same caps', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const recent = new Date(now - 60_000).toISOString();
  const old = new Date(now - 25 * 3600_000).toISOString();
  assert.equal(countInLastDay([recent, old, null, undefined], now), 1);

  const live = Array.from({ length: 10 }, () => ({ createdBy: 'me', status: 'active', createdAt: old }));
  assert.equal(localGameGuard(live, 'me', now), GUARDRAIL_MESSAGES.live_games_per_user);
  assert.equal(localGameGuard(live.map((g, i) => (i === 0 ? { ...g, closedAt: recent } : g)), 'me', now), null, 'a closed game frees a slot');
  assert.equal(localGameGuard(live.map((g, i) => (i === 0 ? { ...g, deletedAt: recent } : g)), 'me', now), null, 'a deleted game frees a slot');
  assert.equal(localGameGuard(live, 'someone-else', now), null, 'only the creator\'s games count');
  const burst = Array.from({ length: 50 }, () => ({ createdBy: 'me', status: 'completed', createdAt: recent }));
  assert.equal(localGameGuard(burst, 'me', now), GUARDRAIL_MESSAGES.games_per_day);
  assert.equal(localGameGuard(burst.slice(1), 'me', now), null);

  const roster = Array.from({ length: 1000 }, () => ({ ownerId: 'me', createdAt: old }));
  assert.equal(localMyPlayersGuard(roster, 'me', now), GUARDRAIL_MESSAGES.my_players_max);
  assert.equal(localMyPlayersGuard(roster.map((r, i) => (i === 0 ? { ...r, removedAt: recent } : r)), 'me', now), null, 'a removed row does not count');
  const added = Array.from({ length: 100 }, () => ({ ownerId: 'me', createdAt: recent }));
  assert.equal(localMyPlayersGuard(added, 'me', now), GUARDRAIL_MESSAGES.players_added_per_day);
  assert.equal(localMyPlayersGuard(added, 'other', now), null);

  assert.equal(localRoundsGuard(499), null);
  assert.equal(localRoundsGuard(500), GUARDRAIL_MESSAGES.rounds_per_game);
  assert.match(src('services/games.ts'), /localGameGuard\(existingGames/);
  assert.match(src('services/games.ts'), /localRoundsGuard\(liveRounds\)/);
  assert.match(src('services/players.ts'), /localMyPlayersGuard\(rows, ownerId\)/);
});

test('029: the email backlog is queued and retried, never dropped', () => {
  assert.equal(emailRetryDelayMs(1, 500, 'boom'), 5 * 60_000, 'first failure: 5 minutes');
  assert.equal(emailRetryDelayMs(2, 500, 'boom'), 10 * 60_000);
  assert.equal(emailRetryDelayMs(3, 0, 'Resend unreachable'), 20 * 60_000, 'provider down counts like a failure');
  assert.equal(emailRetryDelayMs(12, 500, 'boom'), 24 * 3600_000, 'capped at a day');
  assert.equal(emailRetryDelayMs(1, 429, 'rate_limit_exceeded'), 60_000, 'a rate limit waits a minute');
  assert.equal(emailRetryDelayMs(1, 429, 'You have reached your daily email sending quota'), 24 * 3600_000, 'the daily quota waits a day');

  const fn = src('supabase/functions/send-email/index.ts');
  assert.doesNotMatch(fn, /MAX_ATTEMPTS/, 'no attempt cap: rows are never abandoned');
  assert.match(fn, /\.lte\('next_attempt_at', nowIso\)/, 'only due rows are sent');
  assert.match(fn, /next_attempt_at: retryAt/, 'a failed row is pushed out, not deleted');
  assert.doesNotMatch(fn, /from\('email_outbox'\)\s*\.delete\(/, 'the flush never deletes');
  assert.match(fn, /'email_per_day', 'email_per_flush'/, 'the caps come from public.guardrails');
  assert.match(fn, /Daily email cap reached/);
  assert.match(fn, /if \(result\.status === 429\) break;/, 'a 429 stops the run; the rest wait');
  assert.match(fn, /SEND_GAP_MS = 550/, 'under Resend\'s 2 requests a second');
  assert.match(sql, /add column if not exists next_attempt_at timestamptz not null default now\(\)/);
  assert.match(sql, /create or replace function public\.email_sends_left_today\(\)/);
  assert.match(sql, /create or replace function public\.email_outbox_backlog\(\)/);
});

test('029: docs/guardrails.md lists every limit with its message and every failure mode', () => {
  const doc = src('docs/guardrails.md');
  for (const [key, message] of Object.entries(GUARDRAIL_MESSAGES)) {
    assert.match(doc, new RegExp(key), `${key} is documented`);
    assert.ok(doc.includes(message), `${key}: the message is documented verbatim`);
  }
  for (const mode of ['Offline', 'Email provider down', 'Slow database', 'Duplicate taps', 'Two admins', 'daily cap', 'Tuning']) {
    assert.match(doc, new RegExp(mode, 'i'), `${mode} is covered`);
  }
  assert.match(doc, /GRD01/);
});
