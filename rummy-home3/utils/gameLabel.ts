/**
 * The visible game number (migration 028): S<n> for Points games, P<n> for Pool games. The
 * server assigns it at creation and never changes it; the long id stays internal and is
 * never shown. A row from an older server (no game_label) falls back to the prefix from its
 * type and the stored number, so nothing shows a bare UUID.
 */
export type LabelledGame = {
  gameLabel?: string | null;
  gameNumber?: number | null;
  gameType?: 'stake' | 'pool' | null;
};

export function gameLabelPrefix(gameType: LabelledGame['gameType']): 'S' | 'P' {
  return gameType === 'pool' ? 'P' : 'S';
}

/** "S3" / "P1", or null when the game has no number yet. */
export function gameLabelOf(game: LabelledGame): string | null {
  if (game.gameLabel) return game.gameLabel;
  if (game.gameNumber != null) return `${gameLabelPrefix(game.gameType)}${game.gameNumber}`;
  return null;
}

/** "Game S3" for headings, or the fallback when the game has no number yet. */
export function gameTitle(game: LabelledGame, fallback = 'Game'): string {
  const label = gameLabelOf(game);
  return label ? `Game ${label}` : fallback;
}

/** Labels for a list of games as shown in link requests: "(S3, P1)". */
export function gameLabelList(labels: readonly string[] | null | undefined): string {
  return labels && labels.length ? ` (${labels.join(', ')})` : '';
}

/**
 * Local (no Supabase) games: the same rule as next_game_number, over the games this device
 * knows. Lowest number not used by a live or completed, not closed, not deleted game of the
 * same prefix that the creator created or sits in.
 */
export function nextLocalGameLabel(
  games: readonly { gameLabel?: string | null; gameNumber?: number | null; gameType?: 'stake' | 'pool' | null; createdBy?: string | null; players?: string[]; closedAt?: string | null; deletedAt?: string | null }[],
  creatorId: string,
  gameType: 'stake' | 'pool',
): string {
  const prefix = gameLabelPrefix(gameType);
  const taken = new Set<number>();
  for (const game of games) {
    if (game.closedAt || game.deletedAt) continue;
    if (game.createdBy !== creatorId && !(game.players ?? []).includes(creatorId)) continue;
    const label = gameLabelOf(game);
    if (!label || label[0] !== prefix) continue;
    const n = Number(label.slice(1));
    if (Number.isInteger(n) && n > 0) taken.add(n);
  }
  let n = 1;
  while (taken.has(n)) n += 1;
  return `${prefix}${n}`;
}
