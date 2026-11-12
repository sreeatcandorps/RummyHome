import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LIVE_GAME_REMOVE_MESSAGE,
  REMOVE_CONFIRM_BODY,
  REMOVE_CONFIRM_TITLE,
  REMOVED_TOAST,
  removeMyPlayerError,
  restoredRow,
  SELF_REMOVE_MESSAGE,
  UNDO_REMOVE_MS,
} from '../utils/removeMyPlayer';
import { myPlayerMenu, SEAT_MENU_LABEL } from '../utils/gamePlayers';
import { HELP } from '../constants/help';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('027: the server refusals map to the agreed sentences', () => {
  assert.equal(removeMyPlayerError({ message: 'In a live game. Remove them after the game ends.' }).message, LIVE_GAME_REMOVE_MESSAGE);
  assert.equal(LIVE_GAME_REMOVE_MESSAGE, 'In a live game. Remove them after the game ends.');
  assert.equal(removeMyPlayerError({ message: 'P0001: You are always in your own list.' }).message, SELF_REMOVE_MESSAGE);
  assert.equal(removeMyPlayerError(new Error('network down')).message, 'network down');
  assert.equal(removeMyPlayerError({}).message, 'Couldn’t remove them. Try again.');
});

test('027: a restored row keeps its initials when free, drops them when an active row took them', () => {
  const rows = [
    { ownerId: 'sree', playerId: 'cd', initials: 'CD', removedAt: '2026-11-12T00:00:00Z' },
    { ownerId: 'sree', playerId: 'chitra', initials: 'CD' },
    { ownerId: 'sree', playerId: 'harish', initials: 'HT' },
    { ownerId: 'harish', playerId: 'ab', initials: 'AB', removedAt: '2026-11-12T00:00:00Z' },
    { ownerId: 'harish', playerId: 'priya', initials: 'PT' },
  ];
  const cd = restoredRow(rows[0], rows);
  assert.equal(cd.removedAt, undefined, 'removedAt cleared');
  assert.equal(cd.initials, undefined, 'CD is held by Chitra, so the default rule relabels cd');
  const ab = restoredRow(rows[3], rows);
  assert.equal(ab.removedAt, undefined);
  assert.equal(ab.initials, 'AB', 'AB is still free in harish’s list, so it comes back');
  const other = restoredRow({ ownerId: 'sree', playerId: 'x', initials: 'AB', removedAt: 'z' }, rows);
  assert.equal(other.initials, 'AB', 'another owner holding AB does not count');
  const removedHolder = restoredRow({ ownerId: 'sree', playerId: 'y', initials: 'CD', removedAt: 'z' }, [
    { ownerId: 'sree', playerId: 'cd', initials: 'CD', removedAt: 'z' },
  ]);
  assert.equal(removedHolder.initials, 'CD', 'a removed row holding the initials does not block');
});

test('027: the local roster soft-removes, hides removed rows and restores them (services/players.ts)', () => {
  const players = src('services/players.ts');
  assert.match(players, /removedAt\?: string;/, 'RosterRow carries removedAt');
  assert.match(players, /async removeMyPlayer\([\s\S]*?\{ \.\.\.row, removedAt \}/, 'remove flags the row instead of deleting it');
  assert.doesNotMatch(players, /async removeMyPlayer\([\s\S]*?rows\.filter\(\(row\) => !\(row\.ownerId === ownerId && row\.playerId === playerId\)\)/, 'no hard delete on remove');
  assert.match(players, /async restoreMyPlayer\(ownerId: string, playerId: string\)/, 'Undo calls restoreMyPlayer');
  assert.match(players, /'restore_my_player', \{ p_player_id: playerId \}/, 'which calls the 027 RPC');
  assert.match(players, /throw removeMyPlayerError\(error\)/, 'server refusals are translated');
  assert.match(players, /\.filter\(\(row\) => row\.ownerId === ownerId && isActive\(row\)\)\s*\.sort/, 'readMyPlayers hides removed rows');
  assert.match(players, /const mine = rows\.filter\(\(row\) => row\.ownerId === ownerId && isActive\(row\)\);\s*if \(mine\.every\(\(row\) => row\.initials\)\)/, 'local initials consider active rows only');
  assert.match(players, /const next: RosterRow = restoredRow\(\{/, 'add (by ID or name) restores a removed row with its history');
  assert.match(players, /next\[index\] = restoredRow\(\{/, 'playing together restores too');
});

test('027: My players confirms, then shows an Undo toast (app/(tabs)/players.tsx)', () => {
  const screen = src('app/(tabs)/players.tsx');
  assert.match(screen, /Alert\.alert\(REMOVE_CONFIRM_TITLE\(who\.name\), REMOVE_CONFIRM_BODY/, 'confirm first');
  assert.match(screen, /<Snackbar[\s\S]*?duration=\{UNDO_REMOVE_MS\}[\s\S]*?action=\{\{ label: 'Undo', onPress: undoRemove \}\}/, 'Undo on the toast');
  assert.match(screen, /await playersService\.restoreMyPlayer\(me\.id, back\.id\)/, 'Undo restores on the server');
  assert.match(screen, /setUndo\(removed\)/, 'the toast appears only after the server accepted the remove');
  assert.equal(REMOVE_CONFIRM_TITLE('R K'), 'Remove R K from My players?');
  assert.match(REMOVE_CONFIRM_BODY, /past games, scores and results stay/);
  assert.equal(REMOVED_TOAST('R K'), 'R K removed from My players.');
  assert.ok(UNDO_REMOVE_MS >= 4000, 'enough time to tap Undo');
});

test('027: the menu item is distinct from the in-game Remove, and Help explains it', () => {
  assert.equal(SEAT_MENU_LABEL.remove_from_list, 'Remove from My players');
  assert.equal(SEAT_MENU_LABEL.remove_player, 'Remove from game');
  const items = myPlayerMenu({ id: 'rk', name: 'R K', status: 'unregistered' } as any, 'me');
  assert.ok(items.some((entry) => entry.item === 'remove_from_list' && entry.enabled), 'Remove from My players is on the My players menu');
  assert.ok(!items.some((entry) => entry.item === 'remove_player'), 'the in-game Remove is not');
  assert.match(HELP.players, /Remove from My players changes only your list/);
});

test('027: the migration is a soft remove with the live-game block, and the rollback exists', () => {
  const sql = src('supabase/migrations/027_remove_from_my_players.sql');
  assert.match(sql, /add column if not exists removed_at timestamptz/);
  assert.match(sql, /set removed_at = now\(\)/, 'remove_my_player flags');
  assert.doesNotMatch(sql, /delete from public\.my_players/, 'never deletes');
  assert.match(sql, /raise exception 'In a live game\. Remove them after the game ends\.'/);
  assert.match(sql, /on public\.my_players \(owner_id, initials\) where removed_at is null/, 'initials are unique among active rows only');
  assert.match(sql, /create or replace function public\.restore_my_player/);
  assert.match(sql, /g\.id in \(select public\.list_visible_game_ids\(\)\)/, 'only games I can see block');
  src('supabase/rollback/rollback_027_remove_from_my_players.sql');
});
