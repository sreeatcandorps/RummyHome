/**
 * Add players to this game (PR 7): the words around the picker in add mode.
 * Total counts seated players only (D7.1) — the same number the scorecard's
 * "N players" chip shows — never non-playing admins or viewers.
 */

export const ADD_PLAYERS_TITLE = 'Add players to this game';
export const RETURN_TO_GAME = 'Return to game';
export const FROM_DATABASE_ACCESSIBILITY = 'Add players to this game from the EZ Score database';
export const ADD_NEW_PLAYERS = 'Add new players';
export const SEARCH_PLACEHOLDER = 'Search name, initials or #ID';
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
