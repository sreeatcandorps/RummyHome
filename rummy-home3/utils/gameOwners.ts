/** Pure helpers for the scorecard's game-ID footer (no React Native imports, so the unit tests can load it). */
/**
 * The scorecard's bottom-right line under the table: "G12 · Creator Sree · Admins Harish, Cora".
 * Admins are game admins other than the creator (seated or not). Pieces without a value drop out.
 */
export function gameOwnersLine(
  game: { gameNumber?: number | null; createdBy?: string | null },
  members: { id: string; name: string; seatRole?: string | null }[],
  creatorName?: string | null,
): string {
  const creator = creatorName ?? members.find((m) => m.id === game.createdBy)?.name ?? null;
  const admins = members.filter((m) => m.seatRole === 'game_admin' && m.id !== game.createdBy).map((m) => m.name);
  const parts = [
    game.gameNumber != null ? `G${game.gameNumber}` : null,
    creator ? `Creator ${creator}` : null,
    admins.length ? `${admins.length === 1 ? 'Admin' : 'Admins'} ${admins.join(', ')}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}
