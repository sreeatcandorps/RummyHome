/**
 * Help copy markup, one line each:
 *   "## Heading"   a small section heading
 *   "• text"       a bullet
 * Inside a line:
 *   [Active] [Completed] [Closed] [Results] [View only] [Unregistered] [Pending registration]
 *   [Awards pending] [OUT] [Re-entered]      → the real tag, as a pill
 *   **Save round**                            → bold, a label exactly as it reads on screen
 *   [[Save round]]                            → a small button specimen
 *   <<-80>>                                   → a score-cell specimen
 */
export const HELP_CHIPS = [
  'Active',
  'Completed',
  'Closed',
  'Results',
  'View only',
  'Unregistered',
  'Pending registration',
  'Awards pending',
  'OUT',
  'Re-entered',
] as const;
export type HelpChip = (typeof HELP_CHIPS)[number];
export type HelpPart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'chip'; chip: HelpChip }
  | { kind: 'button'; text: string }
  | { kind: 'cell'; text: string };

const TOKEN_RE = new RegExp(
  `\\[\\[([^\\]]+)\\]\\]|<<([^>]+)>>|\\*\\*([^*]+)\\*\\*|\\[(${HELP_CHIPS.join('|')})\\]`,
  'g',
);

export const isHelpHeading = (line: string) => line.startsWith('## ');
export const helpHeadingText = (line: string) => line.slice(3).trim();

export function splitHelpLine(line: string): HelpPart[] {
  const parts: HelpPart[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: 'text', text: line.slice(last, index) });
    if (match[1] !== undefined) parts.push({ kind: 'button', text: match[1] });
    else if (match[2] !== undefined) parts.push({ kind: 'cell', text: match[2] });
    else if (match[3] !== undefined) parts.push({ kind: 'bold', text: match[3] });
    else parts.push({ kind: 'chip', chip: match[4] as HelpChip });
    last = index + match[0].length;
  }
  if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) });
  return parts;
}

/** The line with every markup token reduced to its plain words. */
export function plainHelpText(line: string): string {
  return splitHelpLine(line)
    .map((p) => (p.kind === 'chip' ? p.chip : p.text))
    .join('');
}

/** Headings and bullets of one help screen, in order. */
export function helpOutline(text: string): { headings: string[]; bullets: string[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    headings: lines.filter(isHelpHeading).map(helpHeadingText),
    bullets: lines.filter((l) => l.startsWith('•')).map((l) => l.slice(1).trim()),
  };
}
