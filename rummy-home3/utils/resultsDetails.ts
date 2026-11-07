import { firstAppearanceOrder, initialsById } from '@/utils/playerInitials';
import {
  formatPoints,
  gameColumnLabel,
  sheetGameLabel,
  placeLabel,
  playersByFirstName,
  podiumPlaces,
  ResultStanding,
  scoreCell,
  splitTotals,
} from '@/utils/results';
import { uniquePlayerCount } from '@/utils/resultsLayout';

export type ResultsDetailGame = {
  id: string;
  name: string;
  /** "G7" — the game's own number. */
  label?: string;
  when: string;
  scores: Record<string, number>;
  /** Round-by-round scores, when the games were available. */
  rounds?: Record<string, number[]>;
};

export type ResultsRoundTable = {
  /** "G1" */
  label: string;
  when: string;
  /** Share code or id tail. */
  code: string;
  /** Column headers, one initials per seated player. */
  initials: string[];
  /** Full names in the same order, for the legend. */
  names: string[];
  rows: { round: number; cells: string[] }[];
  totals: string[];
  /** True when the saved result had no rounds to show. */
  totalsOnly: boolean;
};

export type ResultsDetails = {
  title: string;
  createdAtLabel: string;
  gameCount: number;
  /** Players seated in at least one game, counted once. */
  playerCount: number;
  games: { name: string; when: string }[];
  columns: string[];
  rows: { name: string; cells: string[] }[];
  positive: { name: string; points: string }[];
  negative: { name: string; points: string }[];
  places: { label: string; names: string; points: string }[];
  roundTables: ResultsRoundTable[];
  /** "Result ID · ABC123" — the same stable id as on the image. */
  footer?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * One game's rounds: every round, every seated player, game totals.
 * Labels are shared across the whole result (first appearance order) so the
 * same person reads the same in every table; pass them in when there are several games.
 */
export function buildRoundTable(
  game: ResultsDetailGame,
  index: number,
  players: { id: string; name: string }[],
  labels: Map<string, string> = initialsById(firstAppearanceOrder(players, [game])),
): ResultsRoundTable {
  const seated = playersByFirstName(players.filter((player) => Object.prototype.hasOwnProperty.call(game.scores, player.id)));
  const names = seated.map((player) => player.name);
  const initials = seated.map((player) => labels.get(player.id) ?? '?');
  const rounds = game.rounds;
  const roundCount = rounds ? seated.reduce((max, player) => Math.max(max, rounds[player.id]?.length ?? 0), 0) : 0;
  const rows = Array.from({ length: roundCount }, (_, roundIndex) => ({
    round: roundIndex + 1,
    cells: seated.map((player) => {
      const value = rounds?.[player.id]?.[roundIndex];
      return value == null ? '—' : formatPoints(value);
    }),
  }));
  return {
    label: sheetGameLabel(game),
    when: game.when,
    code: game.name,
    initials,
    names,
    rows,
    totals: seated.map((player) => formatPoints(game.scores[player.id] ?? 0)),
    totalsOnly: !rounds || roundCount === 0,
  };
}

/** The PDF and the on-screen table use the same player order and the same cells. */
export function buildResultsDetails(input: {
  createdAtLabel: string;
  standings: ResultStanding[];
  players: { id: string; name: string }[];
  games: ResultsDetailGame[];
  footer?: string;
}): ResultsDetails {
  const players = playersByFirstName(input.players);
  const labels = initialsById(firstAppearanceOrder(input.players, input.games));
  const points = new Map(input.standings.map((row) => [row.id, row.points]));
  const rows = players.map((player) => ({
    name: player.name,
    cells: [
      ...input.games.map((game) => scoreCell(game.scores, player.id)),
      formatPoints(points.get(player.id) ?? 0),
    ],
  }));
  const totals = splitTotals(input.standings);
  const seatedCount = uniquePlayerCount(input.games);
  return {
    title: 'Results',
    createdAtLabel: input.createdAtLabel,
    gameCount: input.games.length,
    playerCount: seatedCount > 0 ? seatedCount : players.length,
    games: input.games.map((game) => ({ name: sheetGameLabel(game), when: game.when })),
    columns: [...input.games.map((game) => gameColumnLabel(game, game.when)), 'Total'],
    rows,
    positive: totals.positive.map((row) => ({ name: row.name, points: formatPoints(row.points) })),
    negative: totals.negative.map((row) => ({ name: row.name, points: formatPoints(row.points) })),
    places: podiumPlaces(input.standings).map((group) => ({
      label: placeLabel(group[0].place),
      names: group.map((row) => row.name).join(', '),
      points: formatPoints(group[0].points),
    })),
    roundTables: input.games.map((game, index) => buildRoundTable(game, index, input.players, labels)),
    ...(input.footer ? { footer: input.footer } : {}),
  };
}

function pointsClass(value: string): string {
  if (value === '—') return 'mute';
  return value.startsWith('-') ? 'neg' : 'pos';
}

function pointsCell(value: string, tag: 'td' | 'th' = 'td'): string {
  return `<${tag} class="num ${pointsClass(value)}">${escapeHtml(value)}</${tag}>`;
}

function totalsTable(heading: string, rows: { name: string; points: string }[]): string {
  const body = rows.length === 0
    ? '<tr><td class="mute" colspan="2">None</td></tr>'
    : rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td>${pointsCell(row.points)}</tr>`).join('');
  return `<div class="totals-col"><h3>${heading}</h3><table class="compact"><tbody>${body}</tbody></table></div>`;
}

function roundTableHtml(table: ResultsRoundTable): string {
  const heading = `<h3>${escapeHtml(table.label)} <span class="when">${escapeHtml(table.when)}</span> <span class="code">${escapeHtml(table.code)}</span></h3>`;
  if (table.initials.length === 0) return `<section class="game">${heading}<p class="mute">No players were seated.</p></section>`;
  const head = `<tr><th>Round</th>${table.initials.map((label) => `<th class="num">${escapeHtml(label)}</th>`).join('')}</tr>`;
  const body = table.rows.map((row) =>
    `<tr><td>${row.round}</td>${row.cells.map((cell) => pointsCell(cell)).join('')}</tr>`).join('');
  const foot = `<tr class="total"><td>Total</td>${table.totals.map((cell) => pointsCell(cell)).join('')}</tr>`;
  const note = table.totalsOnly ? '<p class="mute">Round scores were not saved with this result; game totals only.</p>' : '';
  const legend = table.initials.map((label, index) => `<span><b>${escapeHtml(label)}</b> ${escapeHtml(table.names[index])}</span>`).join(' · ');
  return `<section class="game">${heading}<table class="compact"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>${note}<p class="legend">${legend}</p></section>`;
}

/** Single column, left-aligned, sized for a phone screen. Tables are only as wide as their numbers. */
export function resultsDetailsHtml(details: ResultsDetails): string {
  const games = details.games.map((game) => `<li>${escapeHtml(game.name)} — ${escapeHtml(game.when)}</li>`).join('');
  const places = details.places.map((place) =>
    `<tr><td class="place">${escapeHtml(place.label)}</td><td>${escapeHtml(place.names)}</td>${pointsCell(place.points)}</tr>`).join('');
  const rounds = details.roundTables.map(roundTableHtml).join('');
  const gameWord = details.gameCount === 1 ? 'game' : 'games';
  const playerWord = details.playerCount === 1 ? 'player' : 'players';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>EZ Score: Rummy results</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #17402F; margin: 20px; max-width: 420px; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  h2 { font-size: 16px; margin: 18px 0 6px; }
  h3 { font-size: 13px; margin: 10px 0 4px; }
  p { margin: 0 0 4px; font-size: 13px; }
  ul { margin: 0; padding-left: 18px; font-size: 13px; }
  li { margin: 2px 0; }
  .brand { color: #8A6A1F; font-weight: 800; letter-spacing: 0.4px; font-size: 12px; margin-bottom: 2px; }
  .meta { font-size: 13px; }
  table.compact { border-collapse: collapse; width: auto; }
  table.compact th, table.compact td { border: 1px solid #D7CBB8; padding: 3px 6px; font-size: 12px; text-align: left; white-space: nowrap; }
  table.compact th { background: #17402F; color: #FBF1E1; font-weight: 700; }
  table.compact .num { text-align: right; font-variant-numeric: tabular-nums; min-width: 2.6em; }
  table.compact tfoot td, table.compact tr.total td { font-weight: 800; background: #F3EBDD; }
  .pos { color: #17402F; }
  .neg { color: #B3261E; }
  .mute { color: #7A6E5B; }
  .totals-row { display: flex; flex-direction: row; gap: 16px; align-items: flex-start; }
  .totals-col { min-width: 0; }
  .totals-col h3 { margin-top: 0; }
  td.place { font-weight: 800; }
  .game { margin-top: 8px; page-break-inside: avoid; }
  .when { font-weight: 400; color: #7A6E5B; }
  .code { font-weight: 400; color: #7A6E5B; font-size: 11px; }
  .legend { font-size: 11px; color: #7A6E5B; margin-top: 4px; }
  .legend b { color: #17402F; }
  .footer { margin-top: 16px; font-size: 11px; color: #7A6E5B; font-weight: 700; }
</style>
</head>
<body>
  <p class="brand">EZ Score: Rummy</p>
  <h1>${escapeHtml(details.title)}</h1>
  <p class="meta">Created ${escapeHtml(details.createdAtLabel)}</p>
  <p class="meta">${details.gameCount} ${gameWord} · ${details.playerCount} ${playerWord}</p>
  <ul>${games}</ul>
  <h2>Totals</h2>
  <div class="totals-row">${totalsTable('Positive', details.positive)}${totalsTable('Negative', details.negative)}</div>
  <h2>Top 3</h2>
  <table class="compact"><tbody>${places}</tbody></table>
  <h2>Games</h2>
  ${rounds}
  ${details.footer ? `<p class="footer">${escapeHtml(details.footer)}</p>` : ''}
</body>
</html>`;
}

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
  const nameWidth = Math.min(24, Math.max(8, ...details.rows.map((row) => row.name.length))) + 2;
  const lines: string[] = [
    'EZ Score: Rummy',
    details.title,
    `Created ${details.createdAtLabel}`,
    `${details.gameCount} games  ${details.playerCount} players`,
    ...details.games.map((game) => `${game.name}  ${game.when}`),
    '',
    'Positive totals',
    ...details.positive.map((row) => padRight(row.name, nameWidth) + padLeft(row.points, 7)),
    '',
    'Negative totals',
    ...details.negative.map((row) => padRight(row.name, nameWidth) + padLeft(row.points, 7)),
    '',
    'Top 3',
    ...details.places.map((place) => `${padRight(place.label, 5)}${padRight(place.names, nameWidth)}${padLeft(place.points, 7)}`),
    '',
    'Games',
  ];
  details.roundTables.forEach((table) => {
    lines.push('', `${table.label}  ${table.when}  ${table.code}`);
    lines.push(...textTable(
      ['Round', ...table.initials],
      [...table.rows.map((row) => [String(row.round), ...row.cells]), ['Total', ...table.totals]],
      7,
    ));
    if (table.totalsOnly) lines.push('Round scores were not saved with this result.');
    lines.push(table.initials.map((label, index) => `${label} ${table.names[index]}`).join('  '));
  });
  if (details.footer) lines.push('', details.footer);
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
