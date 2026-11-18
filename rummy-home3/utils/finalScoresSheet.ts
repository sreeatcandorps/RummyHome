import { LabelledGame, gameLabelOf, gameTitle, screenTitle } from '@/utils/gameLabel';
import { formatPoints } from '@/utils/results';
import { exactSubline, multiplierLabel, multiplyScores } from '@/utils/multiplier';
import { buildRoundTable, ResultsRoundTable } from '@/utils/resultsDetails';
import { buildScoresCard, ShareCard } from '@/utils/shareCard';
import { PoolSeat } from '@/types/game';
import { EMPTY_SEAT, isOut, poolTotal } from '@/utils/pool';

import { formatWhen } from '@/utils/formatWhen';

export { formatWhen };


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
  /** Pool (PR 13): "4 in · 2 out · limit 101", and whether the card shows awards. */
  poolLine?: string;
  showsAwards?: boolean;
  /** Multiplier (PR 14): the game's ×N when above 1; every number on the sheet is already the actual points. */
  multiplier?: number;
  /** "×100 · exact points" under the heading when the multiplier is above 1. */
  multiplierLine?: string;
};

/** Pool (PR 13) inputs: seats for totals, the limit, and the awards once given. */
export type FinalScoresPool = {
  limit: number;
  fullCount: number;
  seats: Record<string, PoolSeat | undefined>;
  awards?: Record<string, number> | null;
};

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

/** "Final scores · S10" (PR 10b title; A02 drops the word "Game"). */
export function finalScoresHeading(game: LabelledGame): string {
  return screenTitle('Final scores', game);
}

/** "Game S3": the visible number only; the long id never appears on a shared sheet. */
export function finalScoresFooter(game: LabelledGame & { id: string; shareCode?: string }): string {
  return gameTitle(game, 'EZ Score game');
}

/** "Totals add to 0", or "Totals add to +40" — the screen paints the non-zero case red (PR 10b). */
export function totalsLine(sum: number): string {
  return sum === 0 ? 'Totals add to 0' : `Totals add to ${formatPoints(sum)}`;
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
  pool?: FinalScoresPool;
  /** Points games (PR 14): the entered scores are multiplied once here; Pool ignores it. */
  multiplier?: number;
}): FinalScoresSheet {
  const now = input.now ?? new Date();
  const pool = input.pool;
  const multiplier = !pool && input.multiplier && input.multiplier > 1 ? Math.trunc(input.multiplier) : 1;
  const scores = multiplier > 1 ? multiplyScores(input.scores, multiplier) : input.scores;
  const roundCount = input.players.reduce((max, player) => Math.max(max, scores[player.id]?.length ?? 0), 0);

  const players: FinalScoresPlayer[] = input.players.map((player) => {
    const column = scores[player.id] ?? [];
    const seat = pool?.seats[player.id] ?? EMPTY_SEAT;
    const cells: FinalScoreCell[] = Array.from({ length: roundCount }, (_, index) => {
      const value = Number(column[index] ?? 0) || 0;
      if (pool) {
        // Pool: 0 is the win, a hand at or past the Full count reads as a big loss, the rest plain.
        const gone = (seat.outRound && index + 1 > seat.outRound) || (seat.reenteredRound && index + 1 < seat.reenteredRound && column[index] === undefined);
        return { round: index + 1, text: gone ? '·' : String(value), sign: gone ? 'zero' : value === 0 ? 'pos' : pool.fullCount && value >= pool.fullCount ? 'neg' : 'zero' };
      }
      return { round: index + 1, text: formatPoints(value), sign: value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero' };
    });
    const total = pool ? poolTotal(column, seat) : column.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalText = pool ? `${total}${isOut(seat) ? ' · OUT' : ''}` : formatPoints(total);
    return { id: player.id, name: player.name, total, totalText, rows: chunk(cells, CELLS_PER_ROW) };
  });

  // Points: highest first. Pool: players still in, lowest first, then the outs; with awards, by award.
  const awards = pool?.awards ?? null;
  const summary = [...players]
    .sort((a, b) => {
      if (awards) return (awards[b.id] ?? 0) - (awards[a.id] ?? 0) || a.name.localeCompare(b.name);
      if (pool) {
        const ao = isOut(pool.seats[a.id]), bo = isOut(pool.seats[b.id]);
        if (ao !== bo) return ao ? 1 : -1;
        return a.total - b.total || a.name.localeCompare(b.name);
      }
      return b.total - a.total || a.name.localeCompare(b.name);
    })
    .map(({ id, name, total, totalText }) => (awards
      ? { id, name, total: awards[id] ?? 0, totalText: `${formatPoints(awards[id] ?? 0)} · ${totalText}` }
      : { id, name, total, totalText }));

  const completedLine = input.game.completedAt
    ? `Completed ${formatWhen(input.game.completedAt)}`
    : input.game.isComplete
      ? 'Completed'
      : 'In progress';

  const label = gameLabelOf(input.game) ?? '';
  const totals = Object.fromEntries(players.map((player) => [player.id, player.total]));
  const inCount = pool ? players.filter((p) => !isOut(pool.seats[p.id])).length : 0;
  const poolLine = pool ? `${inCount} in · ${players.length - inCount} out · limit ${pool.limit}${awards ? ' · awards given' : ''}` : undefined;
  const table = buildRoundTable(
    { id: input.game.id, name: input.game.shareCode ?? label, label, date: input.game.date, scores: totals, rounds: scores, roundCount, multiplier: multiplier > 1 ? multiplier : undefined },
    0,
    input.players,
  );
  const card = buildScoresCard({
    title: awards ? `Awards · ${finalScoresHeading(input.game).replace(/^Final scores · /, '')}` : finalScoresHeading(input.game),
    tone: 'game',
    date: formatWhen(input.game.date),
    summary: `${players.length} ${players.length === 1 ? 'player' : 'players'} · ${roundCount === 1 ? '1 round' : `${roundCount} rounds`}${poolLine ? ` · ${poolLine}` : ''}${multiplier > 1 ? ` · ${multiplierLabel(multiplier)}` : ''}`,
    standings: summary.map((row, index) => ({ id: row.id, name: row.name, points: row.total, games: 1, place: index + 1 })),
    players: input.players,
    games: [{ scores: awards ? Object.fromEntries(players.map((p) => [p.id, awards[p.id] ?? 0])) : totals }],
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
    poolLine,
    showsAwards: Boolean(awards),
    multiplier: multiplier > 1 ? multiplier : undefined,
    multiplierLine: exactSubline(multiplier) ?? undefined,
  };
}
