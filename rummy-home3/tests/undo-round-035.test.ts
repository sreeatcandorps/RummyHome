import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ROUND_CONFLICT_FALLBACK_MESSAGE,
  isRoundConflict,
  roundConflictMessage,
  toRoundConflictError,
} from '../utils/roundConflict';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const migration = src('supabase/migrations/035_undo_round.sql');
const rollback = src('supabase/rollback/rollback_035_undo_round.sql');

test('035 (a): live rounds are unique per number; undone rows leave the key', () => {
  assert.match(migration, /alter table public\.rounds drop constraint if exists rounds_game_id_round_number_key;/);
  assert.match(migration, /create unique index if not exists rounds_live_number_uidx on public\.rounds \(game_id, round_number\) where undone_at is null;/);
  // D2.2: undone rows still sitting at N move to 1000+N once, idempotently
  assert.match(migration, /where undone_at is not null and round_number < 1000/);
});

test('035 (b): undo_last_round is one locked server step that moves current_round back', () => {
  const fn = migration.slice(migration.indexOf('create or replace function public.undo_last_round('), migration.indexOf('-- C. save_round: 031 body'));
  assert.match(fn, /perform pg_advisory_xact_lock\(hashtextextended\('game:' \|\| p_game_id::text, 0\)\);/, 'same per-game lock as save_round');
  assert.match(fn, /Only a game admin can undo a round\./);
  assert.match(fn, /where game_id = p_game_id and undone_at is null\s+order by round_number desc\s+limit 1\s+for update;/);
  assert.match(fn, /set undone_at = now\(\), undone_by = auth\.uid\(\), undo_reason = 'admin undo'/);
  assert.match(fn, /set current_round = v_round\.round_number/);
  assert.match(fn, /return jsonb_build_object\('roundId', v_round\.id, 'roundNumber', v_round\.round_number\);/);
  assert.match(fn, /revoke all on function public\.undo_last_round\(uuid\) from public, anon;/);
  assert.match(fn, /grant execute on function public\.undo_last_round\(uuid\) to authenticated;/);
  assert.doesNotMatch(fn, /security definer/, 'the admin RLS update policy on rounds is enough');
});

test('035 (c): save_round names the admin who saved first and refuses a number past the last live round', () => {
  const fn = migration.slice(migration.indexOf('create or replace function public.save_round('));
  assert.match(fn, /Round % was just saved by %\. Check the scorecard before you save again\./);
  assert.match(fn, /left join public\.profiles p on p\.id = r\.created_by/);
  assert.match(fn, /A round was undone while you were scoring\. The scorecard has been refreshed; check the round number and save again\./);
  assert.equal((fn.match(/using errcode = 'PT409'/g) ?? []).length, 3, 'all three conflicts use PT409');
  assert.doesNotMatch(fn, /saved by someone else/);
});

test('035 rollback: drops the RPC, restores the full unique key after parking undone rows, and the 031 message', () => {
  assert.match(rollback, /drop function if exists public\.undo_last_round\(uuid\);/);
  assert.match(rollback, /drop index if exists public\.rounds_live_number_uidx;/);
  assert.match(rollback, /add constraint rounds_game_id_round_number_key unique \(game_id, round_number\)/);
  assert.match(rollback, /Round % was just saved by someone else\./);
  assert.ok(rollback.indexOf('1000 * v_attempt') < rollback.indexOf('add constraint rounds_game_id_round_number_key'), 'colliding undone rows move before the key is re-created');
});

test('2.7: a raw 23505 is still a conflict but is no longer blamed on another admin', () => {
  const raw = { code: '23505', message: 'duplicate key value violates unique constraint "rounds_game_id_round_number_key"' };
  assert.equal(isRoundConflict(raw), true);
  assert.equal(roundConflictMessage(raw), ROUND_CONFLICT_FALLBACK_MESSAGE);
  assert.equal(ROUND_CONFLICT_FALLBACK_MESSAGE, 'The scorecard changed. It has been refreshed; try again.');
  assert.doesNotMatch(toRoundConflictError(raw).message, /someone else/);
});

test('035: the server message with the saver name reaches the dialog untouched', () => {
  const named = { code: 'PT409', message: 'Round 3 was just saved by Harish Gadupudi. Check the scorecard before you save again.' };
  assert.equal(roundConflictMessage(named), named.message);
});

test('035: the app undoes through the RPC and only falls back to direct writes when it is missing', () => {
  const games = src('services/games.ts');
  const undo = games.slice(games.indexOf('async undoLastRound('), games.indexOf('async reopenGame(') > 0 ? games.indexOf('async reopenGame(') : undefined);
  assert.match(undo, /supabase\.rpc\('undo_last_round', \{ p_game_id: gameId \}\)/);
  assert.match(undo, /if \(rpcError\.code !== MISSING_FUNCTION\) throw rpcError;/);
  assert.match(src('types/database.ts'), /undo_last_round: \{\s+Args: \{ p_game_id: string \};/);
});
