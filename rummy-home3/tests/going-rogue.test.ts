import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  agoLabel, askButton, askedLine, ASK_RESTORE_LABEL, daysUntilPurge, DELETED_GAME_RETENTION_DAYS, deletedBannerLine, deletedCardLine,
  deletedHomeGamesFrom, deletionFromRow, hiddenForGoodLabel, purgeDate, RESTORE_GAME_LABEL, SUPPORT_CARD_BODY, SUPPORT_EMAIL,
} from '../utils/deletedGames';
import { DELETE_GAME_BODY } from '../utils/archive';
import { dotTone, kindLabel } from '../utils/eventLog';
import { HELP } from './_helpLegacy';

// PR 20 Going rogue (docs/going-rogue-design.md §6 items 2 + 3, Q20.1 purge): X20-6 — the Home bundle's
// deleted_games rows map to cards, the "hidden for good on" date math, the Ask button states, the banner
// and card copy; plus the G02 confirm text, the Log labels, the Help bullet and the migration's shape.

const root = process.cwd();
const src = (file: string) => readFileSync(path.join(root, file), 'utf8');

const NOW = new Date('2026-11-16T12:00:00Z');
const DELETED = '2026-11-14T12:00:00Z';
// stamps sit at noon UTC so formatWhenDay (local time) names the same day in any CI time zone

const row = (over: Record<string, unknown> = {}) => ({
  id: '10000000-0000-4000-8000-0000000000fa', game_number: 14, game_label: 'S14', game_type: 'stake', status: 'active',
  created_at: '2026-11-10T18:00:00Z', player_count: 4,
  deleted_at: DELETED, deleted_by: 'h', deleted_by_name: 'Harish', deleted_by_me: false,
  purge_at: '2026-12-14T12:00:00Z', can_restore: false, my_request_at: null, requests: [],
  ...over,
});

test('X20-6 hidden-for-good date math: deletedAt + 30 days, whole days left, never negative', () => {
  assert.equal(DELETED_GAME_RETENTION_DAYS, 30);
  assert.equal(purgeDate(DELETED), '2026-12-14T12:00:00.000Z');
  assert.equal(purgeDate(''), null);
  assert.equal(purgeDate('garbage'), null);
  assert.equal(daysUntilPurge('2026-12-14T12:00:00Z', NOW), 28);
  assert.equal(daysUntilPurge('2026-11-16T13:00:00Z', NOW), 1, 'an hour left still counts as a day');
  assert.equal(daysUntilPurge('2026-11-15T12:00:00Z', NOW), 0, 'past the date clamps to 0');
  assert.equal(daysUntilPurge(null, NOW), null);
});

test('X20-6 "hidden for good on …" (046) and "… ago" labels', () => {
  assert.equal(hiddenForGoodLabel('2026-12-14T12:00:00Z', NOW), 'hidden for good on Mon, Dec 14');
    assert.equal(hiddenForGoodLabel('2026-11-15T12:00:00Z', NOW), 'hidden for good today');
  assert.equal(hiddenForGoodLabel(null, NOW), '');
  assert.equal(agoLabel(DELETED, NOW), '2 days ago');
  assert.equal(agoLabel('2026-11-15T06:00:00Z', NOW), 'yesterday');
  assert.equal(agoLabel('2026-11-16T09:00:00Z', NOW), 'today');
});

test('X20-6 the card line and the banner line (G03 / G04)', () => {
  const deletion = deletionFromRow(row())!;
  assert.equal(deletedCardLine(deletion, NOW), 'Deleted by Harish · 2 days ago · hidden for good on Mon, Dec 14');
  assert.equal(deletedCardLine({ ...deletion, deletedByMe: true }, NOW), 'Deleted by you · 2 days ago · hidden for good on Mon, Dec 14');
  assert.equal(deletedBannerLine(deletion, NOW), 'This game was deleted by Harish 2 days ago · hidden for good on Mon, Dec 14');
});

