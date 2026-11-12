import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { conflictGameList, linkCompleteMessage, linkConflictMessage, linkPreviewMessage, localLinkedGame, localLinkPreview } from '../utils/linkPlayer';
import { Game } from '../types/game';
import { Player } from '../types/player';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

const rk: Player = { id: 'rk', name: 'R K', status: 'unregistered', managedBy: 'me', playerNo: 9, role: 'player' } as Player;
const priya: Player = { id: 'priya', name: 'Priya', status: 'registered', playerNo: 3, email: 'Priya@Test.local', role: 'player' } as Player;
const cora: Player = { id: 'cora', name: 'Cora', status: 'registered', playerNo: 6, email: 'cora@test.local', role: 'player' } as Player;
const games = [
  { id: 'A', gameNumber: 4, players: ['harish', 'priya', 'rk'], scores: { harish: [-10], priya: [-20], rk: [30] }, adminIds: ['me'], unseatedAdminIds: ['me', 'cora'], spectators: ['vee'] },
  { id: 'C', gameNumber: 7, players: ['harish', 'rk'], scores: { harish: [5], rk: [-5] }, adminIds: ['me'] },
  { id: 'Z', gameNumber: 9, players: ['harish', 'priya'], scores: {} },
] as unknown as Game[];

test('item 5: the (Player ID, email) pair must match; the email is compared case- and space-insensitively and never echoed', () => {
  assert.throws(() => localLinkPreview(rk, null, 'x@test.local', games), /No registered player has that Player ID/);
  assert.throws(() => localLinkPreview(rk, priya, '', games), /Type the email/);
  assert.throws(() => localLinkPreview(rk, priya, 'wrong@test.local', games), /does not match Player ID #3/);
  assert.throws(() => localLinkPreview(rk, { ...rk, id: 'other' } as Player, 'x', games), /No registered player/, 'an unregistered record is never a target');
  assert.throws(() => localLinkPreview({ ...priya, managedBy: 'me' } as Player, cora, 'cora@test.local', games), /Only an unregistered player/);
  const ok = localLinkPreview(rk, priya, '  priya@TEST.local ', games);
  assert.deepEqual(ok.target, { id: 'priya', name: 'Priya', playerNo: 3 });
});

test('item 5: conflicts are checked across every game the player is in, not just the open one', () => {
  const clash = localLinkPreview(rk, priya, 'priya@test.local', games);
  assert.equal(clash.gameCount, 2, 'rk sits in A and C');
  assert.deepEqual(clash.conflicts, [{ gameId: 'A', gameNumber: 4 }], 'priya already plays in A; Z has no rk so it is not a conflict');
  assert.equal(conflictGameList(clash.conflicts), 'G4');
  assert.match(linkConflictMessage(clash) ?? '', /Priya already plays in G4 with this player\. Remove one of the two from that game first/);
  const fine = localLinkPreview(rk, cora, 'cora@test.local', games);
  assert.deepEqual(fine.conflicts, [], 'a non-playing admin of A is not a conflict');
  assert.equal(linkConflictMessage(fine), null);
  assert.match(linkPreviewMessage('R K', fine), /R K's seat and scores in 2 games become Cora's \(#6\)/);
});

test('item 5: the local move hands every seat, score column and role to the account; an unseated admin keeps admin', () => {
  const a = localLinkedGame(games[0], 'rk', 'cora');
  assert.deepEqual(a.players, ['harish', 'priya', 'cora']);
  assert.deepEqual(a.scores.cora, [30]);
  assert.equal('rk' in a.scores, false);
  assert.ok(a.adminIds?.includes('cora'), 'cora was a non-playing admin: stays admin');
  assert.deepEqual(a.unseatedAdminIds, ['me']);
  const c = localLinkedGame(games[1], 'rk', 'cora');
  assert.deepEqual(c.players, ['harish', 'cora']);
  assert.deepEqual(c.adminIds, ['me']);
});

test('item 5: the link-complete pop-up names both and the games that moved', () => {
  const text = linkCompleteMessage({ linkId: 'l1', playerName: 'R K', target: { id: 'cora', name: 'Cora', playerNo: 6 }, movedGameIds: ['A', 'C'], movedGameNumbers: [4, 7] });
  assert.equal(text, 'R K is now Cora (#6). Scores in G4, G7 moved over.');
  assert.equal(linkCompleteMessage({ linkId: null, playerName: 'R K', target: { id: 'cora', name: 'Cora', playerNo: null }, movedGameIds: [], movedGameNumbers: [] }), 'R K is now Cora.');
});

test('item 5: one ⋮ menu everywhere; Register popup and Unregistered chip are gone; the bottom count filters', () => {
  assert.equal(existsSync(path.join(process.cwd(), 'components/players/RegisterPlayersDialog.tsx')), false, 'the Register popup component is deleted');
  const tab = src('app/(tabs)/players.tsx');
  assert.doesNotMatch(tab, /RegisterPlayersDialog|setRegisterOpen/);
  assert.doesNotMatch(tab, /icon=\{filter === 'unregistered' \? 'filter-check' : 'filter-outline'\}/, 'the filter chip beside Sort is gone');
  assert.match(tab, /label=\{filter === 'unregistered' \? 'Showing unregistered' : `Unregistered · \$\{openCount\}`\}/, 'the bottom tile shows the count');
  assert.match(tab, /onPress=\{\(\) => setFilter\(\(cur\) => \(cur === 'all' \? 'unregistered' : 'all'\)\)\}/, 'and toggles the filter');
  assert.doesNotMatch(tab, /numColumns/, 'one row per player');
  for (const component of ['PlayerActionMenu', 'LinkPlayerDialog', 'LinkCompleteDialog', 'InviteToRegisterDialog', 'EditNameDialog']) {
    assert.match(tab, new RegExp(`<${component}`), `My players uses ${component}`);
    assert.match(src('app/(screens)/games/players.tsx'), new RegExp(`<${component}`), `the game's Players page uses ${component}`);
  }
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.doesNotMatch(scorecard, /Register players|RegisterPlayersDialog/, 'the scorecard ⋮ no longer opens the Register popup');
  const link = src('components/players/LinkPlayerDialog.tsx');
  assert.match(link, /testID="link-player-id"/);
  assert.match(link, /testID="link-player-email"/);
  assert.match(link, /playerIdentityService\.linkPreview\(/, 'Check previews before anything moves');
  assert.match(link, /playerIdentityService\.linkPlayerToAccount\(/);
  assert.match(link, /\{preview && !clash \? \(/, 'Link is offered only when the pair matched and nothing clashes');
  assert.match(src('services/playerIdentity.ts'), /rpc as any\)\('link_player_to_account'/);
  assert.doesNotMatch(src('services/playerIdentity.ts'), /linkSeatToPlayer/, 'the one-game link is replaced by the all-games link');
});

test('migration 025: pair lookup never reveals the email, conflicts span every game, the move is recorded as an undoable link', () => {
  const sql = src('supabase/migrations/025_link_player_to_account.sql');
  assert.match(sql, /That email does not match Player ID #%\./, 'the message names the number, not the email');
  assert.match(sql, /create or replace function public\.link_conflicts\(p_player_id uuid, p_target uuid\)/);
  assert.match(sql, /already plays in %\. Remove one of the two from those games first/);
  assert.match(sql, /insert into public\.player_links \(owner_id, player_id, email, kind, status, claimed_by, claimed_at, game_numbers, moved_game_ids, expires_at\)/, 'a claimed link row, so unlink_player can undo');
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('game:' \|\| gid::text, 0\)\)/, 'the same per-game lock as save_round (019)');
  assert.match(sql, /revoke all on function public\.link_target_for\(bigint, text\) from public, anon, authenticated;/);
  assert.match(src('supabase/rollback/rollback_025_link_player_to_account.sql'), /drop function if exists public\.link_player_to_account\(uuid, bigint, text\);/);
});
