/**
 * The one date format (design audit A06): "Sat, Nov 14 · 7:49 PM" — weekday, month, day · time; the
 * year only when it is not this year ("Sat, Nov 14, 2025 · 7:49 PM"). Home cards, the Results picker,
 * the Complete header, saved results ("Saved " + this), Games in this result, share images, PDFs, the
 * live page and Log entries all use it. Pure copy so it runs under node.
 */
export function formatWhen(value: string | Date | undefined | null, now: Date = new Date()): string {
  if (!value) return 'Unknown date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return `${formatWhenDay(date, now)} · ${formatWhenTime(date)}`;
}

/** "Sat, Nov 14" (with the year when it is not this year). */
export function formatWhenDay(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "7:49 PM" */
export function formatWhenTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
