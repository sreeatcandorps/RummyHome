import { AwardNote } from '@/types/game';
import { PoolStanding, dropsLeft } from '@/utils/pool';

/**
 * Awards for a Completed pool (D8, D9). The pool is worth one entry per entry made (a re-entry
 * counts twice); the presets decide who GETS how much of it; a player's award is what they get
 * minus what they put in, so a full pool's awards add to 0. Nothing here is money (D9/D12):
 * entries, pool and awards are points.
 */

export type AwardPreset = 'winner' | 'left' | 'split' | 'drops' | 'custom';

export const AWARD_PRESETS: { key: AwardPreset; label: string; hint: string }[] = [
  { key: 'winner', label: 'Winner takes all', hint: 'The lowest score still in gets the whole pool.' },
  { key: 'left', label: 'By points left', hint: 'Players still in share the pool in proportion to the points they have left.' },
  { key: 'split', label: '50 / 50', hint: 'The two lowest scores still in split the pool evenly.' },
  { key: 'drops', label: 'Entry per drop left', hint: 'Each player still in gets one entry per drop they have left; the winner gets the rest.' },
  { key: 'custom', label: 'Custom', hint: 'Type what each player gets.' },
];

export const presetLabel = (preset: AwardPreset) => AWARD_PRESETS.find((p) => p.key === preset)?.label ?? 'Custom';

export type AwardRow = {
  playerId: string;
  total: number;
  out: boolean;
  entries: number;
  /** What the player gets from the pool. */
  gets: number;
  /** gets − entries × entry. What the pool contributes to Results for this player. */
  award: number;
};

export type AwardSheet = {
  preset: AwardPreset;
  entry: number;
  poolTotal: number;
  givenOut: number;
  rows: AwardRow[];
};

type Inputs = {
  standings: PoolStanding[];
  entry: number;
  limit: number;
  drop: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The winner(s): the lowest score among players still in; everyone when nobody is in (ties share, F13.6). */
export function winnersOf(standings: PoolStanding[]): string[] {
  const inRows = standings.filter((s) => !s.out);
  const pool = inRows.length ? inRows : standings;
  if (!pool.length) return [];
  const best = Math.min(...pool.map((s) => s.total));
  return pool.filter((s) => s.total === best).map((s) => s.playerId);
}

/** Splits `amount` across `ids` in whole points; the remainder goes to the first id. */
export function splitEvenly(amount: number, ids: string[]): Record<string, number> {
  if (!ids.length) return {};
  const each = Math.floor(amount / ids.length);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => { out[id] = each + (i === 0 ? amount - each * ids.length : 0); });
  return out;
}

/** What each player gets under a preset. Custom returns the previous `gets` untouched. */
export function presetGets(preset: AwardPreset, { standings, entry, limit, drop }: Inputs, previous: Record<string, number> = {}): Record<string, number> {
  const poolTotal = entry * sum(standings.map((s) => s.entries));
  const inRows = standings.filter((s) => !s.out);
  const winners = winnersOf(standings);
  const zero: Record<string, number> = Object.fromEntries(standings.map((s) => [s.playerId, 0]));

  if (preset === 'custom') return { ...zero, ...previous };

  if (preset === 'winner') return { ...zero, ...splitEvenly(poolTotal, winners) };

  if (preset === 'split') {
    const top = [...inRows].sort((a, b) => a.total - b.total).slice(0, 2).map((s) => s.playerId);
    return { ...zero, ...splitEvenly(poolTotal, top.length ? top : winners) };
  }

  if (preset === 'left') {
    const lefts = inRows.map((s) => ({ id: s.playerId, left: Math.max(0, limit - s.total) }));
    const totalLeft = sum(lefts.map((l) => l.left));
    if (totalLeft === 0) return { ...zero, ...splitEvenly(poolTotal, winners) };
    const gets = { ...zero };
    lefts.forEach((l) => { gets[l.id] = Math.floor((poolTotal * l.left) / totalLeft); });
    // Rounding remainders go to the winner (F13.6).
    const remainder = poolTotal - sum(lefts.map((l) => gets[l.id]));
    if (winners[0]) gets[winners[0]] += remainder;
    return gets;
  }

  // drops: one entry per drop left for every player still in, the winner gets the rest. When the drop
  // entries eat the pool the winner is left with nothing (or less than someone): `presetViability` then
  // marks the preset not viable and the screen refuses it (F13.23).
  const gets = { ...zero };
  inRows.forEach((s) => { if (!winners.includes(s.playerId)) gets[s.playerId] = dropsLeft(s.total, limit, drop) * entry; });
  const others = sum(Object.values(gets));
  const rest = Math.max(0, poolTotal - others);
  Object.assign(gets, splitEvenly(rest, winners));
  return gets;
}

/** The pop-up when a non-viable preset is tapped (F13.23, Sree's wording). */
export const NOT_VIABLE_TEXT = 'This is not ideal for this situation because the winner gets less than the others. Please pick another option.';

export type WinnerCheck = {
  /** Every winner gets strictly more than every non-winner, and nothing negative. */
  ok: boolean;
  /** The non-winner who gets as much as or more than a winner, when there is one. */
  rival: string | null;
  winnerGets: number;
  rivalGets: number;
};

/**
 * F13.23: the lowest score must get the most. Co-winners (tied lowest, F13.6) share equally and are
 * compared as a group; `equals` names players a preset deliberately puts level with the winner
 * (50 / 50's second place), who are compared with ≥ instead of >.
 */
