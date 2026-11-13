import { firstAppearanceOrder, initialsById } from '@/utils/playerInitials';
import { formatPoints, playersByFirstName, resultsCountLine, ResultStanding, sheetGameLabel } from '@/utils/results';
import {
  BandCell,
  BandTable,
  buildBandTable,
  DesignPlayer,
  evenLine,
  gameCountsLine,
  GameInfo,
  gamePeopleLine,
  gamesInResult,
  legendOf,
  LegendEntry,
  legendText,
  RankedRow,
  RankedScores,
  rankScores,
  resultInitials,
  resultLinkText,
  startParts,
} from '@/utils/resultsDesign';

export type ResultsDetailGame = {
  id: string;
  /** Share code or id tail. */
  name: string;
  /** "S7" — the game's own label. */
  label?: string | null;
  /** ISO start time. */
  date?: string;
  scores: Record<string, number>;
  /** Round-by-round scores, when the games were available. */
  rounds?: Record<string, number[]>;
  roundCount?: number;
  creatorName?: string | null;
  adminNames?: string[];
  reused?: boolean;
};

/** Up to this many players side by side in a round table; more wrap into another block. */
export const ROUND_BLOCK_SIZE = 5;

export type RoundBlock = {
  /** Column heads: initials, Player ID and game total, one per player in the block. */
  heads: { initials: string; playerNo?: number | null; total: string }[];
  rows: { round: number; cells: string[] }[];
};

export type ResultsRoundTable = {
  /** "S7" */
  label: string;
  /** "7:45 PM Thursday, November 5" split so the time can be bold. */
  start: { time: string; date: string };
  /** Share code or id tail. */
  code: string;
  /** Column headers, one initials per seated player. */
  initials: string[];
  /** Full names in the same order, for the legend. */
  names: string[];
  rows: { round: number; cells: string[] }[];
  totals: string[];
  /** Blocks of ROUND_BLOCK_SIZE players, totals in the head under each player (Part B). */
  blocks: RoundBlock[];
  /** True when the saved result had no rounds to show. */
  totalsOnly: boolean;
};

