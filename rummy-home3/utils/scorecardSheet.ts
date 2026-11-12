import { initialsById } from '@/utils/playerInitials';
import { formatPoints, placeLabel, podiumPlaces, totalAcrossGames } from '@/utils/results';

export type ScoreCell = {
  text: string;
  sign: 'pos' | 'neg' | 'zero';
};

export type ScorecardSheet = {
  brand: 'EZ Score: Rummy';
  heading: string;
  when: string;
  status: 'Live' | 'Completed';
  columns: { label: string; total: number; totalText: string }[];
  rounds: { round: number; cells: ScoreCell[] }[];
  totalSum: number;
  /** 1st, 2nd, and 3rd by name. Scores stay in the table. */
  places: { label: string; names: string }[];
};

export function canShareResults(isComplete: boolean): boolean {
  return isComplete;
}

export function placeLine(place: { label: string; names: string }): string {
  return `${place.label}  ${place.names}`;
}

/** Full scorecard for the results picture: every round, every score, names at the bottom. */
export function buildScorecardSheet(input: {
  gameNumber: number | null;
  gameLabel: string;
  when: string;
  isComplete: boolean;
  players: { id: string; name: string; label?: string | null }[];
  scores: Record<string, number[]>;
}): ScorecardSheet {
  const byId = initialsById(input.players);
  const labels = input.players.map((player) => byId.get(player.id));
  const roundCount = input.players.reduce(
    (max, player) => Math.max(max, input.scores[player.id]?.length ?? 0),
    0,
  );
  const columns = input.players.map((player, index) => {
    const total = (input.scores[player.id] ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0);
    return { label: labels[index] ?? '?', total, totalText: formatPoints(total) };
  });
  const rounds = Array.from({ length: roundCount }, (_, index) => ({
    round: index + 1,
    cells: input.players.map((player) => {
      const value = Number(input.scores[player.id]?.[index] ?? 0) || 0;
      return {
        text: formatPoints(value),
        sign: value > 0 ? 'pos' as const : value < 0 ? 'neg' as const : 'zero' as const,
      };
    }),
  }));
  const standings = totalAcrossGames([{
    players: input.players.map((player) => player.id),
    scores: input.scores,
    names: Object.fromEntries(input.players.map((player) => [player.id, player.name])),
  }]);
  return {
    brand: 'EZ Score: Rummy',
    heading: input.gameNumber != null ? `G${input.gameNumber}` : input.gameLabel,
    when: input.when,
    status: input.isComplete ? 'Completed' : 'Live',
    columns,
    rounds,
    totalSum: columns.reduce((sum, column) => sum + column.total, 0),
    places: podiumPlaces(standings).map((group) => ({
      label: placeLabel(group[0].place),
      names: group.map((row) => row.name).join(', '),
    })),
  };
}
