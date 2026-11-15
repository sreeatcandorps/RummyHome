import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { formatWhen, formatWhenDay, formatWhenTime } from '../utils/formatWhen';
import { formatWhen as sheetFormatWhen, finalScoresHeading } from '../utils/finalScoresSheet';
import { formatLogWhen } from '../utils/eventLog';
import { startParts } from '../utils/resultsDesign';
import { screenTitle } from '../utils/gameLabel';
import { PLAYERS_ADMINS_TITLE } from '../utils/gameAdmins';
import { gameSettingsMenuTitle } from '../utils/gameSettings';
import { nextLabel } from '../utils/addPlayers';
import { playerIdBadge as listBadge } from '../utils/myPlayersList';
import { playerIdBadge as seatBadge } from '../utils/gamePlayers';
import { sameAwards } from '../utils/poolAwards';
import { Game } from '../types/game';

// Design audit PR 15a (docs/design-audit.md §1, §4): the P1 findings A01 A08 A11 A03 A05 and the cheap P2 A02 A06 A10,
// plus the three Help-spec items Q11.12, Q11.14, Q11.18. Pure helpers are called; screens are read as text.

const root = process.cwd();
const src = (file: string) => readFileSync(path.join(root, file), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}
const screenFiles = () => [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))].map((f) => path.relative(root, f));

const game = { id: 'g1', gameLabel: 'S3', shareCode: 'ABC12' } as unknown as Game;

// ---- A02: "Screen · S1", centred, one pattern (DC15-2) ----

test('DC15-2: every game screen title is "Screen · S3" via screenTitle; a game without a label keeps the bare screen name', () => {
  assert.equal(screenTitle('Scorecard', game), 'Scorecard · S3');
  assert.equal(screenTitle('Complete', game), 'Complete · S3');
  assert.equal(screenTitle('Awards', game), 'Awards · S3');
  assert.equal(screenTitle('Log', game), 'Log · S3');
  assert.equal(screenTitle(PLAYERS_ADMINS_TITLE, game), 'Players · Admins · S3');
  assert.equal(PLAYERS_ADMINS_TITLE, 'Players · Admins');
  assert.equal(finalScoresHeading(game), 'Final scores · S3');
  assert.equal(screenTitle('Scorecard', null), 'Scorecard');
  assert.equal(screenTitle('Scorecard', { id: 'x' } as unknown as Game), 'Scorecard');
  for (const title of ['Scorecard · S3', 'Complete · S3', 'Final scores · S3', 'Players · Admins · S3', 'Awards · P1', 'Log']) {
    assert.match(title, /^[A-Z][a-z]+( · [A-Z][a-z]+| [a-z]+)*( · [SP]\d+)?$/, title);
  }
});

test('DC15-2: the screens use screenTitle, none sets headerTitleAlign, and the stack defaults carry no alignment', () => {
  assert.match(src('app/(screens)/games/[id].tsx'), /title: screenTitle\('Scorecard', game\)/);
  assert.match(src('app/(screens)/games/complete.tsx'), /screenTitle\('Complete', game\)/);
  assert.match(src('app/(screens)/games/award.tsx'), /screenTitle\('Awards', game\)/);
  assert.match(src('app/(screens)/games/log.tsx'), /screenTitle\('Log', game\)/);
  assert.match(src('app/(screens)/games/players.tsx'), /screenTitle\(PLAYERS_ADMINS_TITLE, game\)/);
  assert.match(src('app/(screens)/games/final-scores.tsx'), /title: sheet \? sheet\.heading : 'Final scores'/);
  for (const file of screenFiles()) {
    assert.doesNotMatch(src(file), /headerTitleAlign/, `${file} sets headerTitleAlign (A02: every title centred, the default)`);
  }
  const layout = src('app/(screens)/_layout.tsx');
  assert.match(layout, /title: 'Scorecard'/);
  assert.match(layout, /title: 'Complete'/);
  assert.match(layout, /title: 'Players · Admins'/);
  assert.doesNotMatch(layout, /Players\/Admins|Players & Admins/);
});

