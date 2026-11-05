import { MAX_RESULTS_PLAYERS } from '@/constants/limits';
import { userAdminsGame } from '@/utils/gameAccess';

/** Older saved games may still have this column id. It is not a player. */
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
  /** Round-by-round scores for the PDF. Results saved before this was added have none. */
  rounds?: Record<string, number[]>;
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
  /** Seated players in the result. */
  playerCount: number;
  /** 1st, 2nd, and 3rd place rows (ties share a place). */
  top: { name: string; points: number; place: number }[];
};

/** Past results load this many at a time. */
export const RESULTS_PAGE_SIZE = 5;

/**
 * Show results either saves (every selected game is finished, so those games become Closed)
 * or only previews running totals (any selected game is still open; nothing is saved or closed).
 */
export function resultsShowMode(games: { isComplete?: boolean }[]): 'save' | 'preview' {
  if (games.length === 0) return 'preview';
  return games.every((game) => Boolean(game.isComplete)) ? 'save' : 'preview';
}

/** Games the Results page lists: open and finished, never Closed. */
export function selectableResultGames<T extends { closedAt?: string | null }>(games: T[]): T[] {
  return games.filter((game) => !game.closedAt);
}

/** Top 3 places, for the past results list. */
export function topThree(standings: ResultStanding[]): { name: string; points: number; place: number }[] {
  return standings
    .filter((row) => row.place <= 3)
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name))
    .map((row) => ({ name: row.name, points: row.points, place: row.place }));
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Readable PDF name: EZScore-Rummy-Results-YYYY-MM-DD-HHmm.pdf (local time). */
export function resultsPdfFileName(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return `EZScore-Rummy-Results-${safe.getFullYear()}-${pad2(safe.getMonth() + 1)}-${pad2(safe.getDate())}-${pad2(safe.getHours())}${pad2(safe.getMinutes())}.pdf`;
}

/** "3 games · 6 players" */
export function resultsCountLine(gameCount: number, playerCount: number): string {
  return `${gameCount === 1 ? '1 game' : `${gameCount} games`} · ${playerCount === 1 ? '1 player' : `${playerCount} players`}`;
}

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
 * place skips ahead (1, 1, 3). A leftover column id EX is left out.
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
    playerCount: result.standings.length,
    top: topThree(result.standings),
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

/**
 * Results table widths. Game columns hold a sign plus four digits ("-1234"),
 * Total a sign plus five. Both are fixed; the player column takes what is left
 * so full names can wrap onto a second line instead of being cut.
 */
export const RESULTS_GAME_COL = 48;
export const RESULTS_TOTAL_COL = 54;
/**
 * The player column never gets narrower than this; past it the table scrolls sideways.
 * 96 keeps a 12-letter surname ("Yalamanchili") on one line instead of breaking mid-word.
 */
export const RESULTS_NAME_MIN = 96;

/**
 * Pixel widths: name, then one width per game, then Total.
 * Name = frame − games − Total, floored at RESULTS_NAME_MIN.
 */
export function resultsColumnWidths(frameWidth: number, gameCount: number): number[] {
  const width = Math.max(0, Math.floor(frameWidth));
  const games = Math.max(0, gameCount);
  const scores = games * RESULTS_GAME_COL + RESULTS_TOTAL_COL;
  const nameWidth = Math.max(RESULTS_NAME_MIN, width - scores);
  return [nameWidth, ...Array(games).fill(RESULTS_GAME_COL), RESULTS_TOTAL_COL];
}

/** How many game columns are on screen. Total has its own slot and is not counted here. */
export function resultsVisibleGameCount(frameWidth: number, gameCount: number): number {
  const games = Math.max(0, gameCount);
  if (games === 0) return 0;
  if (!resultsTableScrollsHorizontally(frameWidth, games)) return games;
  const room = Math.max(0, Math.floor(frameWidth) - RESULTS_NAME_MIN - RESULTS_TOTAL_COL);
  return Math.min(games, Math.floor(room / RESULTS_GAME_COL));
}

export function resultsTableScrollsHorizontally(frameWidth: number, gameCount: number): boolean {
  const content = resultsColumnWidths(frameWidth, gameCount).reduce((sum, value) => sum + value, 0);
  return content > Math.floor(frameWidth);
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
      const rounds: Record<string, number[]> = {};
      const seated = new Set(game.players.filter((id) => id && id !== RESULT_EXPENSE_ID));
      standings.forEach((row) => {
        if (!seated.has(row.id)) return;
        const values = (game.scores[row.id] ?? []).map((value) => Number(value) || 0);
        scores[row.id] = values.reduce((sum, value) => sum + value, 0);
        rounds[row.id] = values;
      });
      return { id: game.id, name: game.name, date: game.date, scores, rounds };
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

/** Start time for a Results column header: h:mm am/pm (10:05 pm). */
export function gameClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hour = date.getHours() % 12 || 12;
  return `${hour}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() < 12 ? 'am' : 'pm'}`;
}

/** "G1", "G2"… for table headers; games are already in start order. */
export function gameShortLabel(index: number): string {
  return `G${index + 1}`;
}

/** "G1 10:05 pm" for the PDF; games are already in start order. */
export function gameColumnLabel(index: number, when: string): string {
  return when ? `${gameShortLabel(index)} ${when}` : gameShortLabel(index);
}
