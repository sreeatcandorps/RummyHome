/** Today follows the phone's local calendar date. */
export function isLocalToday(value: string, now = new Date()): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

/** Rolling 24-hour window from now. Games that cross midnight still show. */
export function isWithinLast24Hours(value: string, now = new Date()): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
  return date.getTime() >= twentyFourHoursAgo && date.getTime() <= now.getTime();
}
