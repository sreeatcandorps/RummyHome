import { RoundEntryState } from '@/utils/roundEntry';

/**
 * The two Add round confirms of PR 3, worded once here so the screen and the tests agree.
 */

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

/** "The Full count for this game is 80. Keep 120?" */
export function overMaxConfirm(value: number, fullCount: number | null | undefined): string {
  const full = Math.abs(Number(fullCount) || 0);
  return `The Full count for this game is ${full}. Keep ${signed(value)} for this round?`;
}

/**
 * "The others add up to +40, so Zed's Rummy share is -40 to keep the round at 0. Is that right?"
 * Two winners: "… so Priya and R K share -31 (-16 and -15) …".
 */
export function rummyShareConfirm(
  state: RoundEntryState,
  shares: Record<string, number>,
  participants: { id: string; name: string }[],
): string {
  const othersTotal = Object.values(state.entries).reduce((sum, entry) => sum + entry.value, 0);
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? 'the Rummy winner';
  const winners = state.rummyIds;
  const first = (name: string) => name.split(/\s+/)[0];
  const others = othersTotal === 0 ? 'add up to 0' : `add up to ${signed(othersTotal)}`;
  if (winners.length <= 1) {
    const id = winners[0];
    const share = id ? shares[id] ?? 0 : 0;
    const who = id ? `${first(nameOf(id))}'s Rummy share` : 'the Rummy share';
    return `The others ${others}, so ${who} is ${share === 0 ? '0' : signed(share)} to keep the round at 0. Is that right?`;
  }
  const names = winners.map((id) => first(nameOf(id)));
  const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const total = winners.reduce((sum, id) => sum + (shares[id] ?? 0), 0);
  const pieces = winners.map((id) => signed(shares[id] ?? 0)).join(' and ');
  return `The others ${others}, so ${list} share ${total === 0 ? '0' : signed(total)} (${pieces}) to keep the round at 0. Is that right?`;
}