test('X20-6 Ask button states: ask once, then "Asked · date"', () => {
  assert.deepEqual(askButton(null, NOW), { label: ASK_RESTORE_LABEL, disabled: false });
  assert.equal(ASK_RESTORE_LABEL, 'Ask an admin to restore');
  assert.deepEqual(askButton('2026-11-10T12:00:00Z', NOW), { label: 'Asked · Tue, Nov 10', disabled: true });
  assert.equal(RESTORE_GAME_LABEL, 'Restore game');
});

test('X20-6 "Anil asked to restore it" names everyone who asked; the viewer is "You"', () => {
  assert.equal(askedLine([], 'me'), null);
  assert.equal(askedLine(undefined, 'me'), null);
  const anil = { profileId: 'a', name: 'Anil', requestedAt: '2026-11-15T00:00:00Z' };
  const priya = { profileId: 'p', name: 'Priya', requestedAt: '2026-11-15T01:00:00Z' };
  const me = { profileId: 'me', name: 'Me Myself', requestedAt: '2026-11-15T02:00:00Z' };
  assert.equal(askedLine([anil], 'me'), 'Anil asked to restore it');
  assert.equal(askedLine([anil, priya], 'me'), 'Anil and Priya asked to restore it');
  assert.equal(askedLine([anil, priya, me], 'me'), 'Anil, Priya and You asked to restore it');
  assert.equal(askedLine([me], 'me'), 'You asked to restore it');
});

test('X20-6 the 045 deletion block and deleted_games rows map; junk is dropped', () => {
  const d = deletionFromRow(row({ requests: [{ profile_id: 'a', name: 'Anil', requested_at: '2026-11-15T00:00:00Z' }, { bogus: true }], my_request_at: '2026-11-15T00:00:00Z', can_restore: true }))!;
  assert.equal(d.deletedAt, DELETED);
  assert.equal(d.deletedByName, 'Harish');
  assert.equal(d.purgeAt, '2026-12-14T12:00:00Z');
  assert.equal(d.canRestore, true);
  assert.equal(d.myRequestAt, '2026-11-15T00:00:00Z');
  assert.deepEqual(d.requests, [{ profileId: 'a', name: 'Anil', requestedAt: '2026-11-15T00:00:00Z' }]);
  assert.equal(deletionFromRow(null), undefined);
  assert.equal(deletionFromRow({ deleted_at: null }), undefined, 'a live game has no deletion block');
  // a 023-shaped row without purge_at falls back to the 30-day math
  assert.equal(deletionFromRow(row({ purge_at: undefined }))!.purgeAt, '2026-12-14T12:00:00.000Z');

  const cards = deletedHomeGamesFrom([row(), { id: 'x' }, null, row({ id: '2', game_label: null, game_number: 3, game_type: 'pool' })]);
  assert.equal(cards.length, 2, 'rows without a deletion stamp are dropped');
  assert.equal(cards[0].gameLabel, 'S14');
  assert.equal(cards[0].playerCount, 4);
  assert.equal(cards[1].gameType, 'pool');
  assert.equal(cards[1].gameNumber, 3);
  assert.deepEqual(deletedHomeGamesFrom(undefined), []);
  assert.deepEqual(deletedHomeGamesFrom('nope'), []);
});

test('G02: the Delete game confirm is honest about 30 days and who still sees it', () => {
  assert.match(DELETE_GAME_BODY, /^Nothing is lost for 30 days\./);
  assert.match(DELETE_GAME_BODY, /Deleted games/);
  assert.match(DELETE_GAME_BODY, /ask an admin/);
  assert.match(DELETE_GAME_BODY, /After 30 days it is hidden for good — nothing is erased, and support can still find it\.$/);
});

