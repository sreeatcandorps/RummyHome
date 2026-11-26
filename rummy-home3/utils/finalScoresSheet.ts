import { LabelledGame, gameLabelOf, gameTitle, screenTitle } from '@/utils/gameLabel';
import { formatPoints } from '@/utils/results';
import { exactSubline, multiplierLabel, multiplyScores } from '@/utils/multiplier';
import { buildRoundTable, PdfSection, ResultsRoundTable } from '@/utils/resultsDetails';
import { buildScoresCard, ShareCard } from '@/utils/shareCard';
import { AwardNote, PoolSeat } from '@/types/game';
import { EMPTY_SEAT, isOut, pointsLeft, poolTotal } from '@/utils/pool';
import { firstAppearanceOrder, initialsById } from '@/utils/playerInitials';

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
  /** Nov 18: the full-details PDF above the rounds — pool limit and drops, the players (pool score, entries, put in, gets, award, out round), re-entries. Points: totals. */
  pdfSections: PdfSection[];
};

/** Pool (PR 13) inputs: seats for totals, the limit, and the awards once given. */
export type FinalScoresPool = {
  limit: number;
  fullCount: number;
  seats: Record<string, PoolSeat | undefined>;
  awards?: Record<string, number> | null;
  /** Points per drop, for the PDF's pool line. */
  drop?: number;
  /** What the awards were based on (entry, pool total, given out), for the PDF. */
  awardNote?: AwardNote | null;
};

/** Pool round cell in the PDF: "—" before a late entry, "↺106" on the re-entry round, "101 out" on the out round, "·" once gone. */
export function poolRoundCellText(seat: PoolSeat, roundIndex: number, value: number | null | undefined): string {
  const round = roundIndex + 1;
  if (seat.reenteredRound && round === seat.reenteredRound) return `↺${seat.reentryScore ?? value ?? 0}`;
  if (seat.outRound && round > seat.outRound) return '·';
  if (value == null) return '—';
  if (seat.outRound && round === seat.outRound) return `${value} out`;
  return String(value);
}

/** The PDF's pool blocks: limit/drops, every player's pool numbers (with the awards once given), re-entries. */
export function poolPdfSections(input: {
  pool: FinalScoresPool;
  players: { id: string; name: string; total: number }[];
  order: string[];
}): PdfSection[] {
  const { pool, players, order } = input;
  const awards = pool.awards ?? null;
  const note = pool.awardNote ?? null;
  const entry = note?.entry;
  const byId = new Map(players.map((player) => [player.id, player]));
  const sorted = order.map((id) => byId.get(id)).filter((player): player is { id: string; name: string; total: number } => Boolean(player));
  const inCount = sorted.filter((player) => !isOut(pool.seats[player.id])).length;

  const poolLines = [
    `Limit ${pool.limit}${pool.drop ? ` · drop ${pool.drop}` : ''}`,
    `${inCount} in · ${sorted.length - inCount} out`,
    awards
      ? `Awards given${note?.presetLabel ? ` · ${note.presetLabel}` : ''}${entry != null ? ` · entry ${entry}` : ''}${note?.poolTotal != null ? ` · pool ${note.poolTotal}` : ''}${note?.givenOut != null ? ` · given out ${note.givenOut}` : ''}`
      : 'Awards not given yet',
  ];

  const heads = ['Player', 'Pool score', 'Entries', 'Out', ...(awards ? ['Put in', 'Gets', 'Award'] : [])];
  const rows = sorted.map((player) => {
    const seat = pool.seats[player.id] ?? EMPTY_SEAT;
    const award = awards?.[player.id] ?? 0;
    const putIn = entry != null ? seat.entries * entry : null;
    return [
      player.name,
      String(player.total),
      String(seat.entries),
      seat.outRound ? `Round ${seat.outRound}` : '—',
      ...(awards ? [putIn == null ? '—' : String(putIn), putIn == null ? '—' : String(award + putIn), formatPoints(award)] : []),
    ];
  });

  const reentries = sorted
    .filter((player) => (pool.seats[player.id]?.reenteredRound ?? 0) > 0)
    .map((player) => {
      const seat = pool.seats[player.id] ?? EMPTY_SEAT;
      return `${player.name}: ${seat.entries > 1 ? 'came back' : 'joined'} in round ${seat.reenteredRound} at ${seat.reentryScore ?? 0}`;
    });

  return [
    { title: 'Pool', lines: poolLines },
    { title: awards ? 'Players and awards' : 'Players', table: { heads, rows } },
    ...(reentries.length > 0 ? [{ title: 'Re-entries', lines: reentries }] : []),
  ];
}

export const FINAL_SCORES_TITLE = 'Final scores';