export function winnerGetsMost(gets: Record<string, number>, standings: PoolStanding[], equals: string[] = []): WinnerCheck {
  const winners = winnersOf(standings);
  const winnerGets = winners.length ? Math.min(...winners.map((id) => gets[id] ?? 0)) : 0;
  let rival: string | null = null;
  let rivalGets = 0;
  for (const s of standings) {
    if (winners.includes(s.playerId)) continue;
    const g = gets[s.playerId] ?? 0;
    const beats = equals.includes(s.playerId) ? g > winnerGets : g >= winnerGets;
    if (beats && (rival === null || g > rivalGets)) { rival = s.playerId; rivalGets = g; }
  }
  return { ok: winnerGets >= 0 && rival === null, rival, winnerGets, rivalGets };
}

/** Who a preset deliberately puts level with the winner: 50 / 50's second place; nobody otherwise. */
function levelWithWinner(preset: AwardPreset, standings: PoolStanding[]): string[] {
  if (preset !== 'split') return [];
  const inRows = standings.filter((s) => !s.out);
  const winners = winnersOf(standings);
  return [...inRows].sort((a, b) => a.total - b.total).slice(0, 2).map((s) => s.playerId).filter((id) => !winners.includes(id));
}

/**
 * Which presets may be picked for this pool (F13.23). Winner takes all and By points left always
 * pass (the lowest score has the most points left); 50 / 50 passes with the second place level by
 * design; Entry per drop left fails when the others' drop entries leave the winner less than, or
 * equal to, any of them (or nothing at all). Custom is the admin's own numbers: never blocked, the
 * screen warns instead (`winnerGetsMost` on the typed sheet).
 */
export function presetViability(preset: AwardPreset, inputs: Inputs): WinnerCheck & { viable: boolean } {
  if (preset === 'custom') return { ok: true, viable: true, rival: null, winnerGets: 0, rivalGets: 0 };
  const check = winnerGetsMost(presetGets(preset, inputs), inputs.standings, levelWithWinner(preset, inputs.standings));
  return { ...check, viable: check.ok };
}

export function viablePresets(inputs: Inputs): Record<AwardPreset, boolean> {
  return Object.fromEntries(AWARD_PRESETS.map((p) => [p.key, presetViability(p.key, inputs).viable])) as Record<AwardPreset, boolean>;
}

export function buildAwardSheet(preset: AwardPreset, inputs: Inputs, gets: Record<string, number>): AwardSheet {
  const poolTotal = inputs.entry * sum(inputs.standings.map((s) => s.entries));
  const rows = inputs.standings.map((s) => {
    const g = gets[s.playerId] ?? 0;
    return { playerId: s.playerId, total: s.total, out: s.out, entries: s.entries, gets: g, award: g - s.entries * inputs.entry };
  });
  return { preset, entry: inputs.entry, poolTotal, givenOut: sum(rows.map((r) => r.gets)), rows };
}

/** The line under the table: what was handed out against the pool (D9 wording, never money). */
export function givenOutText(sheet: AwardSheet): { text: string; tone: 'ok' | 'under' | 'over' } {
  const diff = sheet.poolTotal - sheet.givenOut;
  if (diff === 0) return { text: `Pool ${sheet.poolTotal} · all given out`, tone: 'ok' };
  if (diff > 0) return { text: `Pool ${sheet.poolTotal} · ${sheet.givenOut} given out · ${diff} not given out`, tone: 'under' };
  return { text: `Pool ${sheet.poolTotal} · ${sheet.givenOut} given out · ${-diff} more than the pool`, tone: 'over' };
}

/** The confirm before an unbalanced save (D9). Null when balanced. */
export function saveAnywayText(sheet: AwardSheet): string | null {
  const diff = sheet.poolTotal - sheet.givenOut;
  if (diff === 0) return null;
  if (diff > 0) return `${diff} points weren't given out. Save awards anyway?`;
  return `${-diff} points more than the pool were given out. Save awards anyway?`;
}

/** The awards as the server stores them ({profile id: award}) and the note beside them. */
export function awardsPayload(sheet: AwardSheet): { awards: Record<string, number>; note: AwardNote } {
  return {
    awards: Object.fromEntries(sheet.rows.map((r) => [r.playerId, r.award])),
    note: { preset: sheet.preset, presetLabel: presetLabel(sheet.preset), entry: sheet.entry, poolTotal: sheet.poolTotal, givenOut: sheet.givenOut },
  };
}

/** Rebuild `gets` from saved awards so the Awards screen reopens with the saved numbers (edit). */
export function getsFromAwards(awards: Record<string, number>, standings: PoolStanding[], entry: number): Record<string, number> {
  return Object.fromEntries(standings.map((s) => [s.playerId, (awards[s.playerId] ?? -s.entries * entry) + s.entries * entry]));
}

export const signedPoints = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Whether the sheet still shows the saved awards (design audit Q11.14): on an awarded pool with nothing
 * changed the Awards screen ends with "Add to Results" instead of "Save changes", so the chain
 * Complete → Award → Result is visible from the last step.
 */
export function sameAwards(sheet: AwardSheet, saved: Record<string, number> | null | undefined): boolean {
  if (!saved) return false;
  const current = awardsPayload(sheet).awards;
  const ids = new Set([...Object.keys(current), ...Object.keys(saved)]);
  for (const id of ids) if ((current[id] ?? 0) !== (saved[id] ?? 0)) return false;
  return true;
}