test('Q20.7: the support card and Help name support@ezscore.app, the Unique game ID and the 30 days', () => {
  assert.equal(SUPPORT_EMAIL, 'support@ezscore.app');
  assert.match(SUPPORT_CARD_BODY, /support@ezscore\.app/);
  assert.match(SUPPORT_CARD_BODY, /Unique game ID/);
  assert.match(SUPPORT_CARD_BODY, /30 days/);
  assert.match(SUPPORT_CARD_BODY, /Nothing is ever erased/);
  const help = HELP.hiddenDeleted;
  assert.ok(help.includes('support@ezscore.app'), 'Help › Hidden & deleted carries the support address');
  assert.ok(help.includes('Deleted games'), 'Help tells players where to find a deleted game');
  const screen = src('app/(screens)/hidden-deleted.tsx');
  assert.ok(screen.includes('SUPPORT_CARD_TITLE') && screen.includes('SUPPORT_CARD_BODY'), 'the Settings screen shows the card');
  assert.ok(screen.includes('hiddenForGoodLabel'), 'the deleted-game rows say when the game is hidden for good');
});

test('Log: the two new kinds have labels and tones', () => {
  assert.equal(kindLabel('restore_requested'), 'Asked to restore');
  assert.equal(kindLabel('game_purged'), 'Erased');
  assert.equal(dotTone({ kind: 'restore_requested', level: 'important' }), 'amber');
  assert.equal(dotTone({ kind: 'game_purged', level: 'important' }), 'red');
});

test('the scorecard draws a deleted game read-only with the banner, and Home has the Deleted games card', () => {
  const page = src('app/(screens)/games/[id].tsx');
  assert.ok(page.includes('<DeletedGameBanner'), 'the banner is on the scorecard');
  assert.ok(page.includes('const canScoreNow = canScore && !deleted;'), 'no scoring on a deleted game');
  assert.ok(page.includes('const canManageNow = canManage && !deleted;'), 'no Delete / Players · Admins on a deleted game');
  assert.match(page, /\{chrome\.bottomBar && !game\.isComplete && canScoreNow \? \(\s*<BottomBar/, 'the bottom bar is gone');
  assert.ok(page.includes('{deleted ? null : <IconButton icon="share-variant"'), 'no share icon on a deleted game');
  const banner = src('components/game/DeletedGameBanner.tsx');
  for (const id of ['deleted-game-banner', 'deleted-game-ask', 'deleted-game-restore', 'deleted-game-asked-line']) assert.ok(banner.includes(`testID="${id}"`), id);
  const home = src('app/(tabs)/index.tsx');
  assert.ok(home.includes('<DeletedGamesCard'), 'Home renders the card');
  assert.ok(home.includes('archiveService.requestRestore(game.id)'), 'Ask from Home');
  const card = src('components/home/DeletedGamesCard.tsx');
  assert.ok(card.includes('if (games.length === 0) return null;'), 'the card is absent when nothing was deleted');
});

test('migration 045 is written, not applied: purge, asks, readers, rollback and the replay hook', () => {
  const mig = src('supabase/migrations/045_going_rogue.sql');
  for (const needle of [
    'create table if not exists public.restore_requests',
    'create or replace function public.request_restore(p_game_id uuid)',
    'create or replace function public.purge_deleted_games()',
    'create or replace function public.can_read_deleted_game(p_game_id uuid)',
    "'restore_requested', 'game_purged'",
    'purged_game_id uuid',
    "interval '30 days'",
    'revoke all on function public.purge_deleted_games() from public, anon, authenticated;',
    "'deleted_games', v_deleted",
    "'deletion', public.game_deletion_json(p_game_id)",
    "check (kind in ('game_started', 'result_saved', 'link_request', 'restore_requested'))",
  ]) assert.ok(mig.includes(needle), needle);
  assert.ok(mig.includes("pg_extension where extname = 'pg_cron'"), 'the nightly job is guarded on pg_cron');
  const rollback = src('supabase/rollback/rollback_045_going_rogue.sql');
  assert.ok(rollback.includes('drop function if exists public.purge_deleted_games();'));
  assert.ok(rollback.includes('drop table if exists public.restore_requests;'));
  const replay = readFileSync(path.join(root, '..', 'ci', 'db', 'replay-rollbacks.sh'), 'utf8');
  assert.ok(replay.includes('rollback_045_going_rogue.sql') && replay.includes('045_going_rogue'), 'the replay hook knows 045');
  const email = src('supabase/functions/send-email/index.ts');
  assert.ok(email.includes("row.kind === 'restore_requested'"), 'the mailer renders the ask');
});
