/**
 * The game and result log (migration 036). Rows are written on the server; the app only
 * formats them: time under a day header, bold names (details.names), a was→now table for an
 * edited round, a coloured dot by kind, and the one-line "Changed after sharing" note that the
 * result page, the share image, the PDF and the /r/ page all print the same way.
 */
import { isLocalToday } from '@/utils/localDay';

export type LogLevel = 'important' | 'routine';

export type LogEntry = {
  id: number;
  at: string;
  kind: string;
  level: LogLevel;
  actorId: string | null;
  actorName: string;
  summary: string;
  details: Record<string, unknown>;
  gameId: string | null;
  resultId: string | null;
};

export type ChangedNote = { summary: string; actorName: string; at: string; count?: number } | null;

export type ResultHistory = {
  rows: LogEntry[];
  versions: { version: number; note: string; savedAt: string }[];
  changedNote: ChangedNote;
};

export type LogFilter = 'all' | 'important';

export const LOG_PAGE_SIZE = 50;

export const LOG_HELP =
  'Every change to this game, written by the server. Nobody can edit or remove entries. Hide game is personal and not listed.';

/** Short chip text per kind. */
export const KIND_LABELS: Record<string, string> = {
  game_created: 'Created',
  player_added: 'Player added',
  player_removed: 'Player removed',
  viewer_added: 'View-only added',
  viewer_removed: 'View-only removed',
  admin_added: 'Admin',
  admin_removed: 'Admin removed',
  round_added: 'Round added',
  round_edited: 'Round edited',
  round_undone: 'Round undone',
  settings_changed: 'Settings',
  initials_changed: 'Initials',
  player_renamed: 'Renamed',
  completed: 'Completed',
  reopened: 'Reopened',
  closed: 'Closed',
  unclosed: 'Back to Completed',
  deleted: 'Deleted',
  restored: 'Restored',
  result_saved: 'Saved',
  result_deleted: 'Deleted',
  result_restored: 'Restored',
  result_changed: 'Changed',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}

/**
 * Dot colour key (D12): red = something was taken away, amber = edited, blue = people,
 * green = created / completed / closed / reopened / restored, grey = routine.
 */
export type DotTone = 'red' | 'amber' | 'blue' | 'green' | 'grey';

export function dotTone(entry: Pick<LogEntry, 'kind' | 'level'>): DotTone {
  if (entry.level === 'routine') return 'grey';
  switch (entry.kind) {
    case 'player_removed':
    case 'round_undone':
    case 'deleted':
    case 'result_deleted':
    case 'unclosed':
      return 'red';
    case 'round_edited':
    case 'settings_changed':
    case 'result_changed':
      return 'amber';
    case 'player_added':
    case 'admin_added':
    case 'admin_removed':
    case 'viewer_added':
    case 'viewer_removed':
      return 'blue';
    default:
      return 'green';
  }
}

export const DOT_COLORS: Record<DotTone, string> = {
  red: '#A8201A',
  amber: '#B8860B',
  blue: '#2F6FB2',
  green: '#1F7A4C',
  grey: '#9A9D95',
};

/** "10:31 PM" */
export function formatLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Yesterday" or "Wed, Nov 12" */
export function formatLogDay(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (isLocalToday(value, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Nov 13, 10:31 PM" — absolute, for the result History (it spans days). */
export function formatLogWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${formatLogTime(value)}`;
}

export type LogDayGroup = { day: string; key: string; entries: LogEntry[] };

/** Newest first, grouped under day headers in the order the rows arrive. */
export function groupByDay(entries: LogEntry[], now: Date = new Date()): LogDayGroup[] {
  const groups: LogDayGroup[] = [];
  entries.forEach((entry) => {
    const key = new Date(entry.at).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ day: formatLogDay(entry.at, now), key, entries: [entry] });
  });
  return groups;
}

export type SummarySpan = { text: string; bold: boolean };

/** Split the summary so every name in details.names can be shown bold. */
export function summarySpans(summary: string, names: unknown): SummarySpan[] {
  const list = Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string' && n.length > 0) : [];
  if (list.length === 0) return [{ text: summary, bold: false }];
  const escaped = [...new Set(list)].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g');
  return summary
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, bold: list.includes(part) }));
}

export type EditChange = { name: string; ini: string | null; old: number | null; next: number | null };

/** The was→now rows of a round_edited entry. */
export function editChanges(entry: Pick<LogEntry, 'kind' | 'details'>): EditChange[] {
  if (entry.kind !== 'round_edited') return [];
  const changes = (entry.details as { changes?: unknown }).changes;
  if (!Array.isArray(changes)) return [];
  return changes.map((change) => {
    const c = change as { name?: string; ini?: string | null; old?: number | null; new?: number | null };
    return { name: c.name ?? 'Player', ini: c.ini ?? null, old: c.old ?? null, next: c.new ?? null };
  });
}

/** "+120", "-30", "0", "—" */
export function scoreText(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value > 0) return `+${value}`;
  return String(value);
}

/** Default filter: All while the game is still being played, Important once it is done. */
export function defaultLogFilter(game: { isComplete?: boolean; closedAt?: string | null } | null | undefined): LogFilter {
  if (!game) return 'all';
  return game.isComplete || game.closedAt ? 'important' : 'all';
}

export const CHANGED_AFTER_SHARING = 'Changed after sharing';

/**
 * The one line every shared surface prints when a result changed after it was saved (D11:
 * Share is only offered once a result is saved, so "after sharing" is measured from the save).
 */
export function changedNoteLine(note: ChangedNote): string | null {
  if (!note || !note.summary) return null;
  const more = note.count && note.count > 1 ? ` (+${note.count - 1} earlier)` : '';
  const who = note.actorName ? ` · ${note.actorName}` : '';
  const when = note.at ? ` · ${formatLogWhen(note.at)}` : '';
  return `${CHANGED_AFTER_SHARING}: ${note.summary}${who}${when}${more}`;
}

/** Only result_* rows belong in the History section (the server already filters; keep the app honest). */
export function historyRows(rows: LogEntry[]): LogEntry[] {
  return rows.filter((row) => row.kind.startsWith('result_'));
}

export function parseLogEntry(raw: unknown): LogEntry {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    at: String(r.at ?? ''),
    kind: String(r.kind ?? ''),
    level: r.level === 'routine' ? 'routine' : 'important',
    actorId: typeof r.actorId === 'string' ? r.actorId : null,
    actorName: typeof r.actorName === 'string' ? r.actorName : 'System',
    summary: String(r.summary ?? ''),
    details: (r.details && typeof r.details === 'object' ? r.details : {}) as Record<string, unknown>,
    gameId: typeof r.gameId === 'string' ? r.gameId : null,
    resultId: typeof r.resultId === 'string' ? r.resultId : null,
  };
}
