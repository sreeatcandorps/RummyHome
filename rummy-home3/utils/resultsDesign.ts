import { firstAppearanceOrder, initialsById, baseInitials } from '@/utils/playerInitials';
import { playerIdBadge } from '@/utils/gamePlayers';
import { formatPoints, ResultStanding, sheetGameLabel } from '@/utils/results';
import { SITE_BASE_URL } from '@/utils/siteUrls';

/**
 * The results design (Nov 13, approved): one model for the app screen, the share image,
 * the PDF and the /r/ web page, so the four read the same.
 *
 * 1. Scores: positives left, negatives right. Only positive totals are ranked; ties share
 *    a rank (two silvers, no bronze); the top three carry a medal badge (1, 2, 3 in a
 *    gold / silver / bronze circle, never an emoji). Negatives read closest to zero first,
 *    so one ranked order runs through the whole page. Zero totals are an "Even" line.
 * 2. How you got there: players down, games across in bands of five. Every band — in the
 *    header and in every row — is one bordered box of five cells, so with seven games the
 *    same two-box shape repeats down the page. Player and Total sit on the LEFT.
 * 3. Legend under the table, in row order.
 * 4. Games in this result: label, **start time** date, players · rounds, Game ID (italic,
 *    last), creator and admins.
 */

/** Games per band: five, the most a phone shows beside Player and Total. */
export const BAND_SIZE = 5;
/** The share image keeps the first eight per column and says how many it left off. */
export const SHARE_SIDE_CAP = 8;

export type Medal = 1 | 2 | 3;

export type RankedRow = {
  id: string;
  name: string;
  points: number;
  /** "+970" / "-30" */
  text: string;
  /** Gold / silver / bronze, only on positive totals. */
  medal?: Medal;
  initials: string;
  playerNo?: number | null;
  /** "#8 · RK" — Player ID first, then column initials; either may be missing. */
  sub: string;
};

export type RankedScores = {
  positive: RankedRow[];
  negative: RankedRow[];
  even: RankedRow[];
  /** Ids in page order: positives ranked, then even, then negatives closest to zero first. */
  order: string[];
};

export type DesignPlayer = { id: string; name: string; playerNo?: number | null; label?: string | null };

/** "#8 · RK": the second line under every name, on every surface. */
export function playerSubline(initials: string | undefined, player: { playerNo?: number | null; playerCode?: string } | undefined): string {
  const id = player ? playerIdBadge(player) : null;
  return [id, initials].filter(Boolean).join(' · ');
}

function compareRanked(a: { points: number; name: string; id: string }, b: { points: number; name: string; id: string }): number {
  return b.points - a.points || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/** Competition rank among the positive totals only (1, 2, 2, 4); medals go to ranks 1–3. */
export function medalsFor(positive: { id: string; points: number }[]): Map<string, Medal> {
  const medals = new Map<string, Medal>();
  let rank = 0;
  let last: number | null = null;
  positive.forEach((row, index) => {
    if (last === null || row.points !== last) {
      rank = index + 1;
      last = row.points;
    }
    if (rank <= 3) medals.set(row.id, rank as Medal);
  });
  return medals;
}

/** Column initials for the result: stored seat labels first, then derived in first-appearance order. */
export function resultInitials(players: DesignPlayer[], games: { scores: Record<string, unknown> }[]): Map<string, string> {
  return initialsById(firstAppearanceOrder(players, games));
}

export function rankScores(standings: ResultStanding[], players: DesignPlayer[], labels: Map<string, string>): RankedScores {
  const byId = new Map(players.map((player) => [player.id, player]));
  const row = (standing: ResultStanding, medal?: Medal): RankedRow => {
    const player = byId.get(standing.id);
    const initials = labels.get(standing.id) ?? baseInitials(standing.name);
    return {
      id: standing.id,
      name: standing.name,
      points: standing.points,
      text: formatPoints(standing.points),
      ...(medal ? { medal } : {}),
      initials,
      playerNo: player?.playerNo ?? null,
      sub: playerSubline(initials, player),
    };
  };
  const positiveStandings = standings.filter((item) => item.points > 0).sort(compareRanked);
  const medals = medalsFor(positiveStandings);
  const positive = positiveStandings.map((item) => row(item, medals.get(item.id)));
  const even = standings.filter((item) => item.points === 0).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map((item) => row(item));
  const negative = standings.filter((item) => item.points < 0).sort(compareRanked).map((item) => row(item));
  return { positive, negative, even, order: [...positive, ...even, ...negative].map((item) => item.id) };
}

/** "Even: Sree, Harish" — first names of the players who ended on zero; null when nobody did. */
export function evenLine(even: { name: string }[]): string | null {
  if (even.length === 0) return null;
  return `Even: ${even.map((row) => row.name.trim().split(/\s+/)[0] || row.name).join(', ')}`;
}

export type BandCellTone = 'win' | 'neg' | 'plain' | 'dash' | 'blank';
export type BandCell = { text: string; tone: BandCellTone };

export type BandTableRow = {
  id: string;
  name: string;
  initials: string;
  playerNo?: number | null;
  total: string;
  totalTone: 'pos' | 'neg' | 'zero';
  /** One array of BAND_SIZE cells per band, padded with blanks like the header. */
  bands: BandCell[][];
};

export type BandTable = {
  /** One array of BAND_SIZE labels per band, padded with '' so the boxes match. */
  header: string[][];
  /** Start time under each label, same shape as header; '' when unknown. */
  headerTimes: string[][];
  rows: BandTableRow[];
  bandCount: number;
  gameCount: number;
};

export type DesignGame = {
  id: string;
  name: string;
  label?: string | null;
  date?: string;
  scores: Record<string, number>;
};

export function bandRangesOf(count: number, size = BAND_SIZE): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (let start = 0; start < count; start += size) ranges.push({ start, end: Math.min(count, start + size) });
  return ranges;
}

