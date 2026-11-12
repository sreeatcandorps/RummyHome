import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isRoundConflict,
  ROUND_CONFLICT_CODE,
  ROUND_CONFLICT_FALLBACK_MESSAGE,
  RoundConflictError,
  roundConflictMessage,
  toRoundConflictError,
} from '../utils/roundConflict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

// ---------------------------------------------------------------------------
// Round conflicts (fix c): what the client does with the server's answer
// ---------------------------------------------------------------------------

test('a 019 PT409 answer is a round conflict and keeps the server sentence', () => {
  const error = { code: 'PT409', message: 'Round 3 was just saved by someone else. The scorecard has been refreshed; check it before you save again.' };
  assert.equal(isRoundConflict(error), true);
  assert.equal(roundConflictMessage(error), error.message);
  const mapped = toRoundConflictError(error);
  assert.ok(mapped instanceof RoundConflictError);
  assert.equal(mapped.code, ROUND_CONFLICT_CODE);
  assert.equal(mapped.message, error.message);
  assert.equal(isRoundConflict(mapped), true, 'an already mapped error is still a conflict');
  assert.equal(toRoundConflictError(mapped), mapped, 'mapping twice returns the same error');
});

test('a raw 23505 from a pre-019 server is a round conflict with the generic sentence', () => {
  const error = {
    code: '23505',
    message: 'duplicate key value violates unique constraint "rounds_game_id_round_number_key"',
    details: 'Key (game_id, round_number)=(x, 3) already exists.',
  };
  assert.equal(isRoundConflict(error), true);
  assert.equal(roundConflictMessage(error), ROUND_CONFLICT_FALLBACK_MESSAGE);
  assert.doesNotMatch(ROUND_CONFLICT_FALLBACK_MESSAGE, /23505|unique|constraint|sql|postgres/i, 'no database words reach the player');
  assert.match(ROUND_CONFLICT_FALLBACK_MESSAGE, /just saved by someone else/);
  assert.match(ROUND_CONFLICT_FALLBACK_MESSAGE, /refreshed/);
});

test('a unique violation reported only in the message text (no code) still counts', () => {
  assert.equal(isRoundConflict({ message: 'duplicate key value violates unique constraint "rounds_game_id_round_number_key"' }), true);
});

test('other errors are not conflicts', () => {
  assert.equal(isRoundConflict(null), false);
  assert.equal(isRoundConflict(undefined), false);
  assert.equal(isRoundConflict(new Error('Network request failed')), false);
  assert.equal(isRoundConflict({ code: '42501', message: 'Only a game admin can save scores.' }), false);
  assert.equal(isRoundConflict({ code: 'PGRST202', message: 'Could not find the function' }), false);
  assert.equal(isRoundConflict({ code: '23503', message: 'insert or update on table "scores" violates foreign key constraint' }), false);
  assert.equal(roundConflictMessage({ code: '42501', message: 'nope' }), ROUND_CONFLICT_FALLBACK_MESSAGE);
});

test('writeRound throws RoundConflictError on PT409 (and on the legacy unique violation) instead of the raw error', () => {
  const service = read('services/games.ts');
  assert.match(service, /import \{ isRoundConflict, toRoundConflictError \} from '@\/utils\/roundConflict'/);
  assert.match(service, /if \(isRoundConflict\(rpcError\)\) throw toRoundConflictError\(rpcError\);/);
  assert.match(service, /if \(rpcError\.code !== MISSING_FUNCTION\) throw rpcError;/, 'the missing-function fallback is still after the conflict check');
  assert.match(service, /throw isRoundConflict\(roundError\) \? toRoundConflictError\(roundError\) : roundError/, 'the pre-014 fallback maps the same race');
});

