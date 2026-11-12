/**
 * Labels for one context (a result sheet, a share image, an older game whose seats
 * carry no stored label). Display only; nothing here is saved.
 *
 * Rule (Nov 11): first initial + last initial. When two or more players in the same
 * context share a label, the first keeps it and the others get a three-letter form
 * of their own name (Suresh Kumar → SUK) — never a number unless every letter form
 * is taken. "First" is the order given: seat order in a game, first appearance
 * across the games in a result. Stored labels (My players / game seats) take
 * precedence when the caller passes them; see utils/initials.ts.
 */

import { assignInitials, defaultInitials } from '@/utils/initials';

/** HY for Harish Yadav, RA for a single word Ravi. Always 2 characters. */
export function baseInitials(name: string): string {
  return defaultInitials(name);
}

export function buildPlayerInitials(names: string[]): string[] {
  const labels = assignInitials(names.map((name, index) => ({ id: String(index), name, addedAt: String(index).padStart(4, '0') })));
  return names.map((_, index) => labels.get(String(index)) ?? '?');
}

/**
 * Same labels keyed by player id, so sorted views can look them up after reordering.
 * A player with a stored seat `label` (022) keeps it; the others are derived around it.
 */
export function initialsById<T extends { id: string; name: string; label?: string | null }>(players: T[]): Map<string, string> {
  return assignInitials(players.map((player, index) => ({ id: player.id, name: player.name, initials: player.label, addedAt: String(index).padStart(4, '0') })));
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