export function cellFor(game: { scores: Record<string, number> }, playerId: string): BandCell {
  if (!Object.prototype.hasOwnProperty.call(game.scores, playerId)) return { text: '—', tone: 'dash' };
  const value = game.scores[playerId];
  return { text: formatPoints(value), tone: value > 0 ? 'win' : value < 0 ? 'neg' : 'plain' };
}

/** Short clock for the band header: "7:45 PM". */
export function clockOf(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hour = date.getHours() % 12 || 12;
  return `${hour}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
}

/**
 * The combined table. Rows follow `order` (the ranked page order); every band is padded to
 * BAND_SIZE so the bordered boxes in the header and in each row are the same shape.
 */
export function buildBandTable(input: {
  games: DesignGame[];
  players: DesignPlayer[];
  totals: Record<string, number>;
  labels: Map<string, string>;
  order?: string[];
}): BandTable {
  const byId = new Map(input.players.map((player) => [player.id, player]));
  const order = input.order ?? input.players.map((player) => player.id);
  const ranges = bandRangesOf(input.games.length);
  const pad = <T,>(items: T[], blank: T): T[] => [...items, ...Array.from({ length: BAND_SIZE - items.length }, () => blank)];
  const header = ranges.map(({ start, end }) => pad(input.games.slice(start, end).map((game) => sheetGameLabel({ label: game.label, name: game.name })), ''));
  const headerTimes = ranges.map(({ start, end }) => pad(input.games.slice(start, end).map((game) => clockOf(game.date)), ''));
  const rows: BandTableRow[] = order.map((id) => {
    const player = byId.get(id);
    const name = player?.name ?? 'Player';
    const total = input.totals[id] ?? 0;
    return {
      id,
      name,
      initials: input.labels.get(id) ?? baseInitials(name),
      playerNo: player?.playerNo ?? null,
      total: formatPoints(total),
      totalTone: total > 0 ? 'pos' : total < 0 ? 'neg' : 'zero',
      bands: ranges.map(({ start, end }) => pad(input.games.slice(start, end).map((game) => cellFor(game, id)), { text: '', tone: 'blank' } as BandCell)),
    };
  });
  return { header, headerTimes, rows, bandCount: ranges.length, gameCount: input.games.length };
}

export type LegendEntry = { initials: string; playerNo?: number | null; name: string };

/** "RK #8 Ravi Kumar", in table row order. */
export function legendOf(rows: { initials: string; playerNo?: number | null; name: string }[]): LegendEntry[] {
  return rows.map((row) => ({ initials: row.initials, playerNo: row.playerNo ?? null, name: row.name }));
}

export function legendText(entry: LegendEntry): string {
  return [entry.initials, entry.playerNo != null ? `#${entry.playerNo}` : null, entry.name].filter(Boolean).join(' ');
}

