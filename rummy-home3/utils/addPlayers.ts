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

/** The big yellow circle: "N" over "TOTAL". */
export function totalLabel(total: number): { number: string; caption: string; spoken: string } {
  return { number: String(total), caption: 'TOTAL', spoken: `Total, ${total} ${total === 1 ? 'player' : 'players'}` };
}

/** "Added now: 3 (yellow ring)" — the line under "Playing in this game". */
export function addedNowLine(added: number): string {
  return added === 0 ? 'Added now: 0 · tap a player below to add them' : `Added now: ${added} (yellow ring)`;
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
