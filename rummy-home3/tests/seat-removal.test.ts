import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canRemoveSeat, SEAT_HAS_SCORES_MESSAGE, SEAT_REMOVAL_NOT_READY, seatRemovalProblem } from '../utils/seatRemoval';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('a player with no scores can be removed', () => {
  assert.equal(canRemoveSeat(undefined), true);
  assert.equal(canRemoveSeat(null), true);
  assert.equal(canRemoveSeat([]), true);
  assert.equal(seatRemovalProblem([]), null);
});

test('a player whose every round score is exactly 0 can be removed', () => {
  assert.equal(canRemoveSeat([0]), true);
  assert.equal(canRemoveSeat([0, 0, 0, 0, 0, 0]), true);
  assert.equal(seatRemovalProblem([0, 0]), null, 'a mid-game joiner backfilled with zeros');
});

test('one non-zero round anywhere blocks removal with the exact message', () => {
  assert.equal(canRemoveSeat([0, 0, -10]), false);
  assert.equal(canRemoveSeat([40]), false);
  assert.equal(canRemoveSeat([0, 0, 0, 0, 0, -80, 0]), false);
  assert.equal(
    seatRemovalProblem([0, -40]),
    'You cannot delete this player. You cannot delete a player that has a score. You will have to edit the round and delete all his scores before you remove a player.',
  );
  assert.equal(seatRemovalProblem([40]), SEAT_HAS_SCORES_MESSAGE);
});

test('the rule checks each round, never the total', () => {
  // +40 and -40 total 0 but both are real scores.
  assert.equal(canRemoveSeat([40, -40]), false);
  assert.equal(canRemoveSeat([10, -10, 0]), false);
});

test('016 enforces the same all-zero rule server-side and is admin-only, authenticated-only, security definer', () => {
  const sql = read('supabase/migrations/016_remove_seat_if_no_scores.sql');
  assert.match(sql, /create or replace function public\.remove_seat_if_no_scores\(p_game_id uuid, p_profile_id uuid\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /auth\.uid\(\) is null then raise exception/);
  assert.match(sql, /public\.is_game_admin\(p_game_id\)/);
  assert.match(sql, /s\.value <> 0/, 'counts non-zero rounds, not the total');
  assert.match(sql, /r\.undone_at is null/, 'retired rounds do not count');
  assert.match(sql, /You cannot delete this player\. You cannot delete a player that has a score\./, 'same message as the app');
  assert.match(sql, /delete from public\.scores s where s\.game_id = p_game_id and s\.profile_id = p_profile_id/);
  assert.match(sql, /delete from public\.game_players gp where gp\.game_id = p_game_id and gp\.profile_id = p_profile_id/);
  assert.match(sql, /revoke all on function public\.remove_seat_if_no_scores\(uuid, uuid\) from anon/);
  assert.match(sql, /grant execute on function public\.remove_seat_if_no_scores\(uuid, uuid\) to authenticated/);
  assert.doesNotMatch(sql, /grant .* to anon/);
  const rollback = read('supabase/rollback/rollback_016_remove_seat_if_no_scores.sql');
  assert.match(rollback, /drop function if exists public\.remove_seat_if_no_scores\(uuid, uuid\)/);
});

test('the app degrades when 016 is missing: plain delete for a seat without rounds, a not-available message otherwise', () => {
  const service = read('services/games.ts');
  assert.match(service, /async removeSeatIfNoScores\(/);
  assert.match(service, /seatRemovalProblem\(game\.scores\[profileId\]\)/, 'client checks the rule before any request');
  assert.match(service, /supabase\.rpc\('remove_seat_if_no_scores'/);
  assert.match(service, /if \(!missingRpc\(rpc\.error\)\) throw rpc\.error/);
  assert.match(service, /throw new Error\(SEAT_REMOVAL_NOT_READY\)/);
  assert.match(service, /from\('game_players'\)\.delete\(\)/);
  assert.doesNotMatch(SEAT_REMOVAL_NOT_READY, /sql|migration|016|supabase/i);
});

test('the picker is one player per row with avatar, name, status and Player ID, and the strip is compact faces', () => {
  const row = read('components/players/PlayerPickerRow.tsx');
  assert.match(row, /SeatAvatar name=\{candidate\.name\} color=\{seatColor\(index\)\}/);
  assert.match(row, /BoldName name=\{candidate\.name\}/);
  assert.match(row, /registrationLabel\(candidate\.status\)/);
  assert.match(row, /playerIdBadge\(candidate\)/);
  const screen = read('app/(screens)/games/new.tsx');
  assert.match(screen, /<PlayerPickerRow key=\{c\.id\}/);
  assert.doesNotMatch(screen, /width: '49%'/, 'no two-column grid');
  assert.match(screen, /LayoutAnimation\.configureNext/, 'list closes the gap and the strip opens smoothly');
  const strip = read('components/players/SelectedPlayersStrip.tsx');
  assert.match(strip, /SeatAvatar name=\{pick\.name\} color=\{color\} size=\{28\}/, 'small faces');
  assert.match(strip, /accessibilityLabel=\{`Send \$\{pick\.name\} back to the list`\}/, 'tapping the face returns the player');
  assert.match(strip, /accessibilityLabel=\{`Remove \$\{pick\.name\}`\}/, 'the × is kept');
});

test('mid-game add reuses the picker in add mode with Return to game; the old popup is gone', () => {
  const screen = read('app/(screens)/games/new.tsx');
  assert.match(screen, /useLocalSearchParams<\{ gameId\?: string \}>/);
  assert.match(screen, /'Add players to game' : 'New game'/);
  assert.match(screen, /accessibilityLabel="Return to game"/);
  assert.match(screen, /gamesService\.addSeatedPlayer\(game\.id, pickRow\.id, labels\.get\(pickRow\.id\)\)/, 'reuses the mid-game add path (zeros for rounds played), with the seat label (022)');
  assert.match(screen, /gamesService\.removeSeatIfNoScores\(game\.id, id\)/);
  assert.match(screen, /router\.dismissTo\(`\/\(screens\)\/games\/\$\{game\.id\}`\)/, 'Return to game lands on the scorecard, not on Players/Admins');
  assert.match(screen, /seatRemovalProblem\(game\.scores\[id\]\)/, 'blocked before any request');
  const players = read('app/(screens)/games/players.tsx');
  assert.match(players, /pathname: '\/\(screens\)\/games\/new', params: \{ gameId: game\.id \}/);
  assert.doesNotMatch(players, /kind: 'add'/);
  assert.doesNotMatch(players, /Nobody can be removed from a game/);
});
