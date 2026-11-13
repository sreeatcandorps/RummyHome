import { gameLabelOf, gameTitle, LabelledGame } from '@/utils/gameLabel';
import { formatPoints } from '@/utils/results';
import { buildRoundTable, ResultsRoundTable } from '@/utils/resultsDetails';
import { buildScoresCard, ShareCard } from '@/utils/shareCard';

/** "Mon, Jul 27 · 6:27 PM" — same shape as the scorecard header. Pure copy so this module runs under node. */
export function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}


/** Round scores in the long image sit in square cells, five to a row. */
export const CELLS_PER_ROW = 5;

export type FinalScoreCell = {
  round: number;
  text: string;
  sign: 'pos' | 'neg' | 'zero';
};

export type FinalScoresPlayer = {
  id: string;
  name: string;
  total: number;
  totalText: string;
  /** Rows of up to CELLS_PER_ROW cells, in round order. */
  rows: FinalScoreCell[][];
};

/**
 * One game's final scores, as shared from the scorecard. This is not a Result:
 * no podium, no places, the word "Results" never appears. Yellow theme.
 */
export type FinalScoresSheet = {
  brand: 'EZ Score: Rummy';
  /** "Game 3 Final Scores" */
  heading: string;
  startedLine: string;
  completedLine: string;
  generatedLine: string;
  roundCount: number;
  /** Highest total first, no rank labels. */
  summary: { id: string; name: string; total: number; totalText: string }[];
  players: FinalScoresPlayer[];
  totalSum: number;
  /** "Game S3" */
  footer: string;
  /** "Game admins: Sree Koneru · #39, …" — who ran the game; empty when unknown. */
  adminLines: string[];
  /** PR 8: the rounds in blocks of five players with the game total in each column head (preview + PDF). */
  table: ResultsRoundTable;
  /** PR 8: the shared picture is the standings only (same card as a saved result); rounds go in the PDF. */
  card: ShareCard;
};

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

export function finalScoresHeading(game: LabelledGame): string {
  const label = gameLabelOf(game);
  return label ? `Game ${label} Final Scores` : 'Final Scores';
}

/** "Game S3": the visible number only; the long id never appears on a shared sheet. */
export function finalScoresFooter(game: LabelledGame & { id: string; shareCode?: string }): string {
  return gameTitle(game, 'EZ Score game');
}

/** Share sheet file name and title: never "results". */
export const FINAL_SCORES_FILE = 'ez-score-final-scores.png';

export function buildFinalScoresSheet(input: {
  game: { id: string; shareCode?: string; gameNumber?: number | null; gameLabel?: string | null; date: string; completedAt?: string | null; isComplete: boolean };
  players: { id: string; name: string; playerNo?: number | null }[];
  scores: Record<string, number[]>;
  /** "Name · #39" per admin, creator first. */
  admins?: string[];
  now?: Date;
}): FinalScoresSheet {
  const now = input.now ?? new Date();
  const roundCount = input.players.reduce((max, player) => Math.max(max, input.scores[player.id]?.length ?? 0), 0);

  const players: FinalScoresPlayer[] = input.players.map((player) => {
    const column = input.scores[player.id] ?? [];
    const cells: FinalScoreCell[] = Array.from({ length: roundCount }, (_, index) => {
      const value = Number(column[index] ?? 0) || 0;
      return { round: index + 1, text: formatPoints(value), sign: value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero' };
    });
    const total = column.reduce((sum, value) => sum + (Number(value) || 0), 0);
    return { id: player.id, name: player.name, total, totalText: formatPoints(total), rows: chunk(cells, CELLS_PER_ROW) };
  });

  const summary = [...players]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map(({ id, name, total, totalText }) => ({ id, name, total, totalText }));

  const completedLine = input.game.completedAt
    ? `Completed ${formatWhen(input.game.completedAt)}`
    : input.game.isComplete
      ? 'Completed'
      : 'In progress';

  const label = gameLabelOf(input.game) ?? '';
  const totals = Object.fromEntries(players.map((player) => [player.id, player.total]));
  const table = buildRoundTable(
    { id: input.game.id, name: input.game.shareCode ?? label, label, date: input.game.date, scores: totals, rounds: input.scores, roundCount },
    0,
    input.players,
  );
  const card = buildScoresCard({
    title: finalScoresHeading(input.game),
    date: `${formatWhen(input.game.date)} · ${roundCount === 1 ? '1 round' : `${roundCount} rounds`}`,
    standings: summary.map((row, index) => ({ id: row.id, name: row.name, points: row.total, games: 1, place: index + 1 })),
    players: input.players,
    games: [{ scores: totals }],
    footer: finalScoresFooter(input.game),
  });

  return {
    brand: 'EZ Score: Rummy',
    heading: finalScoresHeading(input.game),
    startedLine: `Started ${formatWhen(input.game.date)}`,
    completedLine,
    generatedLine: `Generated ${formatWhen(now.toISOString())}`,
    roundCount,
    summary,
    players,
    totalSum: players.reduce((sum, player) => sum + player.total, 0),
    footer: finalScoresFooter(input.game),
    adminLines: input.admins && input.admins.length > 0 ? [`Game admins: ${input.admins.join(', ')}`] : [],
    table,
    card,
  };
}