/** "7:45 PM" and "Thursday, November 5" (with the year when it is not this year). */
export function startParts(iso: string | undefined, now: Date = new Date()): { time: string; date: string } {
  if (!iso) return { time: '', date: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { time: '', date: '' };
  const sameYear = date.getFullYear() === now.getFullYear();
  const day = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  return { time: clockOf(iso), date: day };
}

export type GameInfo = {
  id: string;
  /** "S12" — the game's own label; the short code when a result predates labels. */
  label: string;
  /** Share code or id tail. */
  code: string;
  playerCount: number;
  roundCount?: number;
  creator?: string;
  admins?: string[];
  start: { time: string; date: string };
  reused?: boolean;
};

export type GameMeta = {
  rounds?: Record<string, number[]>;
  roundCount?: number;
  creatorName?: string | null;
  adminNames?: string[];
  reused?: boolean;
};

/** "9 players · 11 rounds · Game ID E3AC94" without the id (the id is rendered in italics by the surface). */
export function gameCountsLine(info: GameInfo): string {
  const players = info.playerCount === 1 ? '1 player' : `${info.playerCount} players`;
  if (info.roundCount == null) return players;
  return `${players} · ${info.roundCount === 1 ? '1 round' : `${info.roundCount} rounds`}`;
}

/** "Creator Sree Koneru · Admins Harish Gadupudi, Zed Zero"; null when nothing is known. */
export function gamePeopleLine(info: GameInfo): string | null {
  const parts: string[] = [];
  if (info.creator) parts.push(`Creator ${info.creator}`);
  const admins = (info.admins ?? []).filter((name) => name !== info.creator);
  if (admins.length > 0) parts.push(`Admins ${admins.join(', ')}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function roundCountOf(rounds: Record<string, number[]> | undefined): number | undefined {
  if (!rounds) return undefined;
  return Object.values(rounds).reduce((max, column) => Math.max(max, column.length), 0);
}

export function gamesInResult(games: (DesignGame & GameMeta)[], now: Date = new Date()): GameInfo[] {
  return games.map((game) => ({
    id: game.id,
    label: sheetGameLabel({ label: game.label, name: game.name }),
    code: game.name,
    playerCount: Object.keys(game.scores).filter((id) => id !== 'EX').length,
    roundCount: game.roundCount ?? roundCountOf(game.rounds),
    ...(game.creatorName ? { creator: game.creatorName } : {}),
    ...(game.adminNames?.length ? { admins: game.adminNames } : {}),
    start: startParts(game.date, now),
    ...(game.reused ? { reused: true } : {}),
  }));
}

/** Public, read-only copy of a saved result. */
export function resultPageUrl(resultId: string): string {
  return `${SITE_BASE_URL}/r/${resultId}`;
}

/** The link as printed on images and PDFs: no scheme, so it fits one line. */
export function resultLinkText(resultId: string): string {
  return resultPageUrl(resultId).replace(/^https?:\/\//, '');
}

/** "Games S12, S13, S14 · saved Fri, Nov 13 · 9:58 PM" for the bottom of the share image. */
export function gamesLine(labels: string[], dateWord: 'saved' | 'shown', when: string): string {
  const list = labels.length === 0 ? 'No games' : labels.length === 1 ? `Game ${labels[0]}` : `Games ${labels.join(', ')}`;
  return `${list} · ${dateWord} ${when}`;
}

/** Initials of the person who generated the share, from their display name. */
export function generatedByLine(name: string | null | undefined): string | null {
  const clean = name?.trim();
  if (!clean) return null;
  return `Generated by ${baseInitials(clean)}`;
}

export type CappedSplit = {
  positive: RankedRow[];
  negative: RankedRow[];
  /** Names left off both columns together. */
  moreCount: number;
};

/** The share image keeps the first SHARE_SIDE_CAP of each column; the page behind the link has everyone. */
export function capSplit(ranked: RankedScores, cap = SHARE_SIDE_CAP): CappedSplit {
  const positive = ranked.positive.slice(0, cap);
  const negative = ranked.negative.slice(0, cap);
  return {
    positive,
    negative,
    moreCount: ranked.positive.length - positive.length + ranked.negative.length - negative.length,
  };
}

export function moreLine(moreCount: number, hasLink: boolean): string | null {
  if (moreCount <= 0) return null;
  return `and ${moreCount} more${hasLink ? ' · full list in the link below' : ''}`;
}
