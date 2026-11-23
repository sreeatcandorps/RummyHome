import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RECENT_PAGE, recentPaging } from '../utils/homeGames';
import { cellFill, gridColumns, hiddenCells, THREE_COLUMN_PLAYERS } from '../utils/roundEntry';
import { collapseSpaces } from '../utils/playerIdentity';
import { buildFinalScoresSheet, totalsLine } from '../utils/finalScoresSheet';
import { blockCaption, designCss, GAME_PDF_VARS, RESULTS_DESIGN_CSS, roundsPdfHtml, buildRoundTable, UNIQUE_GAME_ID_LABEL } from '../utils/resultsDetails';
import { GAME_BY_GAME_TITLE, UNIQUE_RESULT_ID_LABEL } from '../utils/resultsDesign';
import { resultFooter } from '../utils/results';
import { deleteConsequence } from '../utils/resultsDelete';
import { MAKE_RESULT_FOLD_NOTE } from '../utils/resultsSave';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

const RESULTS_GREEN = /#0E4D2A/i;

// ---------- Home (10.1) ----------

test('10.1 Home: Recent shows twenty, then "Show more" reveals the rest of the bundle before it fetches another page', () => {
  assert.equal(RECENT_PAGE, 20);
  assert.deepEqual(recentPaging(7, 20, false), { visible: 7, action: 'none', hidden: 0 }, 'seven finished games: all shown, no row');
  assert.deepEqual(recentPaging(50, 20, true), { visible: 20, action: 'reveal', hidden: 30 }, 'fifty loaded: twenty shown, thirty to reveal');
  assert.deepEqual(recentPaging(50, 40, true), { visible: 40, action: 'reveal', hidden: 10 });
  assert.deepEqual(recentPaging(50, 60, true), { visible: 50, action: 'fetch', hidden: 0 }, 'everything loaded is shown and the bundle was full: fetch the next page');
  assert.deepEqual(recentPaging(50, 60, false), { visible: 50, action: 'none', hidden: 0 }, 'the bundle was short: nothing more to fetch');
  assert.deepEqual(recentPaging(0, 0, false), { visible: 0, action: 'none', hidden: 0 });
  const home = src('app/(tabs)/index.tsx');
  assert.match(home, /const recentTitle = 'Recent';/, 'no count in the Recent title');
  assert.match(home, /backgroundColor: colors\.surfaceVariant/, 'Recent sits on a grey card');
  assert.match(home, /testID="home-recent-show-more"/);
  assert.doesNotMatch(home, /onEndReached/, 'paging is a tap, never an infinite scroll');
  assert.match(src('services/home.ts'), /loadMore\(player: Player, offset: number\)/);
  assert.match(src('services/games.ts'), /\.range\(offset, offset \+ limit - 1\)/, 'the server page is a range on the existing query');
});

// ---------- Add round (10.6) ----------

test('10.6 Add round: every saved cell is light green whatever the score; three columns from 13 players in portrait; the "N more" count', () => {
  assert.equal(cellFill('confirmed', 40), 'positiveContainer');
  assert.equal(cellFill('confirmed', -80), 'positiveContainer', 'a saved minus is green too — "green = done"');
  assert.equal(cellFill('confirmed', 0), 'positiveContainer');
  assert.equal(cellFill('selected', 0), 'secondaryContainer', 'the cell being edited stays marigold');
  assert.equal(cellFill('neutral', undefined), 'cellNeutral');
  assert.equal(THREE_COLUMN_PLAYERS, 13);
  assert.equal(gridColumns(12, false), 2);
  assert.equal(gridColumns(13, false), 3);
  assert.equal(gridColumns(20, false), 3);
  assert.equal(gridColumns(20, true), 2, 'landscape keeps two wide columns');
  // 14 players in two columns of 7 rows, 80 px pitch, 500 px viewport: rows 7 (and part of 6) are below the fold.
  assert.equal(hiddenCells(14, 2, 80, 0, 500), 2, 'two cells hidden → "2 more ▾"');
  assert.equal(hiddenCells(14, 2, 80, 80, 500), 0, 'scrolled one row: nothing hidden');
  assert.equal(hiddenCells(14, 3, 80, 0, 500), 0, 'three columns: five rows fit, no cue');
  assert.equal(hiddenCells(0, 2, 80, 0, 500), 0);
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /testID="add-round-more"/, 'the pill that scrolls the hidden cells into view');
  assert.match(entry, /gridColumns\(participants\.length, isLandscape\)/);
  assert.doesNotMatch(src('components/game/ScoreCell.tsx'), /styles\.check/, 'v12 point 8: the tick is gone; the green tile and the → total line say scored');
});

