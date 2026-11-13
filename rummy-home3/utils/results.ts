import { gameLabelOf, LabelledGame } from '@/utils/gameLabel';
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
  /** Short code (share code or id tail). */
  name: string;
  /** The game's own number, "G7". Fixed at creation and never renumbered by position. */
  label?: string;
  date: string;
  scores: Record<string, number>;
  /** Round-by-round scores for the PDF. Results saved before this was added have none. */
  rounds?: Record<string, number[]>;
};

export type ResultSheet = {
  /**
   * playerNo is the public Player ID (#39); filled by 018 on the server, or from the games' seats.
   * label is the seat's column initials (022) from the first game that has them; filled from the games' seats.
   */
  players: { id: string; name: string; playerNo?: number | null; label?: string | null }[];
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
  /** Games here that an earlier result had already closed (their points count twice). Needs 018 on the server. */
  reusedGameIds?: string[];
  /** Games deleted after this result was saved and so removed from it (023). Standings no longer count them. */
  removedGameIds?: string[];
  /** Whether the viewer may delete this result (023): the person who saved it, or an admin of its games. */
  canManage?: boolean;
  /** Soft delete (023). A deleted result shows only this; its games are uncounted again. */
  deletedAt?: string | null;
  canRestore?: boolean;
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
  /** How many of its games were already in an earlier result. Absent on servers before 018. */
  reusedCount?: number;
};

/** Past results load this many at a time. */
export const RESULTS_PAGE_SIZE = 5;

/**
 * Whether a selection could be saved (every game finished) or only shown. Since Nov 10
 * Show results never saves; the results page's Save result does, and uses saveBlockedReason.
 */
export function resultsShowMode(games: { isComplete?: boolean }[]): 'save' | 'preview' {
  if (games.length === 0) return 'preview';
  return games.every((game) => Boolean(game.isComplete)) ? 'save' : 'preview';
}

/**
 * Games the Results page lists. Closed games stay in the list: picking one again
 * is allowed, with a warning, because its points were already counted once.
 */
export function selectableResultGames<T extends { closedAt?: string | null }>(games: T[]): T[] {
  return [...games];
}

// ---------- Results page filter, default selection, and warnings ----------

/** One status chip on the Results picker. Any mix can be on at once. */
export type ResultsStatus = 'completed' | 'closed' | 'active';
export const RESULTS_STATUSES: ResultsStatus[] = ['completed', 'closed', 'active'];
export type ResultsFilter = ResultsStatus[];
/** Completed only: finished games that are not in a result yet. */
export const DEFAULT_RESULTS_FILTER: ResultsFilter = ['completed'];
export const RESULTS_FILTER_LABEL: Record<ResultsStatus, string> = { completed: 'Completed', closed: 'Closed', active: 'Active' };

type FilterableGame = { isComplete?: boolean; closedAt?: string | null };

/** Closed beats Completed: a game in a result is Closed even though it is also finished. */
export function resultsStatusOf(game: FilterableGame): ResultsStatus {
  if (game.closedAt) return 'closed';
  return game.isComplete ? 'completed' : 'active';
}

/** Flip one status chip. Turning the last one off is allowed; the list then says so. */
export function toggleResultsStatus(filter: ResultsFilter, status: ResultsStatus): ResultsFilter {
  return filter.includes(status)
    ? filter.filter((item) => item !== status)
    : RESULTS_STATUSES.filter((item) => item === status || filter.includes(item));
}

/** Only games whose status chip is on. Order is kept. */
export function filterResultGames<T extends FilterableGame>(games: T[], filter: ResultsFilter): T[] {
  return games.filter((game) => filter.includes(resultsStatusOf(game)));
}

/**
 * Completed games start ticked so Show results is one tap. Closed and Active games
 * never start ticked: each one carries a warning and has to be a deliberate choice.
 */
export function defaultResultSelection<T extends FilterableGame & { id: string; createdBy?: string | null; adminIds?: string[] | null }>(
  games: T[],
  filter: ResultsFilter,
  userId?: string | null,
): string[] {
  return filterResultGames(games, filter)
    .filter((game) => resultsStatusOf(game) === 'completed')
    // Games the person does not run are listed but never ticked (they cannot be saved).
    .filter((game) => userId === undefined || userAdminsGame(game, userId))
    .map((game) => game.id);
}