/** Places for rows already in order: equal keys share a place, the next place skips (1, 2, 2, 4). */
export function placesOf(keys: (string | number)[]): number[] {
  return keys.map((key, index) => {
    let first = index;
    while (first > 0 && keys[first - 1] === key) first -= 1;
    return first + 1;
  });
}

/** Pool status beside the score, as the scorecard says it: "49 left", or "Out · round 3". */
export function poolStatus(total: number, seat: PoolSeat, limit: number): string {
  return seat.outRound ? `Out · round ${seat.outRound}` : `${pointsLeft(total, limit)} left`;
}

/**
 * D104 (Q19): the game PDF opens with the final scores as a table, in the order of the Final
 * screen's picture. Points: Place · Player · Total, the winner tinted, "Totals add to 0" as the
 * last row. Pool: Place · Player · (Award) · Score · Status ("49 left" / "Out · round 3").
 * Every numeric column and its heading are right-aligned.
 */
export function finalScoresSection(input: {
  summary: { id: string; name: string; total: number }[];
  initials: Map<string, string>;
  totals: Record<string, number>;
  totalSum: number;
  pool?: FinalScoresPool;
  multiplierLine?: string | null;
}): PdfSection {
  const { summary, initials, totals, pool } = input;
  const awards = pool?.awards ?? null;
  const who = (id: string, name: string) => (initials.get(id) ? `${name} · ${initials.get(id)}` : name);
  const lines = input.multiplierLine ? [input.multiplierLine] : undefined;
  if (!pool) {
    const places = placesOf(summary.map((row) => row.total));
    const rows = summary.map((row, index) => [String(places[index]), who(row.id, row.name), formatPoints(row.total)]);
    const highlight = summary.map((row, index) => (places[index] === 1 && row.total > 0 ? index : -1)).filter((index) => index >= 0);
    return {
      title: FINAL_SCORES_TITLE,
      ...(lines ? { lines } : {}),
      table: { heads: ['Place', 'Player', 'Total'], rows, align: ['left', 'left', 'right'], highlight, foot: ['', 'Totals add to', formatPoints(input.totalSum)] },
    };
  }
  const seatOfId = (id: string) => pool.seats[id] ?? EMPTY_SEAT;
  const keys = summary.map((row) => (awards ? awards[row.id] ?? 0 : `${isOut(seatOfId(row.id))}|${totals[row.id] ?? 0}`));
  const places = placesOf(keys);
  const rows = summary.map((row, index) => {
    const score = totals[row.id] ?? 0;
    return [
      String(places[index]),
      who(row.id, row.name),
      ...(awards ? [formatPoints(awards[row.id] ?? 0)] : []),
      String(score),
      poolStatus(score, seatOfId(row.id), pool.limit),
    ];
  });
  const winner = (id: string) => (awards ? (awards[id] ?? 0) > 0 : !isOut(seatOfId(id)));
  const highlight = summary.map((row, index) => (places[index] === 1 && winner(row.id) ? index : -1)).filter((index) => index >= 0);
  return {
    title: FINAL_SCORES_TITLE,
    table: {
      heads: ['Place', 'Player', ...(awards ? ['Award'] : []), 'Score', 'Status'],
      rows,
      align: ['left', 'left', ...(awards ? ['right' as const] : []), 'right', 'right'],
      highlight,
    },
  };
}

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
  const detailGame = { id: input.game.id, name: input.game.shareCode ?? label, label, date: input.game.date, scores: totals, rounds: scores, roundCount, multiplier: multiplier > 1 ? multiplier : undefined };
  const initials = initialsById(firstAppearanceOrder(input.players, [detailGame]));
  const table = buildRoundTable(
    detailGame,
    0,
    input.players,
    initials,
    pool
      ? {
          cell: (playerId, roundIndex, value) => poolRoundCellText(pool.seats[playerId] ?? EMPTY_SEAT, roundIndex, value),
          total: (playerId, total) => `${total}${isOut(pool.seats[playerId]) ? ' out' : ''}`,
        }
      : {},
  );
  const totalSum = players.reduce((sum, player) => sum + player.total, 0);
  const pdfSections: PdfSection[] = [
    finalScoresSection({
      summary,
      initials,
      totals,
      totalSum,
      pool,
      multiplierLine: multiplier > 1 ? `${multiplierLabel(multiplier)}: every number here is the actual points.` : null,
    }),
    ...(pool ? poolPdfSections({ pool, players, order: summary.map((row) => row.id) }) : []),
  ];
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
    totalSum,
    footer: finalScoresFooter(input.game),
    adminLines: input.admins && input.admins.length > 0 ? [`Game admins: ${input.admins.join(', ')}`] : [],
    table,
    card,
    poolLine,
    showsAwards: Boolean(awards),
    multiplier: multiplier > 1 ? multiplier : undefined,
    multiplierLine: exactSubline(multiplier) ?? undefined,
    pdfSections,
  };
}