test('Add round shows the conflict, clears the typed scores and returns to the scorecard (Edit reloads the round)', () => {
  const screen = read('app/(screens)/score-entry.tsx');
  assert.match(screen, /import \{ isRoundConflict, roundConflictMessage \} from '\.\.\/\.\.\/utils\/roundConflict'/);
  assert.match(screen, /if \(isRoundConflict\(error\)\) \{/);
  assert.match(screen, /if \(!editRound\) setEntry\(initialRoundEntryState\);/, 'typed scores are dropped so they cannot land on the next round');
  assert.match(screen, /else await loadGameData\(\);/, 'Edit mode reloads the round as it is now');
  assert.match(screen, /title: 'Round already saved',\s+body: roundConflictMessage\(error\)/);
  assert.match(screen, /onClose: editRound \? undefined : closeScreen/, 'Add mode goes back to the scorecard instead of staying on the next round');
  assert.match(screen, /const dismissNotice = \(\) => \{\s+const onClose = notice\?\.onClose;\s+setNotice\(null\);\s+onClose\?\.\(\);/);
  assert.match(screen, /onDismiss=\{dismissNotice\}/);
  assert.match(screen, /onPress=\{dismissNotice\} contentStyle=\{styles\.dialogButtonContent\}/);
});

// ---------------------------------------------------------------------------
// Migration 019 and its rollback
// ---------------------------------------------------------------------------

const migration = read('supabase/migrations/019_security_and_concurrency_fixes.sql');
const rollback = read('supabase/rollback/rollback_019_security_and_concurrency_fixes.sql');

test('019 (a): profiles.role is locked by a trigger that only an app admin or the service role passes', () => {
  assert.match(migration, /create or replace function public\.lock_profile_role\(\)/);
  assert.match(migration, /auth\.uid\(\) is null/, 'direct SQL / GoTrue (no user JWT) may set roles');
  assert.match(migration, /auth\.jwt\(\) ->> 'role', ''\) = 'service_role'/);
  assert.match(migration, /or public\.is_app_admin\(\)/);
  assert.match(migration, /new\.role is distinct from old\.role and not v_privileged/);
  assert.match(migration, /Only an app admin can change a player''s role\./);
  assert.match(migration, /using errcode = '42501'/);
  assert.match(migration, /create trigger profiles_lock_role\s+before insert or update of role on public\.profiles/);
  assert.match(migration, /drop trigger if exists profiles_lock_role on public\.profiles;/, 'safe to re-run');
});

test('019 (b): email, phone and zip_code are not granted to signed-in users; the owner reads my_profile', () => {
  assert.match(migration, /revoke select on public\.profiles from anon;/);
  assert.match(migration, /revoke select on public\.profiles from authenticated;/);
  const grant = migration.match(/grant select \(([\s\S]*?)\) on public\.profiles to authenticated;/);
  assert.ok(grant, 'a column-level grant exists');
  const columns = grant![1].split(',').map((c) => c.trim());
  for (const hidden of ['email', 'phone', 'zip_code']) assert.ok(!columns.includes(hidden), `${hidden} is not granted`);
  for (const shown of ['id', 'display_name', 'avatar_url', 'player_code', 'public_player_no', 'player_status', 'managed_by', 'first_name', 'last_name']) {
    assert.ok(columns.includes(shown), `${shown} is granted (name, avatar, Player ID, status)`);
  }
  assert.match(migration, /create or replace view public\.my_profile as\s+select p\.\*\s+from public\.profiles p\s+where p\.id = auth\.uid\(\);/);
  assert.match(migration, /alter view public\.my_profile set \(security_barrier = true\);/);
  assert.match(migration, /revoke all on public\.my_profile from anon;/);
  assert.match(migration, /grant select on public\.my_profile to authenticated;/);
  assert.doesNotMatch(migration, /security_invoker/, 'the view must run as its owner to bypass the column grants for the one own row');
});

test('019 (c): save_round takes a per-game lock, treats the same payload as a no-op and a different one as PT409', () => {
  const fn = migration.slice(migration.indexOf('create or replace function public.save_round('), migration.indexOf('-- D. remove_seat_if_no_scores'));
  assert.match(fn, /perform pg_advisory_xact_lock\(hashtextextended\('game:' \|\| p_game_id::text, 0\)\);/);
  assert.match(fn, /except/, 'payload compared to the saved scores set-wise');
  assert.match(fn, /if v_differences > 0 then/);
  assert.match(fn, /Round % was just saved by someone else\. The scorecard has been refreshed; check it before you save again\./);
  assert.match(fn, /The players in this game changed while you were scoring\./);
  assert.equal((fn.match(/using errcode = 'PT409'/g) ?? []).length, 2, 'both conflicts use PT409 (HTTP 409 through PostgREST)');
  assert.match(fn, /revoke all on function public\.save_round\(uuid, integer, jsonb, boolean\) from anon;/);
  assert.match(fn, /grant execute on function public\.save_round\(uuid, integer, jsonb, boolean\) to authenticated;/);
  assert.doesNotMatch(fn, /security definer/, 'save_round stays security invoker');
});

test('019 (d): remove_seat_if_no_scores takes the same per-game lock before touching the seat', () => {
  const fn = migration.slice(migration.indexOf('-- D. remove_seat_if_no_scores'));
  const lock = fn.indexOf("pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0))");
  const seatLock = fn.indexOf('for update;');
  assert.ok(lock > 0 && seatLock > lock, 'the game lock is taken before the game_players row lock');
  assert.match(fn, /security definer/);
  assert.match(fn, /You cannot delete this player\./, 'the 016 rules are kept');
});

test('019 is idempotent in shape and documents the apply order', () => {
  assert.match(migration, /Apply after 017 and 018/);
  assert.match(migration, /Safe to re-run/);
  assert.equal((migration.match(/create or replace function/g) ?? []).length, 3);
  assert.equal((migration.match(/create or replace view/g) ?? []).length, 1);
  assert.doesNotMatch(migration, /^create function/m);
  assert.doesNotMatch(migration, /^create view/m);
});

test('rollback 019 restores the 014 and 016 bodies, whole-table select, and drops the trigger and view', () => {
  assert.match(rollback, /drop trigger if exists profiles_lock_role on public\.profiles;/);
  assert.match(rollback, /drop function if exists public\.lock_profile_role\(\);/);
  assert.match(rollback, /drop view if exists public\.my_profile;/);
  assert.match(rollback, /grant select on public\.profiles to authenticated;/);
  assert.match(rollback, /grant select on public\.profiles to anon;/);
  assert.match(rollback, /create or replace function public\.save_round\(/);
  assert.match(rollback, /create or replace function public\.remove_seat_if_no_scores\(p_game_id uuid, p_profile_id uuid\)/);
  const fourteen = read('supabase/migrations/014_save_round_atomic.sql');
  const sixteen = read('supabase/migrations/016_remove_seat_if_no_scores.sql');
  const body = (sql: string, name: string) => sql.slice(sql.indexOf(`create or replace function public.${name}(`), sql.indexOf('$$;', sql.indexOf(`create or replace function public.${name}(`)) + 3);
  assert.equal(body(rollback, 'save_round'), body(fourteen, 'save_round'), 'save_round rollback body is exactly the 014 body');
  assert.equal(body(rollback, 'remove_seat_if_no_scores'), body(sixteen, 'remove_seat_if_no_scores'), 'remove_seat_if_no_scores rollback body is exactly the 016 body');
  for (const name of ['save_round', 'remove_seat_if_no_scores']) {
    assert.doesNotMatch(body(rollback, name), /pg_advisory_xact_lock|PT409/, `${name} rollback body has no per-game lock and no conflict code`);
  }
});

// ---------------------------------------------------------------------------
// The client against a 019 database (and before it)
// ---------------------------------------------------------------------------

test('the app reads its own profile from my_profile and falls back to profiles when the view is missing', () => {
  const auth = read('services/auth.ts');
  assert.match(auth, /async function readOwnProfile\(userId: string\)/);
  assert.match(auth, /supabase\.from\('my_profile'\)\.select\('\*'\)\.eq\('id', userId\)\.maybeSingle\(\)/);
  assert.match(auth, /if \(!missingRelation\(own\.error\)\) throw own\.error;/);
  assert.match(auth, /supabase\.from\('profiles'\)\.select\('\*'\)\.eq\('id', userId\)\.maybeSingle\(\)/, 'pre-019 fallback');
  assert.match(auth, /code === 'PGRST205'/);
  assert.doesNotMatch(auth, /\.select\('\*'\)\n\s+\.single\(\)/, 'updates no longer RETURNING * (contact columns are not selectable)');
  assert.doesNotMatch(auth, /\.select\('phone'\)/, 'updatePhone no longer returns the phone column directly');
});

test('other players are read with named safe columns only, never select(*) on profiles', () => {
  const players = read('services/players.ts');
  assert.match(players, /export const PUBLIC_PROFILE_COLUMNS =/);
  for (const hidden of ['email', 'phone', 'zip_code']) {
    assert.doesNotMatch(players.match(/PUBLIC_PROFILE_COLUMNS =\s+'([^']+)'/)![1], new RegExp(`\\b${hidden}\\b`), `${hidden} is not requested`);
  }
  assert.doesNotMatch(players, /from\('profiles'\)\s*\.select\('\*'\)/);
  assert.doesNotMatch(players, /ilike\('email'/, 'no email filter on the table (needs select on email)');
  const games = read('services/games.ts');
  const embeds = games.match(/profiles\(([^)]*)\)/g) ?? [];
  assert.ok(embeds.length >= 2, 'roster embeds exist');
  for (const embed of embeds) assert.doesNotMatch(embed, /\bemail\b/, `roster embed does not ask for email: ${embed}`);
});

// ---------------------------------------------------------------------------
// CI: the four findings are asserted, not recorded as known failures
// ---------------------------------------------------------------------------

test('the CI database suite has no known-failure markers left for the four findings', () => {
  const privacy = read('supabase/tests/04_profiles_privacy.sql');
  assert.doesNotMatch(privacy, /select todo\(/);
  assert.match(privacy, /a user cannot grant themselves app_admin/);
  assert.match(privacy, /a stranger cannot read other accounts'' email from profiles/);
  const concurrency = read('../ci/db/concurrency-save-round.mjs');
  assert.doesNotMatch(concurrency, /\{ todo:/);
  assert.match(concurrency, /second\.error\?\.code === 'PT409'/);
  assert.match(concurrency, /5a\. no score row is left behind for the removed player/);
  assert.match(concurrency, /5b\. the save that named the removed player is refused with PT409/);
  const replay = read('../ci/db/replay-rollbacks.sh');
  assert.match(replay, /rollback_019_security_and_concurrency_fixes\.sql/);
  assert.match(replay, /019_security_and_concurrency_fixes"/);
});
