import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gameCache } from '../utils/gameCache';
import type { Game } from '../types/game';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const game = (id: string, rounds: number): Game => ({
  id, players: ['a', 'b'], scores: { a: Array(rounds).fill(-10), b: Array(rounds).fill(10) },
  isComplete: false, createdAt: '2026-11-10T00:00:00Z', gameType: 'points',
} as unknown as Game);

test('game cache: last-known copy per game, refreshed by every read, gone on sign out', () => {
  gameCache.clear();
  assert.equal(gameCache.peekGame('g1'), null);
  assert.equal(gameCache.peekSeats('g1'), null);
  gameCache.putGame(game('g1', 3));
  assert.equal(gameCache.peekGame('g1')?.scores.a.length, 3);
  gameCache.putGame(game('g1', 4));
  assert.equal(gameCache.peekGame('g1')?.scores.a.length, 4, 'a newer read replaces the entry');
  gameCache.putSeats('g1', [{ id: 'a', name: 'A', role: 'player' }]);
  assert.equal(gameCache.peekSeats('g1')?.length, 1);
  assert.equal(gameCache.putGame(null), null, 'a missing game is not cached');
  gameCache.forget('g1');
  assert.equal(gameCache.peekGame('g1'), null);
  gameCache.putGame(game('g2', 1));
  gameCache.clear();
  assert.equal(gameCache.size(), 0);
  assert.equal(gameCache.peekGame(undefined), null);
});

test('opening a game no longer fetches it twice: access is worked out from the copy already loaded', () => {
  const service = read('services/games.ts');
  assert.match(service, /async accessFor\(gameId: string, userId: string \| null, preloaded\?: \{ game: Game \| null; seats\?: Player\[\] \}\)/);
  assert.match(service, /const game = preloaded \? preloaded\.game : await this\.getGame\(gameId\);/);
  assert.match(service, /return gameCache\.putGame\(legacyGameFromServer/);
  assert.match(service, /async prefetchGame\(gameId: string\)/);
  for (const file of ['app/(screens)/games/[id].tsx', 'hooks/useGameRoster.ts', 'app/(screens)/score-entry.tsx']) {
    const src = read(file);
    assert.match(src, /accessFor\((id|String\(gameId\)), userId, \{ game: (currentGame|fetchedGame), seats: gamePlayers \}\)/, `${file} reuses the loaded game`);
    assert.doesNotMatch(src, /accessFor\((id|String\(gameId\)), userId\)\s*[,)]/, `${file} has no bare accessFor`);
  }
  const scorecard = read('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /gamesService\.peekGame\(/, 'the scorecard seeds from the cache');
  assert.doesNotMatch(scorecard, /useEffect\(\(\) => \{\s*loadGameData\(\);\s*\}, \[id\]\);/, 'mount load comes from useFocusEffect only');
  const hook = read('hooks/useGameRoster.ts');
  assert.doesNotMatch(hook, /useEffect\(\(\) => \{\s*reload\(\);\s*\}, \[reload\]\);/);
  assert.match(read('app/(tabs)/index.tsx'), /prefetchGame\(game\.id\)/, 'Home warms the first live games');
  assert.match(read('services/auth.ts'), /gameCache\.clear\(\)/);
});
