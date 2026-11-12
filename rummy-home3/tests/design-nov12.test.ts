import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { appearanceFromSettings, APPEARANCE_OPTIONS, resolveDarkMode } from '../utils/appearance';
import { ACCESS_TONE, gameAccessLabel, viewerManagesGame, visibleRoleTag } from '../utils/gameAccess';
import { GAME_STATUS_TONE } from '../utils/gameStatus';
import { REGISTRATION_ICON, REGISTRATION_TONE } from '../utils/myPlayersList';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (path: string) => readFileSync(join(root, path), 'utf8');

const walk = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : rel.endsWith('.tsx') ? [rel] : [];
  });

test('design: Clubhouse tokens — button green with a pressable edge, light and dark, and no green text for scores', () => {
  const theme = src('constants/theme.ts');
  assert.match(theme, /primary: '#15803D'/);
  assert.match(theme, /primaryEdge: '#0E5A2A'/);
  assert.match(theme, /primary: '#5FD68E'/);
  assert.match(theme, /primaryEdge: '#2E9E5C'/);
  assert.match(theme, /secondaryContainer: '#FFE38A'/, 'marigold accent');
  assert.match(theme, /background: '#F6F6F1'/);
  assert.match(theme, /background: '#0F1412'/);
  // Positive scores read near-black, not green; seat 1 is teal so an avatar never looks like a button.
  assert.match(theme, /positive: '#17201B'/);
  assert.match(theme, /positive: '#EAEDE9'/);
  assert.match(theme, /'#0F766E'/, 'seat 1 teal');
  assert.match(theme, /export const seatColor = \(index: number, options\?: \{ onDark\?: boolean \}\)/);
  assert.match(src('app.json'), /"userInterfaceStyle": "automatic"/);
});

test('design: appearance follows the phone by default; the saved dark switch still means Dark', () => {
  assert.deepEqual(APPEARANCE_OPTIONS.map((o) => o.value), ['system', 'light', 'dark']);
  assert.equal(appearanceFromSettings(undefined), 'system');
  assert.equal(appearanceFromSettings({}), 'system');
  assert.equal(appearanceFromSettings({ darkMode: true }), 'dark');
  assert.equal(appearanceFromSettings({ darkMode: false }), 'system');
  assert.equal(appearanceFromSettings({ appearance: 'light', darkMode: true }), 'light', 'an explicit appearance wins');
  assert.equal(resolveDarkMode('system', 'dark'), true);
  assert.equal(resolveDarkMode('system', 'light'), false);
  assert.equal(resolveDarkMode('system', null), false);
  assert.equal(resolveDarkMode('dark', 'light'), true);
  assert.equal(resolveDarkMode('light', 'dark'), false);
});

test('design: one button standard — every Button comes from AppButton; pill, 2 px outline, 4 px edge', () => {
  const button = src('components/ui/AppButton.tsx');
  assert.match(button, /export const BUTTON_EDGE = 4/);
  assert.match(button, /export const BUTTON_MIN_HEIGHT = 48/);
  assert.match(button, /pill: \{ borderRadius: 999 \}/);
  assert.match(button, /outlined && \{ borderWidth: 2/);
  assert.match(button, /borderBottomWidth: BUTTON_EDGE/);
  assert.match(button, /fontSize: 16, lineHeight: 20, fontWeight: '800'/);

  const paperButtonImport = /import \{[^}]*\bButton\b[^}]*\} from 'react-native-paper'/;
  for (const file of [...walk('app'), ...walk('components')]) {
    if (file.endsWith('AppButton.tsx')) continue;
    const text = src(file);
    const match = text.match(paperButtonImport);
    if (match && !/\b(Icon|Toggle|Segmented)Button/.test(match[0]) && /[{,\s]Button[,\s}]/.test(match[0])) {
      assert.fail(`${file} imports Button from react-native-paper; use components/ui/AppButton`);
    }
  }
});