/**
 * Only ticked games that are on screen count. A game ticked and then hidden by a
 * chip (or Closed by a result) must not ride along unseen — that was "7 selected, 5 shown".
 */
export function visibleSelection<T extends { id: string }>(checked: string[], shown: T[]): T[] {
  return shown.filter((game) => checked.includes(game.id));
}

/** "Select completed games", "Select closed games", or "Select games" for a mix. */
export function resultsPickerHeading(filter: ResultsFilter): string {
  if (filter.length === 1) return `Select ${RESULTS_FILTER_LABEL[filter[0]].toLowerCase()} games`;
  return 'Select games';
}

/** Counts per status, for an honest empty message. */
export function resultsStatusCounts(games: FilterableGame[]): Record<ResultsStatus, number> {
  const counts: Record<ResultsStatus, number> = { completed: 0, closed: 0, active: 0 };
  games.forEach((game) => { counts[resultsStatusOf(game)] += 1; });
  return counts;
}

/**
 * What to say when the list is empty. Never "no games" when games exist but are
 * hidden by the chips; say which ones are hidden instead.
 */
export function resultsEmptyText(games: FilterableGame[], filter: ResultsFilter): string {
  if (games.length === 0) return 'No games to add up yet. Start a game from Home, then select it here.';
  const counts = resultsStatusCounts(games);
  const hidden = RESULTS_STATUSES
    .filter((status) => !filter.includes(status) && counts[status] > 0)
    .map((status) => `${counts[status]} ${RESULTS_FILTER_LABEL[status]}`);
  if (filter.length === 0) return `No status selected. Turn on a chip above to list games (${hidden.join(', ')}).`;
  const shown = filter.map((status) => RESULTS_FILTER_LABEL[status]).join(' or ');
  return hidden.length > 0
    ? `No ${shown} games. Hidden by the chips: ${hidden.join(', ')}.`
    : `No ${shown} games.`;
}

export type ResultWarning = { kind: 'active' | 'reused'; text: string };

