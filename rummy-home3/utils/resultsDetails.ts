import {
  formatPoints,
  gameColumnLabel,
  placeLabel,
  playersByFirstName,
  podiumPlaces,
  ResultStanding,
  scoreCell,
  splitTotals,
} from '@/utils/results';

export type ResultsDetailGame = {
  id: string;
  name: string;
  when: string;
  scores: Record<string, number>;
};

export type ResultsDetails = {
  title: string;
  createdAtLabel: string;
  games: { name: string; when: string }[];
  columns: string[];
  rows: { name: string; cells: string[] }[];
  positive: { name: string; points: string }[];
  negative: { name: string; points: string }[];
  places: { label: string; names: string; points: string }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The PDF and the on-screen table use the same player order and the same cells. */
export function buildResultsDetails(input: {
  createdAtLabel: string;
  standings: ResultStanding[];
  players: { id: string; name: string }[];
  games: ResultsDetailGame[];
}): ResultsDetails {
  const players = playersByFirstName(input.players);
  const points = new Map(input.standings.map((row) => [row.id, row.points]));
  const rows = players.map((player) => ({
    name: player.name,
    cells: [
      ...input.games.map((game) => scoreCell(game.scores, player.id)),
      formatPoints(points.get(player.id) ?? 0),
    ],
  }));
  const totals = splitTotals(input.standings);
  return {
    title: 'Results',
    createdAtLabel: input.createdAtLabel,
    games: input.games.map((game, index) => ({ name: `Game ${index + 1}`, when: game.when })),
    columns: [...input.games.map((game, index) => gameColumnLabel(index, game.when)), 'Total'],
    rows,
    positive: totals.positive.map((row) => ({ name: row.name, points: formatPoints(row.points) })),
    negative: totals.negative.map((row) => ({ name: row.name, points: formatPoints(row.points) })),
    places: podiumPlaces(input.standings).map((group) => ({
      label: placeLabel(group[0].place),
      names: group.map((row) => row.name).join(', '),
      points: formatPoints(group[0].points),
    })),
  };
}

export function resultsDetailsHtml(details: ResultsDetails): string {
  const games = details.games.map((game) => `<li>${escapeHtml(game.name)} — ${escapeHtml(game.when)}</li>`).join('');
  const gameHeads = details.games.map((game, index) =>
    `<th><span class="g">Game</span><span class="n">${index + 1}</span><span class="t">${escapeHtml(game.when)}</span></th>`).join('');
  const head = `<th>Player</th>${gameHeads}<th>Total</th>`;
  const body = details.rows.map((row) => {
    const cells = [row.name, ...row.cells].map((value) => `<td>${escapeHtml(value)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const list = (rows: { name: string; points: string }[]) =>
    rows.map((row) => `<li>${escapeHtml(row.name)} ${escapeHtml(row.points)}</li>`).join('') || '<li>None</li>';
  const places = details.places.map((place) => `<li>${escapeHtml(place.label)} ${escapeHtml(place.names)} ${escapeHtml(place.points)}</li>`).join('');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Rummy Home results</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #17402F; margin: 24px; }
  h1 { margin: 0 0 4px; }
  .brand { color: #8A6A1F; font-weight: 800; letter-spacing: 0.4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #D7CBB8; padding: 4px 6px; font-size: 12px; text-align: right; }
  th:first-child, td:first-child { text-align: left; }
  th { background: #17402F; color: #FBF1E1; vertical-align: bottom; }
  th span { display: block; }
  th .g, th .t { font-size: 9px; font-weight: 600; }
  th .n { font-size: 15px; font-weight: 800; }
</style>
</head>
<body>
  <p class="brand">Rummy Home</p>
  <h1>${escapeHtml(details.title)}</h1>
  <p>Created ${escapeHtml(details.createdAtLabel)}</p>
  <h2>Games</h2>
  <ul>${games}</ul>
  <h2>Scores</h2>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <h2>Totals</h2>
  <h3>Positive</h3>
  <ul>${list(details.positive)}</ul>
  <h3>Negative</h3>
  <ul>${list(details.negative)}</ul>
  <h2>Places</h2>
  <ul>${places}</ul>
</body>
</html>`;
}

function pdfEscape(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '-').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** A small multi-page PDF of the same details, for the web download. Phones use expo-print on the HTML. */
export function resultsDetailsPdf(details: ResultsDetails): Uint8Array {
  const lines: string[] = [
    'Rummy Home',
    details.title,
    `Created ${details.createdAtLabel}`,
    '',
    'Games',
    ...details.games.map((game) => `${game.name}  ${game.when}`),
    '',
    'Scores',
    ['Player', ...details.columns].join('  '),
    ...details.rows.map((row) => [row.name, ...row.cells].join('  ')),
    '',
    'Positive totals',
    ...details.positive.map((row) => `${row.name}  ${row.points}`),
    '',
    'Negative totals',
    ...details.negative.map((row) => `${row.name}  ${row.points}`),
    '',
    'Places',
    ...details.places.map((place) => `${place.label}  ${place.names}  ${place.points}`),
  ];
  const pageSize = 42;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageSize) pages.push(lines.slice(index, index + pageSize));
  if (pages.length === 0) pages.push(['Rummy Home']);

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
    const stream = `BT /F1 11 Tf\n${text}\nET`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

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