test('design: bottom-bar and tab pills — outlined by default, the one main action filled with its edge', () => {
  const action = src('components/ui/StackedAction.tsx');
  assert.match(action, /borderWidth: 2/);
  assert.match(action, /borderRadius: radius\.full/);
  assert.match(action, /borderBottomWidth: disabled \? 0 : BUTTON_EDGE/);
  const scorecard = src('app/(screens)/games/[id].tsx');
  const bar = scorecard.match(/<StackedAction[\s\S]*?icon="undo-variant"[\s\S]*?<\/View>/)?.[0] ?? '';
  const actions = bar.split('<StackedAction').slice(1);
  assert.equal(actions.length, 3, 'Undo, Complete, Add round');
  const [undo, complete, addRound] = actions;
  assert.match(undo, /label="Undo"/);
  assert.ok(!/\bfilled\b/.test(undo), 'Undo is outlined');
  assert.match(complete, /icon="flag-checkered"[\s\S]*?label="Complete"/, 'Complete carries the flag');
  assert.ok(!/\bfilled\b/.test(complete), 'Complete is outlined');
  assert.match(addRound, /label="Add round"[\s\S]*?\bfilled\b/, 'Add round is the filled button');

  const tabs = src('components/ui/TabBarButtons.tsx');
  assert.match(tabs, /accessibilityRole="tab"/);
  assert.match(tabs, /backgroundColor: focused \? colors\.primary : colors\.surfaceSunken/);
  assert.match(tabs, /borderBottomWidth: BUTTON_EDGE/);
  assert.match(src('app/(tabs)/_layout.tsx'), /tabBar=\{\(props\) => \(\s*<PillTabBar/);
});

test('design: tags are one 32 px size and never button green; statuses, roles and registration share tone maps', () => {
  const tag = src('components/ui/Tag.tsx');
  assert.match(tag, /minHeight: 32/);
  assert.match(tag, /<Icon source=\{icon\} size=\{16\}/);
  assert.ok(!/colors\.primary\b/.test(tag), 'no tag uses the button green');
  assert.deepEqual(GAME_STATUS_TONE, { Active: 'primary', Completed: 'info', Closed: 'neutral' });
  assert.equal(ACCESS_TONE.Creator, 'leader');
  assert.equal(ACCESS_TONE.Admin, 'info');
  assert.deepEqual(REGISTRATION_TONE, { Registered: 'info', 'Pending registration': 'results', 'Link pending': 'results', Unregistered: 'neutral' });
  assert.deepEqual(Object.keys(REGISTRATION_ICON).sort(), Object.keys(REGISTRATION_TONE).sort());
});

test('design: role tags — plain players see Creator (and You); creators and admins also see Admin; never Player or View only', () => {
  const game = { createdBy: 'c', adminIds: ['a'], unseatedAdminIds: ['u'], players: ['c', 'a', 'p'] };
  assert.equal(viewerManagesGame(game, 'c'), true);
  assert.equal(viewerManagesGame(game, 'a'), true);
  assert.equal(viewerManagesGame(game, 'u'), true);
  assert.equal(viewerManagesGame(game, 'p'), false);
  assert.equal(viewerManagesGame(game, null), false);

  assert.equal(visibleRoleTag('Creator', false), 'Creator');
  assert.equal(visibleRoleTag('Creator', true), 'Creator');
  assert.equal(visibleRoleTag('Admin', false), null, 'a plain player does not see Admin');
  assert.equal(visibleRoleTag('Admin', true), 'Admin');
  assert.equal(visibleRoleTag('Player', true), null);
  assert.equal(visibleRoleTag('View only', true), null);
  assert.equal(visibleRoleTag(null, true), null);

  // Home card: the viewer's own role, filtered the same way.
  assert.equal(visibleRoleTag(gameAccessLabel(game, 'p'), viewerManagesGame(game, 'p')), null);
  assert.equal(visibleRoleTag(gameAccessLabel(game, 'a'), viewerManagesGame(game, 'a')), 'Admin');
  assert.equal(visibleRoleTag(gameAccessLabel(game, 'c'), viewerManagesGame(game, 'c')), 'Creator');

  const players = src('app/(screens)/games/players.tsx');
  assert.match(players, /visibleRoleTag\(seatRoleLabel\(seat, game\), canScore\)/);
  assert.match(players, /<Tag label="You" tone="info" \/>/);
  assert.match(src('components/ui/GameListItem.tsx'), /visibleRoleTag\(access, viewerManagesGame\(game, viewerId\)\)/);
});

test('design: scorecard — G badge, tinted dealer column, signed near-black totals, owners inside the table card', () => {
  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /footer\?: React\.ReactNode/);
  assert.match(table, /contentContainerStyle=\{styles\.grow\}/);
  assert.match(table, /footer: \{\s*marginTop: 'auto',\s*\}/, 'pinned to the bottom on short games, after the last row on long ones');
  assert.match(table, /dealsNext && \{ backgroundColor: colors\.primaryContainer, borderBottomWidth: 4/);
  assert.ok(!/dealsNext && \{ backgroundColor: colors\.primary \}/.test(table), 'the dealer column is no longer filled button green');
  assert.match(table, /\{signed\(total\)\}/);
  assert.match(table, /color: dealsNext \? colors\.onPrimaryContainer : total < 0 \? colors\.loss : colors\.onSurface/);
  assert.match(table, /positive && \{ backgroundColor: colors\.winContainer \}/);
  // The memoised row keeps the loss/zero text expression the earlier tests pin.
  assert.match(table, /color: colors\[text\.colorKey\], fontWeight: text\.fontWeight/);

  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /footer=\{idFooter\}/);
  assert.match(scorecard, /\{`G\$\{game\.gameNumber\}`\}/);
  const footer = src('components/game/GameIdFooter.tsx');
  assert.match(footer, /gameOwnerParts\(/);
  assert.match(footer, /alignItems: 'flex-end'/);
});

test('design: Results totals are big and near-black, wins are never green text, the grid header is a tint', () => {
  const page = src('components/results/ResultsPage.tsx');
  assert.match(page, /totalPoints, \{ color: colors\.onSurface \}/);
  assert.match(page, /totalPoints, \{ color: colors\.loss \}/);
  assert.match(page, /totalPoints: \{[\s\S]*?fontSize: 26/);
  const grid = src('components/results/GameScoreGrid.tsx');
  assert.ok(!/brand\.felt|brand\.cream/.test(grid));
  assert.match(grid, /backgroundColor: colors\.primaryContainer/);
  assert.match(grid, /return \{ color: colors\.onSurface \}/);
});

test('design: Add round — selected and saved cells on white with a green ring; Save score has the edge', () => {
  const cell = src('components/game/ScoreCell.tsx');
  assert.match(cell, /tone === 'selected' \? colors\.primary : tone === 'confirmed' \? colors\.outline : colors\.outlineVariant/);
  const keypad = src('components/game/ScoreKeypad.tsx');
  assert.match(keypad, /borderBottomColor: canSave \? colors\.primaryEdge/);
  assert.match(keypad, /saveEdge: \{\s*borderBottomWidth: BUTTON_EDGE/);
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /gameBadge, \{ backgroundColor: colors\.tertiaryContainer \}/);
  assert.ok(!/SeatAvatar name=\{scorerName\} size=\{3\d\} color=\{colors\.primary\}/.test(entry), 'the scorer avatar is a seat colour');
});
