/**
 * Names replace avatars: the first letter of the first name and the first
 * letter of the last name are shown bold, so "HG" still jumps out of
 * "Harish Gadupudi" without a coloured circle.
 */
export type NameSegment = { text: string; bold: boolean };

export function nameSegments(name: string): NameSegment[] {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/);
  const boldAt = new Set<number>([0, words.length - 1]);
  const segments: NameSegment[] = [];
  words.forEach((word, index) => {
    if (index > 0) segments.push({ text: ' ', bold: false });
    if (boldAt.has(index)) {
      segments.push({ text: word.slice(0, 1), bold: true });
      if (word.length > 1) segments.push({ text: word.slice(1), bold: false });
    } else {
      segments.push({ text: word, bold: false });
    }
  });
  return segments;
}
