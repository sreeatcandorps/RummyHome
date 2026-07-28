const EXPENSE_LABEL = 'EXP';

/** First initial of the first name plus first initial of the last name. */
function initialsFor(name: string): string {
  const clean = (name ?? '').trim();
  if (!clean) return '?';
  if (clean.toLowerCase() === 'expenses') return EXPENSE_LABEL;

  const words = clean.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const lastWord = words.length > 1 ? words[words.length - 1] : '';
  // Keep a numeric surname whole so "Player 1" and "Player 10" stay apart.
  const last = /^\d+$/.test(lastWord) ? lastWord : lastWord.slice(0, 1);

  return `${first}${last}`.toUpperCase() || '?';
}

/**
 * Labels every player in a game, numbering duplicates (SK -> SK1, SK2) so two
 * players with the same initials never share a column header.
 */
export function buildPlayerInitials(names: string[]): string[] {
  const labels = names.map(initialsFor);

  const totals = labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const used: Record<string, number> = {};

  return labels.map((label) => {
    if ((totals[label] ?? 0) < 2) return label;

    const nth = (used[label] ?? 0) + 1;
    used[label] = nth;
    return `${label}${nth}`;
  });
}
