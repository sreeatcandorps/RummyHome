import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { isUnregistered } from '@/utils/playerIdentity';

/** What link_player_check answers (migration 025); the local store builds the same shape. */
export type LinkPreview = {
  target: { id: string; name: string; playerNo: number | null };
  gameCount: number;
  conflicts: { gameId: string; gameNumber: number | null }[];
};

/** What link_player_to_account answers. */
export type LinkOutcome = {
  linkId: string | null;
  playerName: string;
  target: { id: string; name: string; playerNo: number | null };
  movedGameIds: string[];
  movedGameNumbers: number[];
};

export const LINK_MENU_LABEL = 'Link to Player ID';
export const LINK_COMPLETE_TITLE = 'Linked';

const gameWord = (n: number) => (n === 1 ? 'game' : 'games');

/** "G3, G7" for the conflict sentence; games without a number are counted as "a game". */
export function conflictGameList(conflicts: { gameNumber: number | null }[]): string {
  return conflicts.map((c) => (c.gameNumber != null ? `G${c.gameNumber}` : 'a game')).join(', ');
}

/** The sentence the Link button is blocked with when the account already plays alongside this player. */
export function linkConflictMessage(preview: LinkPreview): string | null {
  if (preview.conflicts.length === 0) return null;
  return `${preview.target.name} already plays in ${conflictGameList(preview.conflicts)} with this player. Remove one of the two from ${preview.conflicts.length === 1 ? 'that game' : 'those games'} first, then link.`;
}

/** What the confirm step says before the move. */
export function linkPreviewMessage(playerName: string, preview: LinkPreview): string {
  const no = preview.target.playerNo != null ? ` (#${preview.target.playerNo})` : '';
  if (preview.gameCount === 0) return `${playerName} is in no games yet. Linking folds them into ${preview.target.name}${no} on your My players list.`;
  return `${playerName}'s seat and scores in ${preview.gameCount} ${gameWord(preview.gameCount)} become ${preview.target.name}'s${no}. Every scorecard shows ${preview.target.name} from now on.`;
}

/** The link-complete pop-up body. */
export function linkCompleteMessage(outcome: LinkOutcome): string {
  const no = outcome.target.playerNo != null ? ` (#${outcome.target.playerNo})` : '';
  const moved = outcome.movedGameNumbers.length
    ? ` Scores in ${outcome.movedGameNumbers.map((n) => `G${n}`).join(', ')} moved over.`
    : outcome.movedGameIds.length
      ? ` Scores in ${outcome.movedGameIds.length} ${gameWord(outcome.movedGameIds.length)} moved over.`
      : '';
  return `${outcome.playerName} is now ${outcome.target.name}${no}.${moved}`;
}

/** Local prototype store: the same checks the server makes, over the games on this phone. */
export function localLinkPreview(player: Player, target: Player | null, email: string, games: Game[]): LinkPreview {
  if (!target || target.managedBy || (target.status && target.status !== 'registered')) throw new Error('No registered player has that Player ID.');
  if (!email.trim()) throw new Error('Type the email of the account to confirm it.');
  if ((target.email ?? '').trim().toLowerCase() !== email.trim().toLowerCase()) throw new Error(`That email does not match Player ID #${target.playerNo ?? '?'}.`);
  if (!isUnregistered(player.status)) throw new Error('Only an unregistered player can be linked to a Player ID.');
  const mine = games.filter((game) => game.players.includes(player.id));
  const conflicts = mine.filter((game) => game.players.includes(target.id)).map((game) => ({ gameId: game.id, gameNumber: game.gameNumber ?? null }));
  return { target: { id: target.id, name: target.name, playerNo: target.playerNo ?? null }, gameCount: mine.length, conflicts };
}

/** Local prototype store: move every seat to the account (no conflicts, checked by the caller). */
export function localLinkedGame(game: Game, playerId: string, targetId: string): Game {
  const swap = (id: string) => (id === playerId ? targetId : id);
  const wasUnseatedAdmin = game.unseatedAdminIds?.includes(targetId) ?? false;
  return {
    ...game,
    players: game.players.map(swap),
    scores: Object.fromEntries(Object.entries(game.scores).map(([id, column]) => [swap(id), column])),
    adminIds: [...new Set([...(game.adminIds ?? []).map(swap), ...(wasUnseatedAdmin ? [targetId] : [])])],
    unseatedAdminIds: game.unseatedAdminIds?.filter((id) => id !== targetId && id !== playerId),
    spectators: game.spectators?.filter((id) => id !== targetId && id !== playerId),
  };
}