// ---------- Add players (10.4) ----------

test('10.4 Add players: heading, F / L placeholders, one RPC per save, Backspace walks back, Done guards unsaved rows, Delete for this visit', () => {
  const screen = src('app/(screens)/players/add.tsx');
  assert.match(screen, /export const ADD_PLAYERS_HEADING = 'Add new players by initials';/);
  assert.match(screen, /export const FIRST_PLACEHOLDER = '';/, 'v12 point 4: no sample letters');
  assert.match(screen, /export const LAST_PLACEHOLDER = '';/);
  assert.match(screen, /return `\$\{saved\} of \$\{NEW_PLAYER_ROWS_MAX\} players saved\. \$\{unsaved\} \$\{unsaved === 1 \? 'row has' : 'rows have'\} one letter only\.`;/, 'the Done pop-up summary (v12 point 3)');
  assert.match(screen, /event\.nativeEvent\.key !== 'Backspace'/, 'Backspace in an empty cell walks back');
  assert.match(screen, /lastInputs\.current\[above\.key\]\?\.focus\(\)/, 'row n cell 1 → row n−1 cell 2');
  assert.match(screen, /testID="add-players-unsaved"/, 'Go back / Discard dialog');
  assert.match(screen, /onDelete=\{deleteRow\}/);
  assert.doesNotMatch(screen, /· Unregistered/, 'the redundant status word is gone');
  const identity = src('services/playerIdentity.ts');
  assert.match(identity, /playersService\.rememberMyPlayer\(ownerId, \{ \.\.\.player, initials: row\.initials \?\? value \}\)/, 'the RPC already added the row to My players: the phone only remembers it');
  const supabaseBranch = identity.slice(identity.indexOf("rpc<any>('create_player_by_initials'"), identity.indexOf('takenBy: row.taken_by'));
  assert.doesNotMatch(supabaseBranch, /addMyPlayer/, 'no second round-trip after create_player_by_initials');
  assert.equal(collapseSpaces('Srikanth  Koneru '), 'Srikanth Koneru', 'doubled spaces collapse on save');
  assert.equal(collapseSpaces('  A \t B  '), 'A B');
});

// ---------- My players / Profile (10.3, 10.5) ----------

test('10.3 / 10.5: your own row says You and offers only Change initials; Profile edits inline with a pencil; passcodes start hidden', () => {
  const players = src('app/(tabs)/players.tsx');
  assert.match(players, /isMe \? <Tag label="You" tone="neutral" \/> : null/);
  assert.match(players, /item === 'my_initials'/);
  assert.match(src('utils/gamePlayers.ts'), /item: 'my_initials', enabled: true/);
  const me = src('app/(tabs)/me.tsx');
  assert.match(me, /testID="me-edit-initials"/);
  assert.match(me, /title="Name" value=\{player\.name\} pen/, 'a small pencil on the row, not a half-width Edit button (Size-S: the row opens a sheet)');
  assert.doesNotMatch(me, />\s*Edit name\s*</, 'the big Edit name button is gone');
  assert.match(me, /setMyInitials/);
  assert.match(src('components/ui/PasscodeField.tsx'), /useState\(false\)/, 'hidden by default; the eye reveals');
  const passcode = src('components/auth/ChangePasscodeDialog.tsx');
  assert.match(passcode, /KeyboardAvoidingView/);
  assert.ok(passcode.indexOf('testID="passcode-current"') < passcode.indexOf('passcodeExplainer') || passcode.indexOf('testID="passcode-current"') < passcode.lastIndexOf('bodySmall'), 'fields first, the sentence below');
});

// ---------- Results (10.7, 10.8) ----------

