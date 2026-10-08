import { Game, GameSettings } from '@/types/game';
import { Player } from '@/types/player';
import { ScoreType } from '@/types/database';
import { distributeRummyWinnings } from '@/utils/rummyDistribution';
import {
  calculateFinalTotals,
  legacySettingsForGameType,
  RoundScoreInput,
  validateRoundScores,
} from '@/utils/scoring';

/** Reserved expense column. Matches `EXPENSE_PLAYER_ID` in services/games.ts. */
export const DEMO_EXPENSE_ID = 'EX';

export const DEMO_ID_PREFIX = 'demo-';

export const SRIKANTH_NAME = 'Srikanth Koneru';

const DEMO_CAST: { id: string; name: string }[] = [
  { id: 'demo-player-ananya', name: 'Ananya Krishnamurthy' },
  { id: 'demo-player-priya', name: 'Priya Nair' },
  { id: 'demo-player-arjun', name: 'Arjun Mehta' },
  { id: 'demo-player-meera', name: 'Meera Iyer' },
  { id: 'demo-player-vikram', name: 'Vikram Shah' },
  { id: 'demo-player-james', name: 'James Walker' },
  { id: 'demo-player-emily', name: 'Emily Carter' },
  { id: 'demo-player-christopher', name: 'Christopher Gallagher' },
  { id: 'demo-player-madison', name: 'Madison Brooks' },
  { id: 'demo-player-rohan', name: 'Rohan Deshmukh' },
  { id: 'demo-player-lakshmi', name: 'Lakshmi Venkateswaran' },
  { id: 'demo-player-daniel', name: 'Daniel Brooks' },
  { id: 'demo-player-aisha', name: 'Aisha Rahman' },
  { id: 'demo-player-michael', name: 'Michael Thompson' },
];

type Bias = 'host-wins' | 'host-loses' | 'mixed';

type GameSpec = {
  id: string;
  playerCount: number;
  rounds: number;
  gameType: 'stake' | 'pool';
  bias: Bias;
  daysAgo: number;
  shareCode: string;
  live?: boolean;
};

const GAME_SPECS: GameSpec[] = [
  { id: 'demo-game-stake-4', playerCount: 4, rounds: 6, gameType: 'stake', bias: 'host-loses', daysAgo: 1, shareCode: 'FRI4' },
  { id: 'demo-game-stake-6', playerCount: 6, rounds: 11, gameType: 'stake', bias: 'host-wins', daysAgo: 4, shareCode: 'SAT6' },
  { id: 'demo-game-pool-8', playerCount: 8, rounds: 15, gameType: 'pool', bias: 'mixed', daysAgo: 9, shareCode: 'POOL8' },
  { id: 'demo-game-stake-12', playerCount: 12, rounds: 20, gameType: 'stake', bias: 'mixed', daysAgo: 16, shareCode: 'BIG12' },
  { id: 'demo-game-live', playerCount: 11, rounds: 10, gameType: 'stake', bias: 'mixed', daysAgo: 0, shareCode: 'LIVE', live: true },
];

const COUNT_MAGNITUDES = [4, 8, 14, 18, 22, 28, 36, 44, 52, 61, 70];

export function isDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX);
}

export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findPlayerByName(players: Player[], name: string): Player | undefined {
  const target = normalizePlayerName(name);
  return players.find((player) => normalizePlayerName(player.name) === target);
}

/**
 * Prefer the signed-in player when their name matches, then any non-demo
 * player with that name, so a phone account is never copied.
 */
export function resolveSrikanth(players: Player[], currentPlayerId: string | null): Player | null {
  const matches = players.filter(
    (player) => normalizePlayerName(player.name) === normalizePlayerName(SRIKANTH_NAME),
  );
  if (matches.length === 0) return null;

  if (currentPlayerId) {
    const current = matches.find((player) => player.id === currentPlayerId);
    if (current) return current;
  }

  return matches.find((player) => !isDemoId(player.id)) ?? matches[0];
}

