import { MAX_RESULTS_PLAYERS } from '@/constants/limits';
import { userAdminsGame } from '@/utils/gameAccess';

/** Matches the expense column in services/games.ts. It is not a player. */
export const RESULT_EXPENSE_ID = 'EX';

export type ResultGame = {
  players: string[];
  scores: Record<string, number[] | undefined>;
  names?: Record<string, string>;
};

export type ResultStanding = {
  id: string;
  name: string;
  points: number;
  games: number;
  place: number;
};

/** One cell in the game × player sheet. A missing key means that player did not play. */
export type ResultSheetGame = {
  id: string;
  name: string;
  date: string;
  scores: Record<string, number>;
};

export type ResultSheet = {
  players: { id: string; name: string }[];
  games: ResultSheetGame[];
};

export type GameResult = {
  id: string;
  declaredAt: string;
  declaredBy: string;
  gameIds: string[];
  standings: ResultStanding[];
  /** Per-game scores so a declared result can draw the sheet without the games. */
  sheet?: ResultSheet;
};

export type GameResultSummary = {
  id: string;
  declaredAt: string;
  gameCount: number;
  winnerLine: string;
};

export function formatPoints(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function placeLabel(place: number): string {
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  switch (place % 10) {
    case 1: return `${place}st`;
    case 2: return `${place}nd`;
    case 3: return `${place}rd`;
    default: return `${place}th`;
  }
}

/**
 * Highest points take 1st place. Tied totals share a place, and the next
 * place skips ahead (1, 1, 3). The expense column is left out.
 */
export function totalAcrossGames(games: ResultGame[]): ResultStanding[] {
  const totals = new Map<string, { name: string; points: number; games: number }>();

  games.forEach((game) => {
    const seen = new Set<string>();
    game.players.forEach((rawId) => {
      if (!rawId || rawId === RESULT_EXPENSE_ID || seen.has(rawId)) return;
      seen.add(rawId);
      const points = (game.scores[rawId] ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const named = game.names?.[rawId]?.trim();
      const current = totals.get(rawId) ?? { name: named || 'Player', points: 0, games: 0 };
      current.points += points;
      current.games += 1;
      if (named) current.name = named;
      totals.set(rawId, current);
    });
  });

  const list = [...totals.entries()].map(([id, row]) => ({ id, ...row }));
  list.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  let place = 0;
  let lastPoints: number | null = null;
  return list.map((row, index) => {
    if (lastPoints === null || row.points !== lastPoints) {
      place = index + 1;
      lastPoints = row.points;
    }
    return { ...row, place };
  });
}

/** Up to three place groups for the podium, best first. */
export function podiumPlaces(standings: ResultStanding[]): ResultStanding[][] {
  const groups: ResultStanding[][] = [];
  standings.forEach((row) => {
    const last = groups[groups.length - 1];
    if (last && last[0].place === row.place) {
      last.push(row);
      return;
    }
    if (groups.length >= 3) return;
    groups.push([row]);
  });
  return groups;
}

export function winnerLine(standings: ResultStanding[]): string {
  return winnerLineFromNames(standings.filter((row) => row.place === 1).map((row) => row.name));
}

export function winnerLineFromNames(names: string[]): string {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return 'Results';
  if (cleaned.length === 1) return `Winner: ${cleaned[0]}`;
  if (cleaned.length === 2) return `1st place: ${cleaned[0]} and ${cleaned[1]}`;
  return `1st place: ${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
}

export function summaryFrom(result: GameResult): GameResultSummary {
  return {
    id: result.id,
    declaredAt: result.declaredAt,
    gameCount: result.gameIds.length,
    winnerLine: winnerLine(result.standings),
  };
}

/** Share code when the game has one, otherwise the tail of the id. */
export function gameResultName(game: { id: string; shareCode?: string | null }): string {
  const code = game.shareCode?.trim();
  if (code) return code;
  return game.id.slice(-6).toUpperCase();
}

/** Zero sits with the positive totals. Each column is largest magnitude first. */
export function splitTotals(standings: ResultStanding[]): { positive: ResultStanding[]; negative: ResultStanding[] } {
  const byMagnitude = (a: ResultStanding, b: ResultStanding) =>
    Math.abs(b.points) - Math.abs(a.points) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  return {
    positive: standings.filter((row) => row.points >= 0).sort(byMagnitude),
    negative: standings.filter((row) => row.points < 0).sort(byMagnitude),
  };
}

export function resultsPlayerCount(games: ResultGame[]): number {
  const ids = new Set<string>();
  games.forEach((game) => {
    game.players.forEach((id) => {
      if (id && id !== RESULT_EXPENSE_ID) ids.add(id);
    });
  });
  return ids.size;
}

export function withinResultsPlayerLimit(games: ResultGame[]): boolean {
  return resultsPlayerCount(games) <= MAX_RESULTS_PLAYERS;
}

/** "—" when they were not seated. "0" when they played and scored 0. */
export function scoreCell(scores: Record<string, number>, playerId: string): string {
  if (!Object.prototype.hasOwnProperty.call(scores, playerId)) return '—';
  return formatPoints(scores[playerId]);
}

/** The word a person is sorted by. "Ann Marie" sorts with Ann. */
export function firstNameKey(name: string): string {
  const word = name.trim().split(/\s+/)[0] ?? '';
  return (word || name).toLocaleLowerCase();
}

/** Rows of the results table: first name A–Z, then the full name. */
export function playersByFirstName<T extends { id: string; name: string }>(players: T[]): T[] {
  return [...players].sort((a, b) =>
    firstNameKey(a.name).localeCompare(firstNameKey(b.name))
    || a.name.localeCompare(b.name)
    || a.id.localeCompare(b.id));
}

/** Four game columns plus Total fill a phone. A fifth game is what starts the sideways scroll. */
export const RESULTS_GAMES_WITHOUT_SCROLL = 4;
export const RESULTS_NAME_COL = 92;

function splitEven(available: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(available / count);
  const extra = available - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

/** Pixel widths: name, then one width per game, then Total. */
export function resultsColumnWidths(frameWidth: number, gameCount: number): number[] {
  const width = Math.max(0, Math.floor(frameWidth));
  const nameWidth = width > RESULTS_NAME_COL + 40 ? RESULTS_NAME_COL : Math.max(72, Math.floor(width * 0.4));
  const games = Math.max(0, gameCount);
  const scoreCount = games + 1;
  const available = Math.max(0, width - nameWidth);
  const fittedSlots = Math.min(games, RESULTS_GAMES_WITHOUT_SCROLL) + 1;
  if (games <= RESULTS_GAMES_WITHOUT_SCROLL) {
    return [nameWidth, ...splitEven(available, scoreCount)];
  }
  const scoreWidth = Math.floor(available / fittedSlots);
  return [nameWidth, ...Array(scoreCount).fill(scoreWidth)];
}

export function resultsTableScrollsHorizontally(frameWidth: number, gameCount: number): boolean {
  const content = resultsColumnWidths(frameWidth, gameCount).reduce((sum, value) => sum + value, 0);
  return content > frameWidth + 1;
}

/**
 * Rows follow the game date. Columns follow the places (highest points first).
 * A player who was not seated in that game has no score key.
 */
export function buildResultSheet(
  games: Array<ResultGame & { id: string; name: string; date: string }>,
  standings: ResultStanding[],
): ResultSheet {
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return {
    players: standings.map((row) => ({ id: row.id, name: row.name })),
    games: ordered.map((game) => {
      const scores: Record<string, number> = {};
      const seated = new Set(game.players.filter((id) => id && id !== RESULT_EXPENSE_ID));
      standings.forEach((row) => {
        if (!seated.has(row.id)) return;
        scores[row.id] = (game.scores[row.id] ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0);
      });
      return { id: game.id, name: game.name, date: game.date, scores };
    }),
  };
}

export function presentResults(games: Array<ResultGame & { id: string; name: string; date: string }>) {
  const standings = totalAcrossGames(games);
  return { standings, sheet: buildResultSheet(games, standings) };
}

/** True only when this person runs every selected game. An empty selection is not enough. */
export function canDeclareResults(
  games: { createdBy?: string | null; adminIds?: string[] | null }[],
  userId: string | null | undefined,
): boolean {
  if (!userId || games.length === 0) return false;
  return games.every((game) => userAdminsGame(game, userId));
}
