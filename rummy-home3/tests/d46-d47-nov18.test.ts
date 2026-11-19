import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { reopenClearsAwards, REOPEN_CLEARS_AWARDS_NOTE } from '../utils/gameStatus';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

// ---- D46 C (Sree, Nov 18): reopening a pool that has awards clears them ----

test('D46 C: only a pool with awards loses them on reopen', () => {
  assert.equal(reopenClearsAwards({ gameType: 'pool', awardedAt: '2026-11-18T10:00:00Z' }), true);
  assert.equal(reopenClearsAwards({ gameType: 'pool', awardedAt: null }), false, 'awards pending: nothing to clear');
  assert.equal(reopenClearsAwards({ gameType: 'pool' }), false);
  assert.equal(reopenClearsAwards({ gameType: 'stake', awardedAt: '2026-11-18T10:00:00Z' }), false, 'Points never has pool awards');
  assert.match(REOPEN_CLEARS_AWARDS_NOTE, /cleared/);
  assert.match(REOPEN_CLEARS_AWARDS_NOTE, /after the next Complete/);
});

test('D46 C: reopenGame clears the award columns (local and hosted) and the dialog says so', () => {
  const service = src('services/games.ts');
  assert.match(service, /const clearsAwards = reopenClearsAwards\(game\);/);
  assert.match(service, /\.\.\.\(clearsAwards \? \{ prizeShares: null, awardedAt: null, awardNote: null \} : \{\}\)/, 'local mode');
  assert.match(service, /\.\.\.\(clearsAwards \? \{ prize_shares: null, awarded_at: null, awarded_by: null, award_note: null \} : \{\}\)/, 'hosted update');
  assert.match(service, /\.eq\('status', 'completed'\)\s*\.select\('id'\)/, 'only a Completed game is reopened (a Closed one too, D49)');
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /\{reopenClearsAwards\(game\) \? \([\s\S]*?testID="reopen-clears-awards">[\s\S]*?\{REOPEN_CLEARS_AWARDS_NOTE\}/, 'the Reopen dialog warns a pool with awards');
});

test('D46 C: migration 049 (trigger + Log line), its rollback, pgTAP and the rollback replay', () => {
  const mig = src('supabase/migrations/049_reopen_pool_clears_awards.sql');
  assert.match(mig, /create or replace function public\.games_pool_reopen_clears_awards\(\)/);
  assert.match(mig, /new\.game_type = 'pool' and old\.status = 'completed' and new\.status = 'active'\s*and old\.awarded_at is not null/);
  for (const col of ['prize_shares', 'awarded_at', 'awarded_by', 'award_note']) assert.match(mig, new RegExp(`new\\.${col} := null;`));
  assert.match(mig, /'awards_changed', 'important',\s*'Awards cleared · The pool was reopened; give them again after Complete'/, 'reuses the awards_changed kind (amber dot), no constraint change');
  assert.match(mig, /create trigger games_pool_reopen_clears_awards before update of status on public\.games/);
  assert.ok(existsSync(path.join(process.cwd(), 'supabase/rollback/rollback_049_reopen_pool_clears_awards.sql')));
  assert.match(src('supabase/rollback/rollback_049_reopen_pool_clears_awards.sql'), /drop trigger if exists games_pool_reopen_clears_awards on public\.games;\s*drop function if exists public\.games_pool_reopen_clears_awards\(\);/);
  assert.ok(existsSync(path.join(process.cwd(), 'supabase/tests/40_reopen_pool_clears_awards_049.sql')));
  const replay = src('../ci/db/replay-rollbacks.sh');
  assert.match(replay, /rollback_049_reopen_pool_clears_awards\.sql/);
  assert.match(replay, /\[ "\$HAS_049" = t \] && FORWARD="\$FORWARD 049_reopen_pool_clears_awards"/);
  assert.match(replay, /049 restored/);
});

// ---- D47 B (Sree, Nov 18): sideways = wider than tall, on every device ----

test('D47 B: the pool layout is decided by width > height, the compact chrome still by height', () => {
  const layout = src('hooks/useLayout.ts');
  assert.match(layout, /const isLandscape = width > height;/);
  assert.match(layout, /const isShort = height < 520;/);
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /const \{ isShort, isLandscape, insets, gutterLeft, gutterRight \} = useLayout\(\);/);
  assert.match(screen, /const sideways = isLandscape;/);
  assert.match(screen, /hugRows=\{pool && !sideways \? POOL_CARD_MAX_ROWS : undefined\}/, 'upright: the five-row card');
  assert.match(screen, /\{sideways \? \(\s*<View\s+style=\{\[\s*styles\.landscapeBody,/, 'sideways: the table alone, on a tablet too');
  assert.match(screen, /pool && sideways && canManageNow && !game\.closedAt \?[\s\S]*?testID="strip-give-awards"/, 'sideways completed pool: awards from the strip');
  assert.doesNotMatch(screen, /pool && !isShort|pool && isShort/, 'no height-based pool layout left');
  assert.match(screen, /compact=\{isShort\}/, 'compact chrome stays a matter of height');
});