function createSrikanthPlayer(): Player {
  return {
    id: 'demo-player-srikanth',
    name: SRIKANTH_NAME,
    role: 'player',
    gamesPlayed: 0,
    gamesWon: 0,
  };
}

function castPlayer(entry: { id: string; name: string }): Player {
  return {
    id: entry.id,
    name: entry.name,
    role: 'player',
    gamesPlayed: 0,
    gamesWon: 0,
  };
}

function buildRoster(host: Player, current: Player | null): Player[] {
  const extras = DEMO_CAST.map(castPlayer);
  if (current && current.id !== host.id) {
    return [host, current, ...extras.slice(0, extras.length - 1)];
  }
  return [host, ...extras];
}

function uniqueById(players: Player[]): Player[] {
  const seen = new Set<string>();
  const unique: Player[] = [];
  for (const player of players) {
    if (seen.has(player.id)) continue;
    seen.add(player.id);
    unique.push(player);
  }
  return unique;
}

function pickWinners(roundIndex: number, playerIds: string[], bias: Bias): string[] {
  const host = playerIds[0];
  const others = playerIds.slice(1);
  const primary = others[roundIndex % others.length];
  const secondary = others[(roundIndex + 2) % others.length];
  const distinct = (ids: string[]) => [...new Set(ids)];

  if (bias === 'host-wins') {
    if (roundIndex % 5 === 4) return [primary];
    if (roundIndex % 5 === 2) return distinct([host, secondary]);
    return [host];
  }

  if (bias === 'host-loses') {
    if (roundIndex % 6 === 0) return [host];
    return [primary];
  }

  if (roundIndex % 7 === 0) return [host];
  if (roundIndex % 7 === 3) return distinct([host, secondary]);
  return [primary];
}

function loserScore(
  playerIndex: number,
  roundIndex: number,
  settings: GameSettings,
  isHost: boolean,
  bias: Bias,
): { value: number; scoreType: ScoreType } {
  if (isHost && bias !== 'host-wins') {
    return roundIndex % 4 === 0
      ? { value: settings.dropAmount, scoreType: 'drop' }
      : { value: settings.mdAmount, scoreType: 'middle_drop' };
  }

  const kind = (playerIndex * 3 + roundIndex) % 6;
  if (kind === 0) return { value: settings.dropAmount, scoreType: 'drop' };
  if (kind === 1 || kind === 2) return { value: settings.mdAmount, scoreType: 'middle_drop' };

  const magnitude = COUNT_MAGNITUDES[(playerIndex + roundIndex * 2) % COUNT_MAGNITUDES.length];
  const value = Math.max(settings.maxCount, -magnitude);
  return { value, scoreType: 'count' };
}

function buildRound(
  playerIds: string[],
  settings: GameSettings,
  roundIndex: number,
  bias: Bias,
): RoundScoreInput[] {
  const winners = pickWinners(roundIndex, playerIds, bias);
  const winnerIds = new Set(winners);
  const inputs: RoundScoreInput[] = [];

  playerIds.forEach((playerId, index) => {
    if (winnerIds.has(playerId)) return;
    const score = loserScore(index, roundIndex, settings, index === 0, bias);
    inputs.push({ playerId, value: score.value, scoreType: score.scoreType });
  });

  if (settings.expense) {
    inputs.push({
      playerId: null,
      value: settings.expenseAmount,
      scoreType: 'expense',
    });
  }

  const entriesTotal = inputs.reduce((sum, input) => sum + input.value, 0);
  const winnings = distributeRummyWinnings(entriesTotal, winners);
  winners.forEach((winnerId) => {
    inputs.push({
      playerId: winnerId,
      value: winnings[winnerId] ?? 0,
      scoreType: 'rummy',
    });
  });

  return inputs;
}

function timestamp(now: Date, spec: GameSpec): string {
  if (spec.live) return new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - spec.daysAgo);
  date.setUTCHours(18, 30, 0, 0);
  return date.toISOString();
}