// ---- A06: one date format (DC15-3) ----

test('DC15-3: formatWhen is "Sat, Nov 14 · 7:49 PM", the year only when it is not this year, and every formatter resolves to it', () => {
  const now = new Date(2026, 10, 15, 12, 0);
  const thisYear = new Date(2026, 10, 14, 19, 49);
  const lastYear = new Date(2025, 10, 14, 19, 49);
  assert.equal(formatWhen(thisYear, now), 'Sat, Nov 14 · 7:49 PM');
  assert.equal(formatWhen(lastYear, now), 'Fri, Nov 14, 2025 · 7:49 PM');
  assert.equal(formatWhen(thisYear.toISOString(), now), 'Sat, Nov 14 · 7:49 PM', 'ISO strings too');
  assert.equal(formatWhenDay(lastYear, now), 'Fri, Nov 14, 2025');
  assert.equal(formatWhenTime(new Date(2026, 0, 1, 0, 7)), '12:07 AM');
  assert.equal(formatWhen('nonsense'), 'Unknown date');
  assert.equal(formatWhen(undefined), 'Unknown date');
  assert.equal(formatWhen(null), 'Unknown date');
  assert.equal(formatWhenDay('nonsense'), '');

  const iso = thisYear.toISOString();
  assert.match(src('utils/gameDisplay.ts'), /return formatWhen\(value\);/, 'Home cards (gameDisplay pulls in the theme, so it is read as text)');
  assert.equal(sheetFormatWhen(iso), formatWhen(iso), 'final scores / saved results');
  assert.equal(formatLogWhen(iso), formatWhen(iso), 'result History');
  const parts = startParts(iso, now);
  assert.equal(parts.date, 'Sat, Nov 14', 'Games in this result: the same short weekday + month');
  assert.equal(parts.time, '7:49 PM');
});