export type ResultsDetails = {
  title: string;
  /** Six-character result code. */
  code?: string;
  createdAtLabel: string;
  /** "Saved" once the result is saved; "Created" for a preview. Goes before createdAtLabel. */
  dateWord: 'Saved' | 'Created';
  gameCount: number;
  /** Players seated in at least one game, counted once. */
  playerCount: number;
  /** "7 games · 12 players" */
  countLine: string;
  /** The screen's banner and warning lines, word for word (see ShareCard.notes). */
  notes?: string[];
  scores: RankedScores;
  evenLine: string | null;
  table: BandTable;
  legend: LegendEntry[];
  games: GameInfo[];
  roundTables: ResultsRoundTable[];
  /** "ezscore.mindweavetech.com/r/<id>" on a saved result. */
  link?: string | null;
  /** "Result ID · ABC123" — the same stable id as on the image. */
  footer?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function chunkBy<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/**
 * One game's rounds: every round, every seated player, game totals. Labels are shared
 * across the whole result (first appearance order) so the same person reads the same in
 * every table; pass them in when there are several games.
 */
export function buildRoundTable(
  game: ResultsDetailGame,
  index: number,
  players: DesignPlayer[],
  labels: Map<string, string> = initialsById(firstAppearanceOrder(players, [game])),
): ResultsRoundTable {
  const seated = playersByFirstName(players.filter((player) => Object.prototype.hasOwnProperty.call(game.scores, player.id)));
  const names = seated.map((player) => player.name);
  const initials = seated.map((player) => labels.get(player.id) ?? '?');
  const rounds = game.rounds;
  const roundCount = rounds ? seated.reduce((max, player) => Math.max(max, rounds[player.id]?.length ?? 0), 0) : 0;
  const cellAt = (playerId: string, roundIndex: number) => {
    const value = rounds?.[playerId]?.[roundIndex];
    return value == null ? '—' : formatPoints(value);
  };
  const rows = Array.from({ length: roundCount }, (_, roundIndex) => ({
    round: roundIndex + 1,
    cells: seated.map((player) => cellAt(player.id, roundIndex)),
  }));
  const totals = seated.map((player) => formatPoints(game.scores[player.id] ?? 0));
  const blocks: RoundBlock[] = chunkBy(seated.map((player, position) => ({ player, position })), ROUND_BLOCK_SIZE).map((block) => ({
    heads: block.map(({ player, position }) => ({ initials: initials[position], playerNo: player.playerNo ?? null, total: totals[position] })),
    rows: Array.from({ length: roundCount }, (_, roundIndex) => ({
      round: roundIndex + 1,
      cells: block.map(({ player }) => cellAt(player.id, roundIndex)),
    })),
  }));
  return {
    label: sheetGameLabel({ label: game.label, name: game.name }),
    start: startParts(game.date),
    code: game.name,
    initials,
    names,
    rows,
    totals,
    blocks,
    totalsOnly: !rounds || roundCount === 0,
  };
}

/** The PDF, the web page and the on-screen page use the same player order and the same cells. */
export function buildResultsDetails(input: {
  createdAtLabel: string;
  standings: ResultStanding[];
  players: DesignPlayer[];
  games: ResultsDetailGame[];
  /** Set for a saved result; a preview says Created. */
  saved?: boolean;
  resultId?: string | null;
  notes?: string[];
  footer?: string;
  now?: Date;
}): ResultsDetails {
  const labels = resultInitials(input.players, input.games);
  const scores = rankScores(input.standings, input.players, labels);
  const totals = Object.fromEntries(input.standings.map((row) => [row.id, row.points]));
  const table = buildBandTable({ games: input.games, players: input.players, totals, labels, order: scores.order });
  const seated = new Set(input.games.flatMap((game) => Object.keys(game.scores).filter((id) => id !== 'EX')));
  const playerCount = seated.size > 0 ? seated.size : input.players.length;
  return {
    title: 'Results',
    ...(input.resultId ? { code: input.resultId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() } : {}),
    createdAtLabel: input.createdAtLabel,
    dateWord: input.saved ? 'Saved' : 'Created',
    gameCount: input.games.length,
    playerCount,
    countLine: resultsCountLine(input.games.length, playerCount),
    ...(input.notes?.length ? { notes: input.notes } : {}),
    scores,
    evenLine: evenLine(scores.even),
    table,
    legend: legendOf(table.rows),
    games: gamesInResult(input.games, input.now),
    roundTables: input.games.map((game, index) => buildRoundTable(game, index, input.players, labels)),
    link: input.resultId ? resultLinkText(input.resultId) : null,
    ...(input.footer ? { footer: input.footer } : {}),
  };
}

// ---------- HTML (phones print this with expo-print; the web page uses the same classes) ----------

function toneClass(cell: BandCell): string {
  switch (cell.tone) {
    case 'win': return 'c win';
    case 'neg': return 'c neg';
    case 'dash': return 'c dash';
    case 'blank': return 'c blank';
    default: return 'c';
  }
}

function pointsClass(value: string): string {
  if (value === '—') return 'dash';
  return value.startsWith('-') ? 'neg' : value.startsWith('+') ? 'pos' : 'zero';
}

export function medalHtml(medal: 1 | 2 | 3 | undefined): string {
  if (!medal) return '';
  return `<span class="medal m${medal}" aria-label="${['Gold', 'Silver', 'Bronze'][medal - 1]}">${medal}</span>`;
}

export function playerLineHtml(row: RankedRow): string {
  return `<div class="pl"><div class="nm"><div class="n1">${medalHtml(row.medal)}<span>${escapeHtml(row.name)}</span></div>`
    + `${row.sub ? `<div class="n2">${escapeHtml(row.sub)}</div>` : ''}</div><div class="pt ${pointsClass(row.text)}">${escapeHtml(row.text)}</div></div>`;
}

export function scoresSplitHtml(scores: RankedScores, even: string | null): string {
  const column = (rows: RankedRow[]) => (rows.length === 0 ? '<div class="none">None</div>' : rows.map(playerLineHtml).join(''));
  return `<div class="split"><div class="col">${column(scores.positive)}</div><div class="col">${column(scores.negative)}</div></div>`
    + (even ? `<p class="even">${escapeHtml(even)}</p>` : '');
}

/** One bordered box of five cells; the same markup in the header and in every row. */
function bandBoxHtml(cells: { text: string; cls: string }[], head: boolean): string {
  return `<div class="box${head ? ' head' : ''}">${cells.map((cell) => `<div class="${cell.cls}">${escapeHtml(cell.text)}</div>`).join('')}</div>`;
}

export function bandTableHtml(table: BandTable): string {
  const header = `<div class="brow hrow"><div class="pcell head">Player</div><div class="tcell head">Total</div><div class="boxes">`
    + table.header.map((band) => bandBoxHtml(band.map((label) => ({ text: label, cls: label ? 'c' : 'c blank' })), true)).join('')
    + '</div></div>';
  const rows = table.rows.map((row) =>
    `<div class="brow"><div class="pcell"><b>${escapeHtml(row.initials)}</b>${row.playerNo != null ? `<small>#${row.playerNo}</small>` : ''}</div>`
    + `<div class="tcell ${row.totalTone}">${escapeHtml(row.total)}</div><div class="boxes">`
    + row.bands.map((band) => bandBoxHtml(band.map((cell) => ({ text: cell.text, cls: toneClass(cell) })), false)).join('')
    + '</div></div>').join('');
  return `<div class="bt" data-bands="${table.bandCount}">${header}${rows}</div>`;
}

export function legendHtml(legend: LegendEntry[]): string {
  return `<p class="legend">${legend.map((entry) => `<span><b>${escapeHtml(entry.initials)}</b>${entry.playerNo != null ? ` <small>#${entry.playerNo}</small>` : ''} ${escapeHtml(entry.name)}</span>`).join(' · ')}</p>`;
}

export function gameInfoHtml(info: GameInfo): string {
  const people = gamePeopleLine(info);
  return `<div class="gm"><div class="g1"><span class="lab">${escapeHtml(info.label)}</span>`
    + `<span class="when"><b>${escapeHtml(info.start.time)}</b> ${escapeHtml(info.start.date)}</span></div>`
    + `<div class="g2">${escapeHtml(gameCountsLine(info))} · <i class="gid">Game ID ${escapeHtml(info.code)}</i></div>`
    + (people ? `<div class="g2">${escapeHtml(people)}</div>` : '')
    + (info.reused ? '<div class="g2 warn">Already counted in an earlier result</div>' : '')
    + '</div>';
}

export function roundBlockHtml(block: RoundBlock): string {
  const head = `<tr><th class="rn">Rnd</th>${block.heads.map((head) => `<th><span class="ini">${escapeHtml(head.initials)}</span>`
    + `${head.playerNo != null ? `<small>#${head.playerNo}</small>` : ''}<span class="tot ${pointsClass(head.total)}">${escapeHtml(head.total)}</span></th>`).join('')}</tr>`;
  const body = block.rows.map((row) => `<tr><td class="rn">${row.round}</td>${row.cells.map((cell) => `<td class="${pointsClass(cell)}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `<table class="rb"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function roundTableHtml(table: ResultsRoundTable): string {
  const heading = `<h3><span class="lab">${escapeHtml(table.label)}</span> <span class="when"><b>${escapeHtml(table.start.time)}</b> ${escapeHtml(table.start.date)}</span> <i class="gid">Game ID ${escapeHtml(table.code)}</i></h3>`;
  if (table.initials.length === 0) return `<section class="game">${heading}<p class="mute">No players were seated.</p></section>`;
  if (table.totalsOnly) {
    const totals = table.initials.map((label, index) => `<span><b>${escapeHtml(label)}</b> ${escapeHtml(table.totals[index])}</span>`).join(' · ');
    return `<section class="game">${heading}<p class="legend">${totals}</p><p class="mute">Round scores were not saved with this result; game totals only.</p></section>`;
  }
  const legend = table.initials.map((label, index) => `<span><b>${escapeHtml(label)}</b> ${escapeHtml(table.names[index])}</span>`).join(' · ');
  return `<section class="game">${heading}${table.blocks.map(roundBlockHtml).join('')}<p class="legend">${legend}</p></section>`;
}

/** Shared by the PDF and public/r/index.html (kept in step by tests/results-design.test.ts). */
export const RESULTS_DESIGN_CSS = `
  :root { --ink: #17201B; --muted: #4E5752; --line: #DCDDD5; --green: #15803D; --edge: #0E5A2A; --win: #D6F5DF; --neg: #A8201A; --bg: #F6F6F1; --head: #EEEEE7; --amber: #FFE38A; --on-amber: #3F2D00; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--ink); margin: 0; font-size: 16px; line-height: 1.3; }
  h1 { margin: 0; font-size: 28px; font-weight: 800; }
  h2 { font-size: 13px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
  h3 { font-size: 16px; margin: 0 0 6px; font-weight: 700; }
  p { margin: 0 0 4px; }
  .brand { color: var(--green); font-weight: 800; letter-spacing: 0.4px; font-size: 13px; margin-bottom: 2px; }
  .meta { color: var(--muted); font-size: 14px; }
  .count { font-size: 16px; font-weight: 700; }
  .code { color: var(--muted); font-weight: 600; }
  .note { background: var(--amber); color: var(--on-amber); border-radius: 8px; padding: 8px 10px; font-size: 14px; font-weight: 600; margin: 6px 0; }
  .section { margin-top: 18px; }
  .split { display: flex; gap: 14px; align-items: flex-start; }
  .col { flex: 1; min-width: 0; }
  .pl { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); }
  .pl .nm { flex: 1; min-width: 0; }
  .pl .n1 { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 16px; }
  .pl .n1 span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pl .n2 { color: var(--muted); font-size: 13px; }
  .pl .pt { font-weight: 800; font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pos, .zero { color: var(--ink); }
  .neg { color: var(--neg); }
  .dash { color: #8A918C; }
  .none, .mute { color: var(--muted); font-size: 14px; }
  .even { color: var(--muted); font-size: 14px; margin-top: 6px; }
  .medal { display: inline-flex; width: 20px; height: 20px; border-radius: 50%; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex: none; border: 1px solid rgba(0,0,0,0.15); }
  .m1 { background: #F6C84C; color: #3F2D00; } .m2 { background: #D9DCE0; color: #2B3036; } .m3 { background: #D99A66; color: #3B1D08; }
  .bt { margin-top: 4px; }
  .brow { display: flex; align-items: stretch; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--line); }
  .hrow { border-bottom: 2px solid var(--edge); }
  .pcell { width: 52px; flex: none; display: flex; flex-direction: column; justify-content: center; font-size: 14px; line-height: 1.15; }
  .pcell b { font-size: 15px; } .pcell small { color: var(--muted); font-size: 12px; }
  .tcell { width: 56px; flex: none; display: flex; align-items: center; justify-content: flex-end; font-weight: 800; font-size: 15px; font-variant-numeric: tabular-nums; padding-right: 2px; }
  .pcell.head, .tcell.head { font-weight: 700; color: var(--muted); font-size: 13px; }
  .boxes { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .box { display: grid; grid-template-columns: repeat(5, 1fr); border: 2px solid var(--green); border-radius: 5px; overflow: hidden; }
  .box.head { background: var(--head); border-color: var(--edge); }
  .box .c { text-align: right; padding: 3px 5px; font-size: 14px; font-variant-numeric: tabular-nums; border-left: 1px solid var(--line); white-space: nowrap; }
  .box .c:first-child { border-left: 0; }
  .box.head .c { font-weight: 800; color: var(--ink); text-align: center; }
  .box .c.win { background: var(--win); font-weight: 700; }
  .box .c.neg { color: var(--neg); }
  .box .c.dash { color: #8A918C; }
  .box .c.blank { background: repeating-linear-gradient(135deg, transparent 0 4px, rgba(0,0,0,0.04) 4px 8px); }
  .legend { color: var(--muted); font-size: 13px; margin-top: 8px; line-height: 1.5; }
  .legend b { color: var(--ink); } .legend small { font-size: 12px; }
  .gm { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .g1 { display: flex; align-items: baseline; gap: 8px; }
  .lab { display: inline-block; background: var(--green); color: #fff; font-weight: 800; font-size: 13px; padding: 1px 7px; border-radius: 6px; }
  .when { font-size: 15px; } .when b { font-weight: 800; }
  .g2 { color: var(--muted); font-size: 14px; margin-top: 2px; }
  .gid { font-style: italic; font-weight: 400; }
  .g2.warn { color: var(--on-amber); }
  .game { margin-top: 14px; page-break-inside: avoid; }
  .game h3 .when { font-weight: 400; }
  table.rb { border-collapse: collapse; width: 100%; margin-top: 6px; table-layout: fixed; }
  table.rb th, table.rb td { border: 1px solid var(--line); padding: 3px 5px; font-size: 14px; text-align: right; font-variant-numeric: tabular-nums; }
  table.rb th { background: var(--head); text-align: center; vertical-align: bottom; }
  table.rb th .ini { display: block; font-weight: 800; } table.rb th small { display: block; color: var(--muted); font-weight: 500; font-size: 11px; }
  table.rb th .tot { display: block; font-weight: 800; font-size: 15px; }
  table.rb .rn { width: 38px; text-align: left; color: var(--muted); }
  table.rb td.pos { background: var(--win); font-weight: 700; }
  .footer { margin-top: 18px; color: var(--muted); font-size: 13px; font-weight: 600; }
  .link { color: var(--green); font-weight: 700; word-break: break-all; }
`;

/**
 * Phone-width pages at 16 px: Scores · How you got there · Games in this result · one block
 * of rounds per game. expo-print sets the page size (see shareResultsPdf); the CSS only breaks.
 */
export function resultsDetailsHtml(details: ResultsDetails): string {
  const notes = (details.notes ?? []).map((note) => `<p class="note">${escapeHtml(note)}</p>`).join('');
  const footer = `<p class="footer">${details.footer ? escapeHtml(details.footer) : ''}${details.link ? ` · <span class="link">${escapeHtml(details.link)}</span>` : ''}</p>`;
  const pageCss = `
  @page { margin: 0; }
  .page { padding: 20px 16px 28px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .hdr { display: flex; justify-content: space-between; align-items: baseline; }
  `;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>EZ Score: Rummy results</title>
<style>${RESULTS_DESIGN_CSS}${pageCss}</style>
</head>
<body>
<div class="page">
  <p class="brand">EZ Score: Rummy</p>
  <div class="hdr"><h1>${escapeHtml(details.title)}</h1>${details.code ? `<span class="code">${escapeHtml(details.code)}</span>` : ''}</div>
  <p class="meta">${details.dateWord} ${escapeHtml(details.createdAtLabel)}</p>
  <p class="count">${escapeHtml(details.countLine)}</p>
  ${notes}
  <div class="section"><h2>Scores</h2>${scoresSplitHtml(details.scores, details.evenLine)}</div>
  ${footer}
</div>
<div class="page">
  <h2>How you got there · game by game</h2>
  ${bandTableHtml(details.table)}
  ${legendHtml(details.legend)}
  ${footer}
</div>
<div class="page">
  <h2>Games in this result</h2>
  ${details.games.map(gameInfoHtml).join('')}
  ${footer}
</div>
${details.roundTables.length > 0 ? `<div class="page">
  <h2>Round by round</h2>
  ${details.roundTables.map(roundTableHtml).join('')}
  ${footer}
</div>` : ''}
</body>
</html>`;
}

/** One game's rounds as phone pages (the "Share rounds" PDF from the final-scores screen). */
export function roundsPdfHtml(input: { heading: string; lines: string[]; table: ResultsRoundTable; footer: string }): string {
  const lines = input.lines.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(input.heading)}</title>
<style>${RESULTS_DESIGN_CSS}
  @page { margin: 0; }
  .page { padding: 20px 16px 28px; }
</style>
</head>
<body>
<div class="page">
  <p class="brand">EZ Score: Rummy</p>
  <h1>${escapeHtml(input.heading)}</h1>
  ${lines}
  <div class="section"><h2>Round by round</h2>${roundTableHtml(input.table)}</div>
  <p class="footer">${escapeHtml(input.footer)}</p>
</div>
</body>
</html>`;
}

// ---------- plain-text PDF for the web download (no HTML printer in a browser tab) ----------

function pdfEscape(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '-').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function padRight(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

function textTable(header: string[], rows: string[][], firstWidth: number): string[] {
  const line = (cells: string[]) => [padRight(cells[0], firstWidth), ...cells.slice(1).map((cell) => padLeft(cell, 7))].join('');
  return [line(header), ...rows.map(line)];
}

/** A small multi-page PDF of the same details, for the web download. Phones use expo-print on the HTML. */
export function resultsDetailsPdf(details: ResultsDetails): Uint8Array {
  const nameWidth = Math.min(24, Math.max(8, ...details.table.rows.map((row) => row.name.length))) + 2;
  const scoreLine = (row: RankedRow) => padRight(`${row.medal ? `${row.medal}. ` : ''}${row.name}`, nameWidth) + padLeft(row.text, 7) + (row.sub ? `  ${row.sub}` : '');
  const lines: string[] = [
    'EZ Score: Rummy',
    `${details.title}${details.code ? `  ${details.code}` : ''}`,
    `${details.dateWord} ${details.createdAtLabel}`,
    details.countLine,
    ...(details.notes ?? []),
    '',
    'Scores',
    ...details.scores.positive.map(scoreLine),
    ...(details.evenLine ? [details.evenLine] : []),
    ...details.scores.negative.map(scoreLine),
    '',
    'How you got there - game by game',
  ];
  details.table.header.forEach((band, bandIndex) => {
    if (bandIndex > 0) lines.push('');
    lines.push(...textTable(
      ['Player', 'Total', ...band.filter(Boolean)],
      details.table.rows.map((row) => [row.initials, row.total, ...row.bands[bandIndex].filter((cell) => cell.tone !== 'blank').map((cell) => cell.text)]),
      8,
    ));
  });
  lines.push(...details.legend.map(legendText), '', 'Games in this result');
  details.games.forEach((info) => {
    lines.push(`${info.label}  ${info.start.time} ${info.start.date}  ${gameCountsLine(info)}  Game ID ${info.code}`);
    const people = gamePeopleLine(info);
    if (people) lines.push(`  ${people}`);
  });
  if (details.roundTables.length > 0) lines.push('', 'Round by round');
  details.roundTables.forEach((table) => {
    lines.push('', `${table.label}  ${table.start.time} ${table.start.date}  Game ID ${table.code}`);
    if (table.totalsOnly) {
      lines.push(table.initials.map((label, index) => `${label} ${table.totals[index]}`).join('  '), 'Round scores were not saved with this result.');
    } else {
      table.blocks.forEach((block) => {
        lines.push(...textTable(
          ['Rnd', ...block.heads.map((head) => head.initials)],
          [['Total', ...block.heads.map((head) => head.total)], ...block.rows.map((row) => [String(row.round), ...row.cells])],
          7,
        ));
      });
    }
    lines.push(table.initials.map((label, index) => `${label} ${table.names[index]}`).join('  '));
  });
  if (details.footer || details.link) lines.push('', [details.footer, details.link].filter(Boolean).join('  '));
  const pageSize = 42;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) pages.push(lines.slice(index, index + pageSize));
  if (pages.length === 0) pages.push(['EZ Score: Rummy']);

  const objects: string[] = [];
  const pageIds: number[] = [];
  let nextId = 4;
  pages.forEach((page) => {
    const contentId = nextId;
    const pageId = nextId + 1;
    nextId += 2;
    pageIds.push(pageId);
    const text = page.map((line, lineIndex) => {
      const y = 760 - lineIndex * 16;
      return `1 0 0 1 40 ${y} Tm (${pdfEscape(line)}) Tj`;
    }).join('\n');
    const stream = `BT /F1 10 Tf\n${text}\nET`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  const size = objects.length;
  pdf += `xref\n0 ${size}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id < size; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
