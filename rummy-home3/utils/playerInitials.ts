const EXPENSE_LABEL = 'EXP';

type NameParts = {
  words: string[];
  numericLast: boolean;
};

function partsFor(name: string): NameParts {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const last = words.length > 1 ? words[words.length - 1] : '';
  return { words, numericLast: /^\d+$/.test(last) };
}

/** First initial plus last initial. A numeric last name stays whole so Player 1 and Player 10 differ. */
function initialsFor(name: string): string {
  const clean = (name ?? '').trim();
  if (!clean) return '?';
  if (clean.toLowerCase() === 'expenses') return EXPENSE_LABEL;

  const { words, numericLast } = partsFor(clean);
  const first = words[0]?.[0] ?? '';
  const lastWord = words.length > 1 ? words[words.length - 1] : '';
  const last = numericLast ? lastWord : lastWord.slice(0, 1);
  return `${first}${last}`.toUpperCase() || '?';
}

/**
 * Extra letter from the first name when two players would otherwise share a
 * header (Sam Kumar / Sunil Kohli → SaK / SuK).
 */
function expandedInitials(name: string): string {
  const clean = (name ?? '').trim();
  if (!clean) return '?';
  if (clean.toLowerCase() === 'expenses') return EXPENSE_LABEL;

  const { words, numericLast } = partsFor(clean);
  if (words.length === 0) return '?';
  if (numericLast) return initialsFor(clean);

  const first = words[0].slice(0, Math.min(2, words[0].length));
  const lastWord = words.length > 1 ? words[words.length - 1] : '';
  const last = lastWord.slice(0, 1);
  return `${first}${last}`.toUpperCase() || initialsFor(clean);
}

function countLabels(labels: string[]): Record<string, number> {
  return labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
}

function numberDuplicates(labels: string[]): string[] {
  const totals = countLabels(labels);
  const used: Record<string, number> = {};

  return labels.map((label) => {
    if ((totals[label] ?? 0) < 2) return label;
    const nth = (used[label] ?? 0) + 1;
    used[label] = nth;
    if (nth === 1) return label;
    // "P12" would look like Player 12, so numbered numeric labels get a dash.
    const dash = /\d$/.test(label);
    return dash ? `${label}-${nth}` : `${label}${nth}`;
  });
}

/**
 * Labels every player in a game. Identical initials grow by one letter before
 * a number is added, so two different people are not both shown as SK1 / SK2.
 */
export function buildPlayerInitials(names: string[]): string[] {
  const base = names.map(initialsFor);
  const totals = countLabels(base);

  const expanded = names.map((name, index) => {
    const label = base[index];
    if ((totals[label] ?? 0) < 2 || label === EXPENSE_LABEL) return label;
    return expandedInitials(name);
  });

  return numberDuplicates(expanded);
}