function buildGame(roster: Player[], spec: GameSpec, now: Date): Game {
  const playerIds = roster.slice(0, spec.playerCount).map((player) => player.id);
  const settings = legacySettingsForGameType(spec.gameType, true);
  const scores: Record<string, number[]> = Object.fromEntries(playerIds.map((playerId) => [playerId, []]));
  scores[DEMO_EXPENSE_ID] = [];

  for (let roundIndex = 0; roundIndex < spec.rounds; roundIndex += 1) {
    const inputs = buildRound(playerIds, settings, roundIndex, spec.bias);
    const validation = validateRoundScores(inputs);
    if (!validation.valid) {
      throw new Error(`${spec.id} round ${roundIndex + 1} is invalid: ${validation.error}`);
    }

    const byKey = new Map<string, number>();
    inputs.forEach((input) => {
      byKey.set(input.playerId ?? DEMO_EXPENSE_ID, input.value);
    });

    playerIds.forEach((playerId) => {
      scores[playerId].push(byKey.get(playerId) ?? 0);
    });
    scores[DEMO_EXPENSE_ID].push(byKey.get(DEMO_EXPENSE_ID) ?? 0);
  }

  return {
    id: spec.id,
    date: timestamp(now, spec),
    isComplete: !spec.live,
    players: playerIds,
    scores,
    currentRound: spec.rounds + 1,
    gameType: spec.gameType,
    settings,
    shareCode: spec.shareCode,
  };
}

function withoutDemoRecords(
  players: Player[],
  games: Game[],
  keepPlayerIds: string[],
): { players: Player[]; games: Game[] } {
  const keep = new Set(keepPlayerIds);
  return {
    players: players.filter((player) => !isDemoId(player.id) || keep.has(player.id)),
    games: games.filter((game) => !isDemoId(game.id)),
  };
}

function withResults(player: Player, games: Game[]): Player {
  const mine = games.filter((game) => game.players.includes(player.id));
  const wins = mine.filter((game) => {
    if (!game.isComplete) return false;
    const totals = calculateFinalTotals(game.scores);
    const best = Math.max(...Object.values(totals));
    return (totals[player.id] ?? 0) === best;
  }).length;

  return {
    ...player,
    gamesPlayed: mine.length,
    gamesWon: wins,
  };
}

export type DemoMergeResult = {
  players: Player[];
  games: Game[];
  host: Player;
};

export function mergeDemoData(
  existingPlayers: Player[],
  existingGames: Game[],
  currentPlayerId: string | null,
  now = new Date(),
): DemoMergeResult {
  const current = currentPlayerId
    ? existingPlayers.find((player) => player.id === currentPlayerId) ?? null
    : null;
  const host = resolveSrikanth(existingPlayers, currentPlayerId) ?? createSrikanthPlayer();
  const stripped = withoutDemoRecords(existingPlayers, existingGames, []);
  const roster = buildRoster(host, current);
  const demoGames = GAME_SPECS.map((spec) => buildGame(roster, spec, now));
  const games = [...stripped.games, ...demoGames];
  const demoPlayerIds = new Set(demoGames.flatMap((game) => game.players));
  const players = uniqueById([...stripped.players, ...roster]).map((player) =>
    demoPlayerIds.has(player.id) ? withResults(player, games) : player,
  );

  return {
    players,
    games,
    host: players.find((player) => player.id === host.id) ?? host,
  };
}

export function stripDemoData(
  players: Player[],
  games: Game[],
  keepPlayerIds: string[] = [],
): { players: Player[]; games: Game[] } {
  const removedIds = new Set(
    games.filter((game) => isDemoId(game.id)).flatMap((game) => game.players),
  );
  const next = withoutDemoRecords(players, games, keepPlayerIds);
  return {
    games: next.games,
    players: next.players.map((player) =>
      removedIds.has(player.id) ? withResults(player, next.games) : player,
    ),
  };
}
