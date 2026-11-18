/** Phone numbers are optional and never texted; we only tidy what was typed. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

/** Null when fine, otherwise what to tell the user. Empty clears the number. */
export function phoneProblem(raw: string): string | null {
  const digits = normalizePhone(raw).replace(/^\+/, '');
  if (!digits) return null;
  if (digits.length < 7 || digits.length > 15) return 'Type 7 to 15 digits, or leave it empty.';
  return null;
}