test('10.7 / 10.8 Results: wording — Game by game, Unique result ID at the foot, the delete note, the Make a result fold', () => {
  assert.equal(GAME_BY_GAME_TITLE, 'Game by game');
  assert.equal(UNIQUE_RESULT_ID_LABEL, 'Unique result ID');
  assert.equal(resultFooter({ resultId: '7f3a2c00-0000-4000-8000-00000000abcd' }), 'Unique result ID · 00ABCD');
  assert.equal(resultFooter({ preview: true }), 'Preview · not saved');
  assert.equal(MAKE_RESULT_FOLD_NOTE, 'Only admins make results');
  assert.match(deleteConsequence(['S14']), /^S14 goes back to Completed \(from Closed\)\. Everyone loses this result\. You can restore it for 30 days from Settings › Hidden & deleted\.$/);
  const page = src('components/results/ResultsPage.tsx');
  assert.match(page, /\{GAME_BY_GAME_TITLE\}/);
  assert.doesNotMatch(page, /How you got there/);
  assert.doesNotMatch(page, /Read-only copy/, 'the raw URL left the page');
  assert.ok(page.indexOf('testID="result-code"') > page.indexOf('<GamesInResult'), 'the Unique result ID sits at the foot, after the games');
  assert.match(page, /Clipboard\.setStringAsync\(resultShortId\(resultId\)\)/, 'tap to copy');
  assert.match(src('app/(screens)/results/[id].tsx'), /title="Copy link"/, 'Copy link lives in the ⋮ menu (Q10.14)');
  assert.doesNotMatch(src('components/results/BandTable.tsx'), />Player<\/Text>/, 'no "Player" header word over the initials');
  const line = src('components/results/PlayerLine.tsx');
  assert.match(line, /numberOfLines=\{2\}/, 'names wrap to a second line on the page…');
  assert.match(line, /adjustsFontSizeToFit/, '…after shrinking a step; never "Harish Gadupu…"');
  for (const rel of ['utils/resultsDetails.ts', 'public/r/index.html', 'components/results/ResultsPage.tsx']) {
    assert.doesNotMatch(src(rel).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''), /How you got there/, `${rel} says Game by game`);
  }
});

// ---------- Share image and colour rule (10.9, 10.11) ----------

