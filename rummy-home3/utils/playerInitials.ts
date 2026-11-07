/**
 * Two-character labels for one context (a scorecard, a result, the Add players
 * sheet). They are display only, recomputed every time, and never saved.
 *
 * Rule: first initial + last initial. When two or more players in the same
 * context share a label, the first keeps it and the others become the first
 * initial plus a number (HY, H2, H3 ...). "First" is the order given: seat
 * order in a game, first appearance across the games in a result.
 */

/** HY for Harish Yadav, RA for a single word Ravi, P1 for "Player 1". Always 2 characters when the name allows. */
export function baseInitials(name: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase().padEnd(2, '?');
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function buildPlayerInitials(names: string[]): string[] {
  const base = names.map(baseInitials);
  const taken = new Set(base);
  const seen = new Set<string>();
  return base.map((label) => {
    if (!seen.has(label)) {
      seen.add(label);
      return label;
    }
    const first = label[0] ?? '?';
    let n = 2;
    while (taken.has(`${first}${n}`)) n += 1;
    const next = `${first}${n}`;
    taken.add(next);
    seen.add(next);
    return next;
  });
}

/** Same labels keyed by player id, so sorted views can look them up after reordering. */
export function initialsById<T extends { id: string; name: string }>(players: T[]): Map<string, string> {
  const labels = buildPlayerInitials(players.map((player) => player.name));
  return new Map(players.map((player, index) => [player.id, labels[index]]));
}

/**
 * Players in the order they first appear across the given games (games in the
 * order given, seats in each game's order). Anyone in no game goes last.
 */
export function firstAppearanceOrder<T extends { id: string }>(
  players: T[],
  games: { scores: Record<string, unknown> }[],
): T[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const ordered: T[] = [];
  const placed = new Set<string>();
  games.forEach((game) => {
    Object.keys(game.scores).forEach((id) => {
      const player = byId.get(id);
      if (!player || placed.has(id)) return;
      placed.add(id);
      ordered.push(player);
    });
  });
  players.forEach((player) => {
    if (!placed.has(player.id)) ordered.push(player);
  });
  return ordered;
}
