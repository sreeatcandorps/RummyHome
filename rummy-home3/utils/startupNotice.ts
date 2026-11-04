/** One-shot message carried from a failed cold start onto the login screen. */
let notice: string | null = null;

export function setStartupNotice(message: string) {
  notice = message;
}

export function takeStartupNotice() {
  const current = notice;
  notice = null;
  return current;
}
