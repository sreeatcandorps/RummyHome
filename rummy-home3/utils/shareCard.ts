import { formatPoints, placeLabel, podiumPlaces, ResultStanding } from '@/utils/results';

/** Long lists keep the leaders and say how many names were left off the image. */
export const SHARE_CARD_LINE_CAP = 12;

export type ShareCardLine = {
  name: string;
  points: string;
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

/** A simple results picture: Rummy Home, the title, the date, the podium, and the top totals. */
export function buildResultsShareCard(input: {
  title: string;
  date: string;
  rows: { name: string; points: number }[];
  places?: { label: string; names: string; points: number }[];
}): ShareCard {
  return {
    ...buildShareCard({ ...input, rows: input.rows }),
    podiumFirst: false,
    lines: [...input.rows]
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .slice(0, RESULTS_IMAGE_TOTAL_CAP)
      .map((row) => ({ name: row.name, points: formatPoints(row.points) })),
    moreCount: Math.max(0, input.rows.length - RESULTS_IMAGE_TOTAL_CAP),
  };
}
