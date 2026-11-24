import type { EmailPrefs } from '@/services/emails';

/** The two e-mail switches on Profile (024), with the one-line help each shows in its sheet. */
export const EMAIL_PREF_ROWS: { key: keyof EmailPrefs; title: string; help: string }[] = [
  { key: 'gameStarted', title: 'Game started', help: 'When a game you are in starts, with a link to follow the scores live.' },
  { key: 'results', title: 'Results', help: 'When a result you are in is saved, with a link to the result page.' },
];

/** The Email row's value (Size-S, D66): the switches that are on, or "Off". */
export function emailPrefsSummary(prefs: EmailPrefs): string {
  const on = EMAIL_PREF_ROWS.filter((row) => prefs[row.key]).map((row) => row.title);
  return on.length ? on.join(' · ') : 'Off';
}