test('DC15-3: screens and helpers call no toLocaleDateString / toLocaleTimeString of their own; the ID badge is "#N" everywhere', () => {
  const files = [...screenFiles(), ...walk(path.join(root, 'utils')).map((f) => path.relative(root, f))]
    .filter((f) => f !== 'utils/formatWhen.ts' && !/\.test\.tsx?$/.test(f));
  for (const file of files) {
    const text = src(file);
    assert.doesNotMatch(text, /toLocaleDateString|toLocaleTimeString/, `${file} formats a date on its own (A06: import formatWhen)`);
  }
  // eventLog keeps its relative "Today / Yesterday" day label and the bare time, both built on formatWhen's pieces.
  assert.match(src('utils/eventLog.ts'), /import \{ formatWhen, formatWhenDay, formatWhenTime \} from '@\/utils\/formatWhen'/);
  assert.equal(listBadge({ playerNo: 42, playerCode: null }), '#42');
  assert.equal(seatBadge({ playerNo: 42, playerCode: 'OLD' }), '#42');
  assert.equal(listBadge({ playerNo: null, playerCode: 'OLD' }), null, 'My players: no numeric ID → no badge');
  assert.doesNotMatch(src('app/(tabs)/players.tsx'), /Player ID \$\{|`ID \$\{/, 'no "Player ID 42" spelling in the roster');
  assert.doesNotMatch(src('components/ui/GameListItem.tsx'), /Player ID/, 'nor on game cards');
});

test('A06: "Games in this result" reads date first, then the time — on screen, in the PDF and in the text share', () => {
  const screen = src('components/results/GamesInResult.tsx');
  const dateIdx = screen.indexOf('info.start.date');
  const timeIdx = screen.indexOf('info.start.time');
  assert.ok(dateIdx > 0 && timeIdx > dateIdx, 'the date renders before the time');
  const details = src('utils/resultsDetails.ts');
  assert.match(details, /\$\{escapeHtml\(info\.start\.date\)\} · <b>\$\{escapeHtml\(info\.start\.time\)\}<\/b>/);
  assert.match(details, /\$\{info\.label\}  \$\{info\.start\.date\} · \$\{info\.start\.time\}/);
  assert.doesNotMatch(src('utils/resultsDesign.ts'), /weekday: 'long'/, 'no "Thursday, November 5" long form (A06)');
});

// ---- A01 / A11: the game yellow for anything that is a game, result green only for results (DC15-4) ----

test('DC15-4: the Results picker selected card and the game number square use the game tokens; the "Results" tag and past-result border use the result tokens', () => {
  const card = src('components/ui/GameListItem.tsx');
  assert.match(card, /backgroundColor: on \? theme\.colors\.secondaryContainer : theme\.colors\.surface/, 'A01: selected card fill is the game yellow');
  assert.match(card, /borderColor: on \? theme\.colors\.secondary : theme\.colors\.outlineVariant/, 'A01: selected card ring is the game yellow');
  assert.doesNotMatch(card, /(backgroundColor|borderColor): on \? theme\.colors\.primary/, 'A01: no result green fill or ring on a selected game card (the check mark keeps the brand green)');
  assert.doesNotMatch(card, /selected \? theme\.colors\.(primary|onPrimary|primaryContainer|tertiary)/, 'A11: the number square never turns green/blue when selected');
  assert.match(card, /game-card-checked-\$\{game\.shareCode \?\? game\.id\}/, 'the checked state has a testID for the flows');
  const tag = src('components/ui/Tag.tsx');
  assert.match(tag, /results: \{ bg: colors\.primaryContainer, fg: colors\.onPrimaryContainer \}/, 'the "Results" tag is the result green');
  assert.match(src('app/(screens)/results/index.tsx'), /borderLeftColor: colors\.primary\b/, 'past result cards carry the result green edge');
  assert.match(src('components/results/GamesInResult.tsx'), /backgroundColor: colors\.secondaryContainer/, 'a game label chip inside a result is the game yellow');
  assert.match(src('app/(screens)/score-entry.tsx'), /gameBadge, \{ backgroundColor: colors\.secondaryContainer \}/, 'A11: the Add round game badge is the game yellow');
});

// ---- A08: one ActionBar; My players tiles above the tab bar ----

test('A08: ActionBar — two actions at most, primary filled right, secondary outlined left, a disabled primary says why', () => {
  const bar = src('components/ui/ActionBar.tsx');
  assert.match(bar, /primary: ActionBarAction & \{ disabledLabel\?: string \}/);
  assert.match(bar, /secondary\?: ActionBarAction/);
  assert.match(bar, /primary\.disabled && primary\.disabledLabel \? primary\.disabledLabel : primary\.label/);
  assert.match(bar, /mode="outlined"[\s\S]*?style=\{styles\.secondary\}/);
  assert.match(bar, /mode="contained"[\s\S]*?style=\{styles\.primary\}/);
  assert.match(bar, /<BottomBar style=\{style\} insetBottom=\{insetBottom\}>/);
  assert.match(src('components/ui/BottomBar.tsx'), /insetBottom\?: boolean/);
  assert.match(src('components/ui/BottomBar.tsx'), /\(insetBottom \? insets\.bottom : 0\)/);
  for (const file of ['app/(screens)/games/complete.tsx', 'app/(screens)/games/final-scores.tsx', 'app/(screens)/games/award.tsx']) {
    assert.match(src(file), /<ActionBar/, `${file} uses the ActionBar`);
  }
  assert.equal(nextLabel(0), 'Next · pick 2+ players');
  assert.equal(nextLabel(1), 'Next · pick 1 more player');
  assert.equal(nextLabel(4), 'Next · 4 players');
  assert.match(src('app/(screens)/games/new.tsx'), /\{nextLabel\(seatedCount\)\}/, 'New game: the disabled Next says why');
});

test('A08: My players action tiles live in a BottomBar outside the scroll, with no gesture inset of their own (the tab bar has it)', () => {
  const page = src('app/(tabs)/players.tsx');
  const screenClose = page.lastIndexOf('</Screen>');
  const bar = page.indexOf('<BottomBar fullWidth insetBottom={false} style={styles.actions} testID="my-players-actions">');
  assert.ok(bar > screenClose && screenClose > 0, 'the bar comes after the scrolling Screen');
  assert.match(page, /actions: \{\s*alignItems: 'stretch',?\s*\}/);
  assert.match(page, /placeholder=\{SEARCH_PLACEHOLDER\}/, 'A07 prep: the one search placeholder');
  const flow = readFileSync(path.join(root, 'e2e/smoke/08-my-players.yaml'), 'utf8');
  assert.match(flow, /id: "my-players-actions"/, 'DC15-5: the smoke flow asserts the bar is on screen');
});

// ---- A05: dismiss / confirm wording ----

test('A05: Cancel on every confirm, the confirming verb repeats the title, notices say OK, info sheets Close; no bar button returns to the scorecard', () => {
  const files = screenFiles();
  for (const file of files) {
    const text = src(file);
    assert.doesNotMatch(text, />\s*Not yet\s*</, `${file}: "Not yet" (A05: Cancel)`);
    assert.doesNotMatch(text, />\s*Got it\s*</, `${file}: "Got it" (A05: OK)`);
    // The one exception: Add round's "could not open" state has no header, so its button is the way back.
    if (file !== 'app/(screens)/score-entry.tsx') assert.doesNotMatch(text, />\s*Back to scorecard\s*<\/Button>/, `${file}: a bar button back to the scorecard (A05: header arrow only)`);
  }
  const results = src('app/(screens)/results/index.tsx');
  assert.match(results, /<Dialog\.Title>Deselect games\?<\/Dialog\.Title>[\s\S]*?testID="deselect-confirm">Deselect<\/Button>/, 'the verb repeats the title');
  assert.match(results, /accessibilityLabel="Keep the selection">Cancel<\/Button>/);
  assert.match(results, /<Button onPress=\{\(\) => setNeedsAwards\(null\)\}>Not now<\/Button>/, '"Not now" stays only where the other button leaves the screen');
  const complete = src('app/(screens)/games/complete.tsx');
  assert.match(complete, /disabled=\{completing\}>Cancel<\/Button>/);
  assert.match(complete, /secondary=\{\{ label: 'Cancel'/, 'the Complete bar pairs Cancel with Complete game');
  assert.doesNotMatch(complete, /Back to scorecard/);
  const players = src('app/(screens)/games/players.tsx');
  assert.doesNotMatch(players, /Back to scorecard/, 'Players · Admins: the header arrow is the way back');
  assert.match(players, /testID="players-add-new">\s*Add new player\s*<\/Button>/);
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /<IconButton icon="arrow-left" onPress=\{closeScreen\} accessibilityLabel="Back to scorecard"[^>]*testID="score-entry-back"/, 'Add round: a header arrow');
  assert.doesNotMatch(entry, /<Menu\.Item[^>]*title="Back to scorecard"/, 'not a ⋮ item');
});

// ---- A10: sentence-case section headings ----

test('A10: the saved result page has no UPPERCASE letter-spaced section headings', () => {
  const page = src('components/results/ResultsPage.tsx');
  assert.doesNotMatch(page, /textTransform: 'uppercase'/);
  assert.doesNotMatch(page, /letterSpacing/);
  assert.match(page, /section: \{ fontWeight: '800' \}/);
  assert.match(page, />Scores<\/Text>/);
  assert.match(page, />Games in this result<\/Text>/);
});

// ---- Q11.12 / Q11.14 / Q11.18 (Help-spec items folded into 15a) ----

test('Q11.12: the ⋮ item says "Game settings · locked" once a pool has saved rounds, on the scorecard and on Add round', () => {
  assert.equal(gameSettingsMenuTitle(true, 0), 'Game settings');
  assert.equal(gameSettingsMenuTitle(true, 1), 'Game settings · locked');
  assert.equal(gameSettingsMenuTitle(false, 9), 'Game settings', 'Rummy settings never lock');
  assert.match(src('app/(screens)/games/[id].tsx'), /title=\{gameSettingsMenuTitle\(pool, maxRounds\)\} testID="game-menu-settings"/);
  assert.match(src('app/(screens)/games/[id].tsx'), /leadingIcon=\{pool && maxRounds > 0 \? 'lock-outline' : 'cog-outline'\}/);
  assert.match(src('app/(screens)/score-entry.tsx'), /title=\{gameSettingsMenuTitle\(pool, nextRoundNumber\(game\) - 1\)\}/);
});

test('Q11.14: once the awards are saved and unchanged, the Awards bar is Cancel + "Add to Results"; with edits it is Cancel + Save', () => {
  const award = src('app/(screens)/games/award.tsx');
  assert.match(award, /game\.awardedAt && sameAwards\(sheet, game\.prizeShares\)/);
  assert.match(award, /label: 'Add to Results', icon: 'format-list-numbered'[\s\S]*?testID: 'award-add-to-results'/);
  assert.match(award, /router\.push\('\/\(screens\)\/results'\)/);
  assert.match(award, /testID: 'award-save'/);
  const sheet = { shares: [{ playerId: 'a', share: 60 }, { playerId: 'b', share: 40 }] } as unknown as Parameters<typeof sameAwards>[0];
  assert.equal(typeof sameAwards(sheet, null), 'boolean');
  assert.equal(sameAwards(sheet, null), false, 'nothing saved yet → not the same');
});

test('Q11.18: Add new players has a header Back arrow that behaves like Done; the back gesture does too', () => {
  const add = src('app/(screens)/players/add.tsx');
  assert.match(add, /headerLeft: \(\) => <IconButton icon="arrow-left" onPress=\{\(\) => doneRef\.current\(\)\}[^>]*testID="add-players-back"/);
  assert.match(add, /gestureEnabled: true/);
  assert.match(add, /event\.preventDefault\(\);\s*doneRef\.current\(\);/, 'a swipe or hardware back routes through Done (unsaved letters ask first)');
  assert.match(add, /doneRef\.current = done;/);
  assert.doesNotMatch(add, /headerLeft: \(\) => null/);
  const layout = src('app/(screens)/_layout.tsx');
  const addRoute = layout.slice(layout.indexOf("title: 'Add new players'"), layout.indexOf("title: 'Add new players'") + 200);
  assert.doesNotMatch(addRoute, /gestureEnabled: false/, 'the layout no longer blocks the gesture');
});

// ---- Flows keep up with the renamed titles and the removed buttons ----

test('e2e: no flow waits for the old "Scorecard" / "Final scores · Game" titles or taps "Back to scorecard" / "Not yet"', () => {
  const flows = walk(path.join(root, 'e2e')).filter((f) => f.endsWith('.yaml'));
  const yamls = readdirSync(path.join(root, 'e2e'), { recursive: true }) as string[];
  const files = yamls.filter((f) => f.endsWith('.yaml')).map((f) => path.join(root, 'e2e', f));
  assert.ok(files.length > 20, `found ${files.length} flows`);
  for (const file of files.length ? files : flows) {
    const text = readFileSync(file, 'utf8');
    const rel = path.relative(root, file);
    assert.doesNotMatch(text, /visible: "Scorecard"\n/, `${rel}: the title is now "Scorecard · S1" — match "Scorecard( · .*)?"`);
    assert.doesNotMatch(text, /"Final scores · Game/, `${rel}: the title is now "Final scores · S1"`);
    assert.doesNotMatch(text, /tapOn: "Back to scorecard"/, `${rel}: that button is gone (A05) — use "- back"`);
    assert.doesNotMatch(text, /"Not yet"/, `${rel}: "Not yet" is "Cancel" now (A05)`);
  }
});
