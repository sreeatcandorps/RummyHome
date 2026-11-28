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

/**
 * Header title of a game screen (design audit A02): "Scorecard · S3", "Complete · S3", "Awards · P1",
 * "Log · S3", "Players · Admins · S3" — the screen first, then the game label; just the screen when the
 * game has no number yet. Titles are centred; the content keeps its own heading ("S3 · Round 7").
 */
export function screenTitle(screen: string, game: LabelledGame | null | undefined): string {
  const label = game ? gameLabelOf(game) : null;
  return label ? `${screen} · ${label}` : screen;
}

/** Header title type (`app/(screens)/_layout.tsx`: 20 sp, bold); a bold Roboto glyph averages about 0.55 em. */
const HEADER_TITLE_SP = 20;
const HEADER_GLYPH_EM = 0.55;
/** Android's header: the title starts 72 dp in, after the back arrow; each icon on the right takes 48 dp. */
const HEADER_START_DP = 72;
const HEADER_ACTION_DP = 48;
const HEADER_END_DP = 4;

/** The width a header title gets beside the back arrow and `rightActions` icons. */
export function headerTitleRoom(windowWidth: number, rightActions: number): number {
  return windowWidth - HEADER_START_DP - rightActions * HEADER_ACTION_DP - HEADER_END_DP;
}

/**
 * The first title that fits the header without an ellipsis, else the last one. At 360 dp × 1.3 "Scorecard · P2"
 * was cut to "Scorecar…" and "Players · Admins · P2" lost its label (batch rows 12k, 12j), so a screen offers a
 * shorter form after the full one.
 */
export function fitHeaderTitle(candidates: readonly string[], room: number, fontScale: number): string {
  const glyph = HEADER_TITLE_SP * HEADER_GLYPH_EM * fontScale;
  return candidates.find((title) => title.length * glyph <= room) ?? candidates[candidates.length - 1];
}

/** Labels for a list of games as shown in link requests: "(S3, P1)". */
export function gameLabelList(labels: readonly string[] | null | undefined): string {
  return labels && labels.length ? ` (${labels.join(', ')})` : '';
}

/**
 * Local (no Supabase) games: the same rule as next_game_number (038), over the games this
 * device knows. Lowest number not used by an ACTIVE (not completed, not closed, not deleted)
 * game of the same prefix that the creator created or sits in.
 */
export function nextLocalGameLabel(
  games: readonly { gameLabel?: string | null; gameNumber?: number | null; gameType?: 'stake' | 'pool' | null; createdBy?: string | null; players?: string[]; isComplete?: boolean; closedAt?: string | null; deletedAt?: string | null }[],
  creatorId: string,
  gameType: 'stake' | 'pool',
): string {
  const prefix = gameLabelPrefix(gameType);
  const taken = new Set<number>();
  for (const game of games) {
    if (game.isComplete || game.closedAt || game.deletedAt) continue;
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
