import { userAdminsGame } from '@/utils/gameAccess';
import { playerIdBadge } from '@/utils/gamePlayers';
import { baseInitials } from '@/utils/playerInitials';
import { formatPoints, placeLabel, ResultsFilter, ResultsStatus, resultsStatusOf, reusedInResult, toggleResultsStatus } from '@/utils/results';

/**
 * Nov 10 batch 2: the Results picker lists every game the person is in, but only
 * games they run can be ticked, and Show results never saves by itself. The
 * results page has an explicit Save that closes the games and says so.
 */

type PickableGame = {
  id: string;
  isComplete?: boolean;
  closedAt?: string | null;
  gameNumber?: number | null;
  createdBy?: string | null;
  adminIds?: string[] | null;
};

export const NON_ADMIN_PICK_MESSAGE = "You're part of this game but not an admin. Ask the creator for admin privileges for this game.";

/** Only a creator or admin of the game may put it in a result. */
export function canPickForResults(game: { createdBy?: string | null; adminIds?: string[] | null }, userId: string | null | undefined): boolean {
  return userAdminsGame(game, userId);
}

export function selectedCountLine(count: number): string {
  if (count === 0) return 'No games selected';
  return count === 1 ? '1 game selected' : `${count} games selected`;
}

const gName = (game: { gameNumber?: number | null }) => (game.gameNumber != null ? `G${game.gameNumber}` : 'a game');

export function listNames(games: { gameNumber?: number | null }[]): string {
  const names = games.map(gName);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export type FilterSwitch<T> = {
  /** The filter after the tap. */
  next: ResultsFilter;
  /** Ticked games the new filter would hide. Empty means the switch needs no confirmation. */
  hidden: T[];
  /** The confirmation question, or null when nothing selected is affected. */
  question: string | null;
};

/**
 * Tapping a status chip may hide a ticked game. Work out which, so the screen can ask
 * first ("G7 is selected and will be deselected. OK?"); Cancel keeps filter and ticks.
 */
export function planFilterSwitch<T extends { id: string; isComplete?: boolean; closedAt?: string | null; gameNumber?: number | null }>(
  games: T[],
  checked: string[],
  filter: ResultsFilter,
  status: ResultsStatus,
): FilterSwitch<T> {
  const next = toggleResultsStatus(filter, status);
  const hidden = games.filter((game) => checked.includes(game.id) && !next.includes(resultsStatusOf(game)));
  if (hidden.length === 0) return { next, hidden, question: null };
  const names = listNames(hidden);
  const verb = hidden.length === 1 ? 'is' : 'are';
  return { next, hidden, question: `${names} ${verb} selected and will be deselected. OK?` };
}

/** Ticks after a confirmed switch: the hidden games are dropped; nothing else changes. */
export function applyFilterSwitch(checked: string[], hidden: { id: string }[]): string[] {
  const gone = new Set(hidden.map((game) => game.id));
  return checked.filter((id) => !gone.has(id));
}

/** One line per game that needs a flag on the results page, Active first then Closed. */
export type ResultLine = { kind: 'active' | 'closed'; gameId: string; text: string };

/** Shown on screen and in every share of a result that is not saved yet. */
export const RESULT_UNSAVED_BANNER = 'Not saved yet. This result may change.';

/** Everything the screen says above the totals, in order, for the picture and the PDF. */
export function resultShareNotes(warnings: { text: string }[], saved: boolean): string[] {
  return [...(saved ? [] : [RESULT_UNSAVED_BANNER]), ...warnings.map((warning) => warning.text)];
}

export function resultWarningLines(games: PickableGame[]): ResultLine[] {
  const active: ResultLine[] = games
    .filter((game) => !game.isComplete)
    .map((game) => ({ kind: 'active', gameId: game.id, text: `${gName(game)} is still active. Totals can change, and the result can't be saved while it is selected.` }));
  const closed: ResultLine[] = games
    .filter((game) => game.isComplete && Boolean(game.closedAt))
    .map((game) => ({ kind: 'closed', gameId: game.id, text: `${gName(game)} is already part of a previous result. Its points count again here.` }));
  return [...active, ...closed];
}

/** Why Save result is off, or null when it can go ahead. */
export function saveBlockedReason(games: PickableGame[], userId: string | null | undefined): string | null {
  if (games.length === 0) return 'Nothing to save.';
  const active = games.filter((game) => !game.isComplete);
  if (active.length > 0) {
    return `${listNames(active)} ${active.length === 1 ? 'is' : 'are'} still active. Go back and deselect ${active.length === 1 ? 'it' : 'them'} to save.`;
  }
  if (!games.every((game) => canPickForResults(game, userId))) return 'Only an admin of every selected game can save this result.';
  return null;
}

export type StatusChange = { gameId: string; label: string; from: 'Completed' | 'Closed'; to: 'Closed'; line: string };

/** What the Save popup lists: every game and what saving did to it. */
export function saveStatusChanges(games: PickableGame[]): StatusChange[] {
  return games.map((game) => {
    const label = gName(game);
    if (game.closedAt) {
      return { gameId: game.id, label, from: 'Closed', to: 'Closed', line: `${label}: already Closed · counted again in this result` };
    }
    return { gameId: game.id, label, from: 'Completed', to: 'Closed', line: `${label}: Completed → Closed` };
  });
}

/** For an opened saved result: one line per game that an earlier result had already closed. */
export function reusedWarningLines(games: { id: string; label?: string | null; name: string }[], reused: string[]): ResultLine[] {
  return games
    .filter((game) => reused.includes(game.id))
    .map((game) => ({ kind: 'closed', gameId: game.id, text: `${game.label?.trim() || game.name} was already part of an earlier result. Its points count again here.` }));
}

/** Games in a result that were closed by an earlier result (counted twice). */
export function reusedGameIds(games: { id: string; closedAt?: string | null }[], declaredAt: string): string[] {
  return games.filter((game) => reusedInResult(declaredAt, game)).map((game) => game.id);
}

/** A result that reused a closed game carries a small warning wherever it is listed. */
export function resultReusedNote(count: number | undefined): string | null {
  if (!count) return null;
  return count === 1 ? 'Includes a game from an earlier result' : `Includes ${count} games from earlier results`;
}

/** Past results card: the winner's initials under a crown, then 1st/2nd/3rd on their own rows. */
export function pastResultRows(top: { name: string; points: number; place: number }[]): { label: string; name: string; points: string }[] {
  return [...top]
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name))
    .map((row) => ({ label: placeLabel(row.place), name: row.name, points: formatPoints(row.points) }));
}

export function winnerInitials(top: { name: string; place: number }[]): string {
  const winner = top.find((row) => row.place === 1) ?? top[0];
  return winner ? baseInitials(winner.name) : '?';
}

/** "Sharing requires saving first": the share buttons stay off until the result has an id. */
export function canShareResult(resultId: string | null | undefined): boolean {
  return Boolean(resultId);
}

/** Second line under a total: initials, then the Player ID when known ("SK · #39"). */
export function totalsSubline(initials: string | undefined, player: { playerNo?: number | null; playerCode?: string } | undefined): string {
  const id = player ? playerIdBadge(player) : null;
  return [initials, id].filter(Boolean).join(' · ');
}
