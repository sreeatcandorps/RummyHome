import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Player } from '../types/player';
import { Game } from '../types/game';
import { RoundScoreInput, validateRoundScores } from '../utils/scoring';
import { distributeRummyWinnings } from '../utils/rummyDistribution';
import {
  DEMO_EXPENSE_ID,
  mergeDemoData,
  normalizePlayerName,
  SRIKANTH_NAME,
  stripDemoData,
} from '../utils/demoData';

const srikanth = (overrides: Partial<Player> = {}): Player => ({
  id: 'player_phone',
  name: SRIKANTH_NAME,
  email: 'sri@example.com',
  role: 'player',
  gamesPlayed: 0,
  gamesWon: 0,
  ...overrides,
});

function roundInputs(game: Game, roundIndex: number): RoundScoreInput[] {
  return Object.entries(game.scores).map(([playerId, values]) => {
    const value = values[roundIndex] ?? 0;
    const scoreType = playerId === DEMO_EXPENSE_ID
      ? 'expense' as const
      : value > 0
        ? 'rummy' as const
        : value === game.settings.dropAmount
          ? 'drop' as const
          : value === game.settings.mdAmount
            ? 'middle_drop' as const
            : 'count' as const;
    return {
      playerId: playerId === DEMO_EXPENSE_ID ? null : playerId,
      value,
      scoreType,
    };
  });
}

function hostTotals(game: Game, hostId: string) {
  return game.scores[hostId] ?? [];
}

test('demo expense column matches the game service', () => {
  const source = readFileSync(new URL('../services/games.ts', import.meta.url), 'utf8');
  assert.match(source, /EXPENSE_PLAYER_ID = 'EX'/);
});

test('reuses Srikanth Koneru by name and never duplicates that player', () => {
  const existing = srikanth({ name: '  SRIKANTH   koneru ' });
  const first = mergeDemoData([existing], [], existing.id, new Date('2026-10-08T00:00:00Z'));
  assert.equal(first.host.id, existing.id);
  assert.equal(first.host.email, 'sri@example.com');
  assert.equal(
    first.players.filter((player) => normalizePlayerName(player.name) === normalizePlayerName(SRIKANTH_NAME)).length,
    1,
  );

  const second = mergeDemoData(first.players, first.games, existing.id, new Date('2026-10-08T00:00:00Z'));
  assert.equal(
    second.players.filter((player) => normalizePlayerName(player.name) === normalizePlayerName(SRIKANTH_NAME)).length,
    1,
  );
  assert.equal(second.players.length, first.players.length);
  assert.equal(second.games.filter((game) => game.id.startsWith('demo-')).length, 5);
});

test('creates Srikanth only when no player with that name exists', () => {
  const result = mergeDemoData([], [], null, new Date('2026-10-08T00:00:00Z'));
  const matches = result.players.filter(
    (player) => normalizePlayerName(player.name) === normalizePlayerName(SRIKANTH_NAME),
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'demo-player-srikanth');
  assert.equal(matches[0].name, SRIKANTH_NAME);
});

test('seeds realistic games that include Srikanth and validate under the scoring rules', () => {
  const existing = srikanth();
  const kept: Game = {
    id: 'real-game',
    date: '2026-01-01T00:00:00.000Z',
    isComplete: true,
    players: [existing.id],
    scores: { [existing.id]: [0] },
    currentRound: 2,
    gameType: 'stake',
    settings: {
      expense: false,
      expenseAmount: -10,
      dropAmount: -10,
      mdAmount: -30,
      maxCount: -80,
    },
  };
  const { players, games, host } = mergeDemoData([existing], [kept], existing.id, new Date('2026-10-08T00:00:00Z'));
  const demoGames = games.filter((game) => game.id.startsWith('demo-'));
  const finished = demoGames.filter((game) => game.isComplete);
  const live = demoGames.filter((game) => !game.isComplete);

  assert.ok(players.length >= 12);
  assert.equal(finished.length, 4);
  assert.deepEqual(
    finished.map((game) => game.players.length).sort((a, b) => a - b),
    [4, 6, 8, 12],
  );
  finished.forEach((game) => {
    const rounds = game.scores[host.id].length;
    assert.ok(rounds >= 5 && rounds <= 20, `${game.id} has ${rounds} rounds`);
  });

  assert.equal(live.length, 1);
  assert.ok(live[0].players.length >= 10);
  assert.ok(live[0].scores[host.id].length >= 8 && live[0].scores[host.id].length <= 12);
  assert.equal(live[0].currentRound, live[0].scores[host.id].length + 1);

  demoGames.forEach((game) => {
    assert.ok(game.players.includes(host.id), game.id);
    assert.equal(game.scores[DEMO_EXPENSE_ID].length, game.currentRound - 1);
    for (let roundIndex = 0; roundIndex < game.currentRound - 1; roundIndex += 1) {
      const inputs = roundInputs(game, roundIndex);
      const result = validateRoundScores(inputs);
      assert.equal(result.valid, true, `${game.id} round ${roundIndex + 1}: ${result.error}`);
      const winners = inputs.filter((input) => input.scoreType === 'rummy').map((input) => input.playerId ?? '');
      const entriesTotal = inputs
        .filter((input) => input.scoreType !== 'rummy')
        .reduce((sum, input) => sum + input.value, 0);
      const expected = distributeRummyWinnings(entriesTotal, winners);
      winners.forEach((winnerId) => {
        const winner = inputs.find((input) => input.playerId === winnerId && input.scoreType === 'rummy');
        assert.equal(winner?.value, expected[winnerId]);
      });
    }
  });

  const hostScores = demoGames.flatMap((game) => hostTotals(game, host.id));
  assert.ok(hostScores.some((value) => value > 0));
  assert.ok(hostScores.some((value) => value < 0));

  const finishedLead = finished.map((game) => {
    const totals = game.players.map((playerId) =>
      (game.scores[playerId] ?? []).reduce((sum, value) => sum + value, 0),
    );
    const hostTotal = (game.scores[host.id] ?? []).reduce((sum, value) => sum + value, 0);
    return hostTotal === Math.max(...totals);
  });
  assert.ok(finishedLead.some(Boolean));
  assert.ok(finishedLead.some((lead) => !lead));

  assert.ok(games.some((game) => game.id === 'real-game'));
  assert.ok((host.gamesWon ?? 0) >= 1);
  assert.ok((host.gamesWon ?? 0) < (host.gamesPlayed ?? 0));
});

test('clear removes demo records and keeps the signed-in player', () => {
  const existing = srikanth();
  const seeded = mergeDemoData([existing], [], existing.id, new Date('2026-10-08T00:00:00Z'));
  const cleared = stripDemoData(seeded.players, seeded.games, [existing.id]);

  assert.equal(cleared.games.length, 0);
  assert.equal(cleared.players.length, 1);
  assert.equal(cleared.players[0].id, existing.id);
  assert.equal(cleared.players[0].email, 'sri@example.com');
  assert.equal(cleared.players[0].gamesPlayed, 0);
});
