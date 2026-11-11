import { initialsById } from '@/utils/playerInitials';
import { formatPoints, placeLabel, podiumPlaces, resultsCountLine, ResultStanding } from '@/utils/results';
import { buildShareBreakdown, ShareBreakdown, shareBreakdownOmitted, SHARE_BREAKDOWN_OMITTED, SheetLikeGame } from '@/utils/resultsLayout';
import { totalsSubline } from '@/utils/resultsSave';

/** Long lists keep the leaders and say how many names were left off the image. */
export const SHARE_CARD_LINE_CAP = 12;

export type ShareCardLine = {
  name: string;
  points: string;
  /** 1, 2, or 3 puts a crown and the place beside the row. */
  place?: number;
  /** Second line under the name: initials and Player ID ("SK · #39"). */
  sub?: string;
};

export type ShareCardPlace = {
  label: string;
  names: string;
  points: string;
};

export type ShareCard = {
  brand: 'EZ Score: Rummy';
  title: string;
  date: string;
  lines: ShareCardLine[];
  moreCount: number;
  places: ShareCardPlace[];
  /** Results image leads with 1st, 2nd, and 3rd, then a short totals list. */
  podiumFirst?: boolean;
  /** e.g. "3 games · 6 players" under the date. */
  summary?: string;
  /** Results image: how each game adds up to the total. Null when there are too many games. */
  breakdown?: ShareBreakdown | null;
  /** Shown under the breakdown when the rounds are only in the PDF. */
  breakdownNote?: string;
  /** Last line: "Result ID · ABC123" on saved results, "Preview · not saved" before. */
  footer?: string;
};

/** The results picture stays short: the podium, then the leading totals. */
export const RESULTS_IMAGE_TOTAL_CAP = 6;

export function sharePlaces(standings: ResultStanding[]): { label: string; names: string; points: number }[] {
  return podiumPlaces(standings).map((group) => ({
    label: placeLabel(group[0].place),
    names: group.map((row) => row.name).join(', '),
    points: group[0].points,
  }));
}

/** Highest totals first. The image names Rummy Home, the title, the date, and these lines. */
export function buildShareCard(input: {
  title: string;
  date: string;
  rows: { name: string; points: number }[];
  places?: { label: string; names: string; points: number }[];
}): ShareCard {
  const sorted = [...input.rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const shown = sorted.slice(0, SHARE_CARD_LINE_CAP);
  return {
    brand: 'EZ Score: Rummy',
    title: input.title,
    date: input.date,
    lines: shown.map((row) => ({ name: row.name, points: formatPoints(row.points) })),
    moreCount: Math.max(0, sorted.length - shown.length),
    places: (input.places ?? []).map((place) => ({
      label: place.label,
      names: place.names,
      points: formatPoints(place.points),
    })),
  };
}

/**
 * The results picture: header, every total highest first with a crown on the top three
 * places, then (for up to SHARE_BREAKDOWN_MAX_GAMES games) the per-game grid.
 */
export function buildResultsShareCard(input: {
  title: string;
  date: string;
  rows: { id?: string; name: string; points: number; place?: number }[];
  places?: { label: string; names: string; points: number }[];
  gameCount?: number;
  games?: SheetLikeGame[];
  /** Seats with Player IDs, for the second line under each name. */
  players?: { id: string; name: string; playerNo?: number | null }[];
  footer?: string;
}): ShareCard {
  const sorted = [...input.rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const gameCount = input.gameCount ?? input.games?.length;
  const seated = input.rows.filter((row): row is typeof row & { id: string } => typeof row.id === 'string');
  const initials = initialsById(seated.map((row) => ({ id: row.id, name: row.name })));
  const byId = new Map((input.players ?? []).map((player) => [player.id, player]));
  const subFor = (row: { id?: string }) => {
    if (!row.id) return undefined;
    const sub = totalsSubline(initials.get(row.id), byId.get(row.id));
    return sub || undefined;
  };
  const breakdown = input.games && seated.length === input.rows.length
    ? buildShareBreakdown({
      players: seated.map((row) => ({ id: row.id, name: row.name })),
      games: input.games,
      totals: Object.fromEntries(seated.map((row) => [row.id, row.points])),
    })
    : null;
  return {
    ...buildShareCard({ ...input, rows: input.rows }),
    podiumFirst: false,
    summary: gameCount != null ? resultsCountLine(gameCount, input.rows.length) : undefined,
    lines: sorted.map((row) => ({
      name: row.name,
      points: formatPoints(row.points),
      place: row.place != null && row.place <= 3 ? row.place : undefined,
      sub: subFor(row),
    })),
    moreCount: 0,
    // The crowns beside the rows replace the 1st/2nd/3rd paragraph.
    places: [],
    breakdown,
    breakdownNote: gameCount != null && shareBreakdownOmitted(gameCount) ? SHARE_BREAKDOWN_OMITTED : undefined,
    footer: input.footer,
  };
}
