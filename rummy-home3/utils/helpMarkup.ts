/**
 * Help copy markup, one line each:
 *   "## Heading"   a small section heading
 *   "• text"       a bullet
 * Inside a line, [Active] [Completed] [Closed] [Results] become coloured pills.
 */
export const HELP_CHIPS = ['Active', 'Completed', 'Closed', 'Results'] as const;
export type HelpChip = (typeof HELP_CHIPS)[number];
export type HelpPart = { kind: 'text'; text: string } | { kind: 'chip'; chip: HelpChip };

const CHIP_RE = /\[(Active|Completed|Closed|Results)\]/g;

export const isHelpHeading = (line: string) => line.startsWith('## ');
export const helpHeadingText = (line: string) => line.slice(3).trim();

export function splitHelpLine(line: string): HelpPart[] {
  const parts: HelpPart[] = [];
  let last = 0;
  for (const match of line.matchAll(CHIP_RE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: 'text', text: line.slice(last, index) });
    parts.push({ kind: 'chip', chip: match[1] as HelpChip });
    last = index + match[0].length;
  }
  if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) });
  return parts;
}

/** Headings and bullets of one help screen, in order. */
export function helpOutline(text: string): { headings: string[]; bullets: string[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    headings: lines.filter(isHelpHeading).map(helpHeadingText),
    bullets: lines.filter((l) => l.startsWith('•')).map((l) => l.slice(1).trim()),
  };
}
