import { planJoin } from '@/utils/dealerRotation';

/**
 * Add players to this game (PR 7): the words around the picker in add mode.
 * Total counts seated players only (D7.1) — the same number the scorecard's
 * "N players" chip shows — never non-playing admins or viewers.
 */

export const ADD_PLAYERS_TITLE = 'Add players to this game';
export const RETURN_TO_GAME = 'Return to game';
export const FROM_DATABASE_ACCESSIBILITY = 'Find in database: add players to this game from the EZ Score database';
/** The one pair of labels for adding people, everywhere (A21 / Q11.10): by initials, or from the database. */
export const ADD_NEW_PLAYERS = 'Add by initials';
export const FIND_IN_DATABASE = 'Find in database';
/** My players search, on this phone and search_my_players: the user's own players only. */
export const SEARCH_PLACEHOLDER = 'Search name, initials or #ID';
/** Find in database is a Player ID box (D113): the number only, then Search. Names are never searched. */
export const PLAYER_ID_PLACEHOLDER = 'Player ID, e.g. 57';
export const PLAYER_ID_HINT = 'Ask them for their Player ID. It is on their Profile.';
export const PLAYER_ID_SEARCH = 'Search';
export const PLAYER_ID_CHECK = 'Is this the person in front of you? If not, check the number with them.';
export const PLAYER_ID_NUMBER_ONLY = 'Type the number only, like 57.';
export const ADD_TO_GAME = 'Add to game';
export const ADD_TO_MY_PLAYERS = 'Add to My players';
export const NON_PLAYING_ADMIN_BUTTON = 'Add non-playing admin';
export const NON_PLAYING_ADMIN_NOTE = 'Someone who keeps score but does not play. Enter their Player ID (#NN). They can add and edit rounds; they get no column.';
/** The short form on the Players · Admins row; the full note sits behind the group's ⓘ. */
export const NON_PLAYING_ADMIN_ROW = 'Keeps score, does not play. By Player ID.';

/** The big yellow circle: "N" over "TOTAL". */
export function totalLabel(total: number): { number: string; caption: string; spoken: string } {
  return { number: String(total), caption: 'TOTAL', spoken: `Total, ${total} ${total === 1 ? 'player' : 'players'}` };
}

/** "Added now: 3 (yellow ring)" — the line under "Playing in this game". */
export function addedNowLine(added: number): string {
  return added === 0 ? 'Added now: 0 · tap a player below to add them' : `Added now: ${added} (yellow ring)`;
}

const listNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * 054 (D70) — the notice above Return to game once rounds have been played, naming the seat before
 * it is taken (Sree, Nov 21: "his seat is going to be so-and-so number … in between these two
 * people"): "Ravi sits at seat 4, between Anu and Bala — left of the dealer." Several newcomers sit
 * side by side in the order they were picked. Null before round 1 (they take the last seat) or when
 * nobody new is picked.
 */
export function joinSeatNotice(
  game: Parameters<typeof planJoin>[0],
  roundCount: number,
  joiners: readonly { id: string; name: string }[],
  nameOf: (id: string) => string,
): string | null {
  if (roundCount <= 0 || joiners.length === 0) return null;
  let table = game;
  let first: ReturnType<typeof planJoin> | null = null;
  for (const joiner of joiners) {
    const plan = planJoin(table, roundCount, joiner.id);
    first = first ?? plan;
    table = { ...table, players: plan.players, nextDealerOverride: plan.nextDealerOverride };
  }
  if (!first?.dealer) return null;
  const ring = table.players;
  const seat = first.seat + 1;
  const left = ring[(first.seat - 1 + ring.length) % ring.length];
  const right = ring[(first.seat + joiners.length) % ring.length];
  const who = listNames(joiners.map((joiner) => joiner.name));
  const where = joiners.length === 1 ? `${who} sits at seat ${seat}` : `${who} sit at seats ${seat}–${seat + joiners.length - 1}`;
  const between = left === right ? '' : `, between ${nameOf(left)} and ${nameOf(right)}`;
  return `${where}${between} — left of the dealer.`;
}

/** The button never counts ("Return to game · add 4" is gone). */
export function returnButtonLabel(): string {
  return RETURN_TO_GAME;
}

/**
 * The New game Next button (design audit A08): a disabled primary says why in its own label,
 * "Next · pick 2+ players" / "Next · pick 1 more player", then "Next · 4 players".
 */
export function nextLabel(seatedCount: number): string {
  if (seatedCount <= 0) return 'Next · pick 2+ players';
  if (seatedCount === 1) return 'Next · pick 1 more player';
  return `Next · ${seatedCount} players`;
}

/** D108: the dismissible card at the top of My players, the two ways to add someone. */
export const HOW_TO_ADD_LINES = [
  'Has the app? Ask for their Player ID and search it.',
  'No app? Add their initials; link them later with their Player ID.',
] as const;
/** Remembered on this phone once the card is closed. */
export const HOW_TO_ADD_DISMISSED_KEY = 'howToAddPlayersDismissed';
