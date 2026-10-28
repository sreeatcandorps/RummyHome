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
  brand: 'Rummy Home';
  title: string;
  date: string;
  lines: ShareCardLine[];
  moreCount: number;
  places: ShareCardPlace[];
};

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
    brand: 'Rummy Home',
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
