import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RESULT_UNSAVED_BANNER, resultShareNotes, resultWarningLines } from '../utils/resultsSave';
import { buildResultsShareCard } from '../utils/shareCard';
import { buildResultsDetails, resultsDetailsHtml, resultsDetailsPdf } from '../utils/resultsDetails';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

const games = [
  { id: 'g1', name: 'A1', label: 'G1', date: '2026-11-09T10:00:00.000Z', isComplete: true, closedAt: '2026-11-09T12:00:00.000Z', createdBy: 'me', adminIds: ['me'], players: ['me', 'p'], scores: { me: [10], p: [-10] } },
  { id: 'g2', name: 'A2', label: 'G2', date: '2026-11-10T10:00:00.000Z', isComplete: false, closedAt: null, createdBy: 'me', adminIds: ['me'], players: ['me', 'p'], scores: { me: [5], p: [-5] } },
] as unknown as Parameters<typeof resultWarningLines>[0];

test('item 4: the share notes are the banner first, then every warning line, and nothing when saved and clean', () => {
  const warnings = resultWarningLines(games);
  assert.equal(warnings.length, 2, 'one active, one counted before');
  const unsaved = resultShareNotes(warnings, false);
  assert.equal(unsaved[0], RESULT_UNSAVED_BANNER);
  assert.equal(RESULT_UNSAVED_BANNER, 'Not saved yet. This result may change.');
  assert.deepEqual(unsaved.slice(1), warnings.map((w) => w.text));
  assert.deepEqual(resultShareNotes(warnings, true), warnings.map((w) => w.text), 'a saved result keeps its warnings but loses the banner');
  assert.deepEqual(resultShareNotes([], true), []);
});

test('item 4: the picture and the PDF carry the same notes as the screen, and the saved date once saved', () => {
  const rows = [{ id: 'me', name: 'Me', points: 15, place: 1 }, { id: 'p', name: 'Priya', points: -15, place: 2 }];
  const sheetGames = [
    { id: 'g1', name: 'A1', label: 'G1', date: '2026-11-09', scores: { me: 10, p: -10 } },
    { id: 'g2', name: 'A2', label: 'G2', date: '2026-11-10', scores: { me: 5, p: -5 } },
  ];
  const players = [{ id: 'me', name: 'Me' }, { id: 'p', name: 'Priya' }];
  const notes = resultShareNotes(resultWarningLines(games), false);

  const standings = rows.map((row) => ({ ...row, games: 2 }));
  const card = buildResultsShareCard({ standings, games: sheetGames, players, createdAtLabel: 'Nov 10', notes, footer: 'Preview · not saved' });
  assert.deepEqual(card.notes, notes);
  assert.equal(buildResultsShareCard({ standings, games: sheetGames, createdAtLabel: 'x', notes: [] }).notes, undefined, 'no empty notes block');

  const detailGames = sheetGames;
  const preview = buildResultsDetails({ createdAtLabel: 'Nov 10, 2026', standings, players, games: detailGames, notes, footer: 'Preview · not saved' });
  assert.equal(preview.dateWord, 'Created');
  assert.deepEqual(preview.notes, notes);
  const html = resultsDetailsHtml(preview);
  assert.match(html, /Created Nov 10, 2026/);
  assert.match(html, /<p class="note">Not saved yet\. This result may change\.<\/p>/);
  assert.match(html, /is still active/);
  const pdfText = Buffer.from(resultsDetailsPdf(preview)).toString('latin1');
  assert.match(pdfText, /Not saved yet\. This result may change\./);

  const saved = buildResultsDetails({ createdAtLabel: 'Nov 10, 2026', standings, players, games: detailGames, saved: true, footer: 'Result ID · ABC123' });
  assert.equal(saved.dateWord, 'Saved');
  assert.equal(saved.notes, undefined);
  assert.match(resultsDetailsHtml(saved), /Saved Nov 10, 2026/);
});

test('item 4: one Save button on the screen, Share allowed before saving, saved screen shows the saved date', () => {
  const header = src('components/results/ResultsShare.tsx');
  assert.doesNotMatch(header, /content-save-outline/, 'the header Save icon is gone');
  assert.doesNotMatch(header, /shareEnabled/, 'Share is not gated on saving');
  assert.match(header, /disabled=\{!card\}/);

  const view = src('app/(screens)/results/view.tsx');
  assert.equal((view.match(/icon="content-save-outline"/g) ?? []).length, 1, 'exactly one Save button');
  assert.match(view, /testID="results-unsaved-banner"/);
  assert.match(view, /\{RESULT_UNSAVED_BANNER\}/);
  assert.match(view, /resultShareNotes\(warnings, false\)/);
  assert.match(view, /saved: false,/);
  assert.doesNotMatch(view, /saved\b[^:]*<ResultsPage/, 'the preview page never says Saved');

  const savedScreen = src('app/(screens)/results/[id].tsx');
  assert.match(savedScreen, /resultShareNotes\(warnings, true\)/);
  assert.match(savedScreen, /createdAtLabel: formatGameDateTime\(result\.declaredAt\),\s*resultId: result\.id,/, 'the card says Saved because it has a result id');
  assert.match(savedScreen, /<ResultsPage\s+createdAt=\{result\.declaredAt\}\s+saved\s/);
  assert.match(src('components/results/ResultsPage.tsx'), /saved \? `Saved \$\{formatGameDateTime\(createdAt\)\}` : formatGameDateTime\(createdAt\)/);
  assert.match(src('components/share/ShareCardView.tsx'), /card\.notes\?\.map/);
});