const gameNames = (games: LabelledGame[]) => {
  const names = games.map((game) => gameLabelOf(game) ?? 'a game');
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * The two flags a result can carry, for the picker and for an opened result:
 * an Active game was included (totals can still change), or a game was already
 * part of another result (its points are counted twice).
 */
export function resultWarnings(games: (LabelledGame & { isComplete?: boolean; closedAt?: string | null; reused?: boolean })[]): ResultWarning[] {
  const warnings: ResultWarning[] = [];
  const active = games.filter((game) => !game.isComplete);
  if (active.length > 0) {
    warnings.push({
      kind: 'active',
      text: `An active game was used in these results (${gameNames(active)}). Totals can still change and nothing is saved.`,
    });
  }
  const reused = games.filter((game) => game.reused ?? Boolean(game.closedAt));
  if (reused.length > 0) {
    warnings.push({
      kind: 'reused',
      text: `${gameNames(reused)} ${reused.length === 1 ? 'was' : 'were'} already part of another result. Those points count twice.`,
    });
  }
  return warnings;
}

/**
 * For an opened past result: a game whose closedAt is well before this result's
 * declaredAt was closed by an earlier result, so it appears in more than one.
 */
export function reusedInResult(declaredAt: string, game: { closedAt?: string | null }, slackMs = 60_000): boolean {
  if (!game.closedAt) return false;
  const closed = Date.parse(game.closedAt);
  const declared = Date.parse(declaredAt);
  if (Number.isNaN(closed) || Number.isNaN(declared)) return false;
  return declared - closed > slackMs;
}

/** Warning shown above Show results when any picked game is already Closed. */
export function closedSelectionWarning(selected: (LabelledGame & { closedAt?: string | null })[]): string | null {
  const closed = selected.filter((game) => Boolean(game.closedAt));
  if (closed.length === 0) return null;
  const names = closed.map((game) => gameLabelOf(game) ?? 'A closed game');
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${list} ${closed.length === 1 ? 'is' : 'are'} already counted in an earlier result. Showing results again counts ${closed.length === 1 ? 'it' : 'them'} twice.`;
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
    ...(result.reusedGameIds ? { reusedCount: result.reusedGameIds.length } : {}),
  };
}

/** Share code when the game has one, otherwise the tail of the id. */
/** Six stable characters from the result id, the same every time it is shared. */
export function resultShortId(resultId: string): string {
  const compact = resultId.replace(/[^a-z0-9]/gi, '');
  return compact.slice(-6).toUpperCase() || resultId.toUpperCase();
}

/** The last line on every consolidated share: image, PDF, preview. */
export function resultFooter(input: { resultId?: string | null; preview?: boolean }): string {
  if (input.resultId) return `Result ID · ${resultShortId(input.resultId)}`;
  return input.preview ? 'Preview · not saved' : 'Results';
}

export function gameResultName(game: { id: string; shareCode?: string | null }): string {
  const code = game.shareCode?.trim();
  if (code) return code;
  return game.id.slice(-6).toUpperCase();
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
 * Rows follow the game date. Columns follow the places (highest points first).
 * A player who was not seated in that game has no score key.
 */
export function buildResultSheet(
  games: Array<ResultGame & { id: string; name: string; label?: string; date: string }>,
  standings: ResultStanding[],
): ResultSheet {
  const ordered = [...games].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return {
    players: standings.map((row) => ({ id: row.id, name: row.name })),
    games: ordered.map((game) => {
      const scores: Record<string, number> = {};
      const rounds: Record<string, number[]> = {};
      // Seat order is kept in the key order, so labels can follow first appearance.
      const known = new Set(standings.map((row) => row.id));
      game.players.forEach((id) => {
        if (!id || id === RESULT_EXPENSE_ID || !known.has(id) || id in scores) return;
        const values = (game.scores[id] ?? []).map((value) => Number(value) || 0);
        scores[id] = values.reduce((sum, value) => sum + value, 0);
        rounds[id] = values;
      });
      return { id: game.id, name: game.name, ...(game.label ? { label: game.label } : {}), date: game.date, scores, rounds };
    }),
  };
}

export function presentResults(games: Array<ResultGame & { id: string; name: string; label?: string; date: string }>) {
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

/**
 * Column header for a game in a result. A game keeps its own number (G7 stays
 * G7 whatever else is selected). Results saved before numbers were stored show
 * their short code instead; nothing is ever renumbered by position.
 */
export function sheetGameLabel(game: { label?: string | null; name: string }): string {
  return game.label?.trim() || game.name;
}

/** "S7" label for a live game being added up. */
export function gameLabelFor(game: LabelledGame): string | undefined {
  return gameLabelOf(game) ?? undefined;
}

/**
 * A saved result after some of its games were deleted (023): those games leave the sheet
 * and the standings are totalled again from the games that remain. Players who were only
 * in the removed games drop out. The server does the same in result_places_json; this is
 * the local-store copy and the rule the unit tests pin down.
 */
export function withoutGames(result: GameResult, gameIds: string[]): GameResult {
  const removed = new Set(gameIds);
  if (!result.gameIds.some((id) => removed.has(id))) return result;
  const sheetPlayers = result.sheet?.players ?? result.standings.map((row) => ({ id: row.id, name: row.name }));
  const names = Object.fromEntries(sheetPlayers.map((player) => [player.id, player.name]));
  const keptGames = (result.sheet?.games ?? []).filter((game) => !removed.has(game.id));
  const standings = totalAcrossGames(keptGames.map((game) => ({
    players: Object.keys(game.scores).filter((id) => id !== RESULT_EXPENSE_ID),
    scores: Object.fromEntries(Object.entries(game.scores).map(([id, points]) => [id, [points]])),
    names,
  })));
  const stillIn = new Set(standings.map((row) => row.id));
  return {
    ...result,
    gameIds: result.gameIds.filter((id) => !removed.has(id)),
    standings,
    sheet: { players: sheetPlayers.filter((player) => stillIn.has(player.id)), games: keptGames },
    reusedGameIds: result.reusedGameIds?.filter((id) => !removed.has(id)),
    removedGameIds: [...new Set([...(result.removedGameIds ?? []), ...result.gameIds.filter((id) => removed.has(id))])],
  };
}
