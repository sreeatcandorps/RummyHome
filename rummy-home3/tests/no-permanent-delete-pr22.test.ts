import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { HELP } from './_helpLegacy';
import { DELETE_GAME_BODY } from '../utils/archive';
import { DELETED_GAMES_SUPPORTING, hiddenForGoodLabel, SUPPORT_CARD_BODY } from '../utils/deletedGames';
import { dotTone, kindLabel } from '../utils/eventLog';

// PR 22 / migration 046 — Sree's rule (Nov 15, 11:16 AM PT): nothing about games or results is ever
// permanently deleted by the app. After 30 days a deleted game becomes a second-layer soft delete
// (games.archived_at): hidden from every user, not restorable in the app, kept for support.
// X22-5 pins the migration text (no delete, non-destructive cron) and X22-6 the app copy (no promise
// of erasure anywhere a player reads).

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

test('X22-5 migration 046 is written, not applied: archived_at, archive step, harmless purge name, nightly cron', () => {
  const sql = read('supabase/migrations/046_no_permanent_delete.sql');
  for (const needle of [
    'alter table public.games add column if not exists archived_at timestamptz',
    'create or replace function public.archive_deleted_games()',
    "'restore_requested', 'game_purged', 'game_archived'",
    'and g.archived_at is null',
    "cron.schedule('archive-deleted-games', '15 3 * * *', 'select public.archive_deleted_games();')",
    "where jobname in ('purge-deleted-games', 'archive-deleted-games')",
    'revoke all on function public.archive_deleted_games() from public, anon, authenticated;',
    "errcode = 'PT410'",
    'support@ezscore.app',
  ]) assert.ok(sql.includes(needle), needle);
  assert.ok(!/delete\s+from\s+public\.games/i.test(sql), '046 never deletes a game');
  assert.ok(!/delete\s+from\s+public\.(rounds|scores|game_players|game_results|event_log)/i.test(sql), '046 never deletes a round, score, seat, result or Log row');
  // the one delete left is 045's: a fulfilled ask is cleared when its game is restored
  assert.equal((sql.match(/delete\s+from/gi) ?? []).length, 1);
  assert.match(sql, /delete from public\.restore_requests where game_id = p_game_id;/);
  assert.ok(!/drop\s+table/i.test(sql), '046 drops no table');
  // the 045 name is kept but is the same step
  assert.match(sql, /create or replace function public\.purge_deleted_games\(\)[\s\S]*?select public\.archive_deleted_games\(\);/);
});

test('X22-5 rollback 046 exists, is wired into the replay hook and does not reschedule the purge', () => {
  const rollback = read('supabase/rollback/rollback_046_no_permanent_delete.sql');
  assert.ok(rollback.includes('drop function if exists public.archive_deleted_games();'));
  assert.ok(rollback.includes('alter table public.games drop column if exists archived_at;'));
  assert.ok(rollback.includes("where jobname = 'archive-deleted-games'"));
  assert.ok(!rollback.includes("cron.schedule('purge-deleted-games'"), 'the rollback leaves the purge job off');
  const hook = read('../ci/db/replay-rollbacks.sh');
  assert.ok(hook.includes('rollback_046_no_permanent_delete.sql'));
  assert.ok(hook.includes('046_no_permanent_delete'));
});

test('X22-5 the pgTAP file for 046 exists and 36 no longer expects a hard delete', () => {
  const t37 = read('supabase/tests/37_no_permanent_delete_046.sql');
  assert.ok(t37.includes('archive_deleted_games'));
  assert.ok(t37.includes('no game row was removed'));
  const t36 = read('supabase/tests/36_going_rogue_045.sql');
  assert.ok(!t36.includes('the 31-day-old game is gone'), '36 was updated for 046');
  assert.ok(t36.includes('nothing is deleted'));
});

test('X22-6 no screen, dialog, Help line or email promises erasure', () => {
  const copy = [
    DELETE_GAME_BODY,
    DELETED_GAMES_SUPPORTING,
    SUPPORT_CARD_BODY,
    HELP.hiddenDeleted,
    hiddenForGoodLabel('2026-12-14T12:00:00Z', new Date('2026-11-12T12:00:00Z')),
    read('app/(screens)/hidden-deleted.tsx'),
    read('supabase/functions/send-email/index.ts'),
  ].join('\n');
  for (const banned of [/gone for good/i, /erased for good/i, /no longer exists/i, /permanently/i, /\berase[sd]? (it|them)\b/i]) {
    assert.ok(!banned.test(copy), `copy must not say ${banned}`);
  }
  assert.match(DELETE_GAME_BODY, /hidden for good — nothing is erased/);
  assert.match(DELETED_GAMES_SUPPORTING, /hidden for good after 30 days — nothing is erased/);
  assert.match(SUPPORT_CARD_BODY, /Nothing is ever erased/);
  assert.match(HELP.hiddenDeleted, /hidden for good — nothing is ever erased/);
  assert.equal(hiddenForGoodLabel('2026-12-14T12:00:00Z', new Date('2026-11-12T12:00:00Z')), 'hidden for good on Dec 14');
});

test('X22-6 the Log labels the nightly step "Hidden for good"; the 045 kind keeps its label for old rows', () => {
  assert.equal(kindLabel('game_archived'), 'Hidden for good');
  assert.equal(dotTone({ kind: 'game_archived', level: 'important' }), 'red');
  assert.equal(kindLabel('game_purged'), 'Erased');
});

test('X22-6 the roles flow r05 reads the new card line', () => {
  const flow = read('e2e/roles/r05-deleted-game-ask-restore.yaml');
  assert.ok(flow.includes('hidden for good on'));
  assert.ok(!flow.includes('gone for good'));
});
