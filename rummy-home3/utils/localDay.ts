/** Today follows the phone's local calendar date. */
export function isLocalToday(value: string, now = new Date()): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}