test('10.11 colour rule: the game share (card, PDF) carries no results green; results keep it', () => {
  const view = src('components/share/ShareCardView.tsx');
  const gamePalette = view.slice(view.indexOf('GAME_SHARE_COLORS'), view.indexOf('export type SharePalette', view.indexOf('GAME_SHARE_COLORS')) > 0 ? view.indexOf('export type SharePalette', view.indexOf('GAME_SHARE_COLORS')) : undefined);
  assert.doesNotMatch(gamePalette, RESULTS_GREEN, 'the game palette overrides the frame');
  assert.match(view, /frame: '#E9A900'/, 'marigold frame for a game');
  assert.doesNotMatch(JSON.stringify(GAME_PDF_VARS), RESULTS_GREEN);
  assert.match(RESULTS_DESIGN_CSS, RESULTS_GREEN, 'results CSS keeps the green');
  assert.doesNotMatch(designCss('game'), RESULTS_GREEN, 'the game PDF CSS has none of it');
  assert.equal(designCss('results'), RESULTS_DESIGN_CSS);
  const game = { id: 'g', shareCode: 'EJMEYV', gameNumber: 10, gameLabel: 'S10', date: '2026-11-09T19:00:00', completedAt: '2026-11-09T22:00:00', isComplete: true };
  const players = Array.from({ length: 14 }, (_, index) => ({ id: `p${index}`, name: `Player ${index + 1}`, playerNo: 30 + index }));
  const scores = Object.fromEntries(players.map((player, index) => [player.id, [index === 0 ? 130 : -10, 0, index === 13 ? 40 : 0]]));
  const sheet = buildFinalScoresSheet({ game, players, scores });
  assert.equal(sheet.card.tone, 'game');
  assert.equal(sheet.card.title, 'Final scores · S10');
  assert.equal(sheet.card.positive.length + sheet.card.negative.length, 14, 'never cut');
  assert.equal(sheet.card.layout, 'balanced', '13 negatives pass ten a side');
  const html = roundsPdfHtml({ heading: sheet.heading, lines: [], table: sheet.table, footer: sheet.footer });
  assert.doesNotMatch(html, RESULTS_GREEN);
  assert.match(html, /<p class="cap">Players 1–5 of 14<\/p>/);
  assert.match(html, /<p class="cap">Players 11–14 of 14<\/p>/);
  assert.match(html, /<table class="rb n4">/, 'the last block is four players wide at the five-player column width');
  assert.doesNotMatch(html, /<th>[^<]*<span class="ini">[^<]*<\/span><small>#/, 'no Player IDs in the heads');
  assert.match(html, /<small>· #30<\/small>/, 'the Player ID is in the legend');
  assert.equal((html.match(/EJMEYV/g) ?? []).length, 1, 'the Game ID once…');
  assert.match(html, new RegExp(`<p class="footer">Game S10 · ${UNIQUE_GAME_ID_LABEL} · EJMEYV</p>`), '…at the foot');
  assert.doesNotMatch(html, /\.game \{[^}]*page-break-inside/, 'the gap-and-jump fix: no avoid on the whole game');
  assert.equal(totalsLine(0), 'Totals add to 0');
  assert.equal(totalsLine(40), 'Totals add to +40');
  assert.equal(totalsLine(-40), 'Totals add to -40');
  assert.equal(sheet.totalSum, 40);
});

test('10.9 share capture: a fixed 540 dp layout scaled to a 1080 px picture, captured off-screen on every surface', () => {
  const view = src('components/share/ShareCardView.tsx');
  assert.match(view, /export const SHARE_RENDER_WIDTH = 540;/);
  assert.match(view, /export const SHARE_IMAGE_WIDTH = 1080;/);
  assert.match(view, /numberOfLines=\{1\}\s+adjustsFontSizeToFit\s+minimumFontScale=\{0\.85\}/, 'a name shrinks a step, then ends with an ellipsis — one line');
  assert.doesNotMatch(view, /card\.code|card\.link|card\.moreLine/, 'no code, link or "and N more" on the picture');
  const offscreen = src('components/share/OffscreenShareCard.tsx');
  assert.match(offscreen, /left: -SHARE_RENDER_WIDTH \* 4/);
  assert.match(offscreen, /<ShareCardView card=\{card\} cardRef=\{cardRef\} fixed onLayoutHeight=\{onHeight\}/);
  assert.match(src('components/share/ShareImageDialog.tsx'), /shareCardImage\(capture\.ref\.current, card, capture\.size\)/);
  assert.match(src('app/(screens)/games/final-scores.tsx'), /shareFinalScoresImage\(sheet, capture\.ref\.current, capture\.size\)/);
  const web = src('utils/shareImage.ts');
  assert.match(web, /canvas\.width = SHARE_IMAGE_WIDTH;/, 'the web canvas is the same 1080 px wide');
  assert.match(web, /ctx\.scale\(scale, scale\);/);
  assert.doesNotMatch(web, /card\.moreLine|card\.code|card\.link/);
});

// ---------- PDFs (10.10, 10.12) ----------

test('10.10 / 10.12 PDF helpers: block captions, legend IDs, file names with the ID, icon beside the brand', () => {
  assert.equal(blockCaption(0, 5, 14), 'Players 1–5 of 14');
  assert.equal(blockCaption(2, 4, 14), 'Players 11–14 of 14');
  assert.equal(blockCaption(0, 3, 3), null, 'one block needs no caption');
  const table = buildRoundTable({ id: 'g', name: 'C0DE', label: 'S1', scores: { a: 10, b: -10 }, rounds: { a: [10], b: [-10] } }, 0, [{ id: 'a', name: 'Ada', playerNo: 7 }, { id: 'b', name: 'Bea', playerNo: null }]);
  assert.deepEqual(table.playerNos, [7, null]);
  const pdf = src('utils/shareResultsPdf.ts');
  assert.match(pdf, /resultsPdfFileName\(resultId, createdAt \?\? new Date\(\)\)/);
  assert.match(pdf, /require\('\.\.\/assets\/icon-small\.png'\)/, 'the app icon rides along as a data URI (Q10.17)');
  assert.match(pdf, /iconDataUri: await pdfIconDataUri\(\)/);
  assert.match(pdf, /gamePdfFileName\(sheet\.table\.label\)/);
  assert.match(src('utils/resultsDetails.ts'), /\.brand-icon \{ width: 24px; height: 24px;/);
});
