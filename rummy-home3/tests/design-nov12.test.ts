import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { appearanceFromSettings, APPEARANCE_OPTIONS, resolveDarkMode } from '../utils/appearance';
import { ACCESS_TONE, gameAccessLabel, viewerManagesGame, visibleRoleTag } from '../utils/gameAccess';
import { GAME_STATUS_TONE } from '../utils/gameStatus';
import { REGISTRATION_ICON, REGISTRATION_TONE } from '../utils/myPlayersList';
import { HELP } from '../constants/help';

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

test('design: appearance is Light by default (PR 5); "Phone" stays a choice; the saved dark switch still means Dark', () => {
  assert.deepEqual(APPEARANCE_OPTIONS.map((o) => o.value), ['system', 'light', 'dark']);
  assert.equal(appearanceFromSettings(undefined), 'light');
  assert.equal(appearanceFromSettings({}), 'light');
  assert.equal(appearanceFromSettings({ darkMode: true }), 'dark');
  assert.equal(appearanceFromSettings({ darkMode: false }), 'light');
  assert.equal(appearanceFromSettings({ appearance: 'system' }), 'system', 'someone who chose Phone keeps it');
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
  // PR 4: the owner lines sit under the table card (outside the scrollers) instead of inside it.
  assert.doesNotMatch(table, /footer\?: React\.ReactNode/);
  assert.match(table, /dealsNext && \{ backgroundColor: colors\.primaryContainer, borderBottomWidth: DEALER_BAR/);
  assert.ok(!/dealsNext && \{ backgroundColor: colors\.primary \}/.test(table), 'the dealer column is no longer filled button green');
  assert.match(table, /\{signed\(total\)\}/);
  assert.match(table, /color: dealsNext \? colors\.onPrimaryContainer : total < 0 \? colors\.loss : colors\.onSurface/);
  // Final batch item 5 in the green palette: only a win gets a background (the Clubhouse win tint); no red pill.
  assert.match(table, /text\.highlight && \{ backgroundColor: colors\.winContainer \}/);
  assert.doesNotMatch(table, /lossContainer/, 'no red background on a score cell');
  // The memoised row keeps the loss/zero text expression the earlier tests pin.
  assert.match(table, /color: colors\[text\.colorKey\], fontWeight: text\.fontWeight/);

  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /\{table\}\s+\{idFooter\}/, 'the footer is drawn right under the table');
  assert.match(scorecard, /\{gameLabel\}<\/Text>/, 'the badge is the S/P label (028), not a G-number');
  assert.doesNotMatch(scorecard, /`G\$\{game\.gameNumber\}`/);
  const footer = src('components/game/GameIdFooter.tsx');
  // Item 7 / PR 4: Creator and each Admin on their own line (one Text per line), left-aligned under the card.
  assert.match(footer, /scorecardFooterLines\(/);
  assert.match(footer, /lines\.map\(\(line, index\) =>/);
  assert.match(footer, /alignItems: 'flex-start'/);
});

test('design: Results scores are near-black, negatives red; band strips are filled (V4): green-tinted header with a green base line, gray rows, no win tint', () => {
  const line = src('components/results/PlayerLine.tsx');
  assert.match(line, /row\.points < 0 \? colors\.negative : colors\.onSurface/);
  const table = src('components/results/BandTable.tsx');
  assert.ok(!/brand\.felt|brand\.cream/.test(table));
  assert.doesNotMatch(table, /winContainer/, 'no green highlight on a win (Sree, Nov 13)');
  assert.doesNotMatch(table, /borderColor: colors\.primary \}/, 'no bright green border');
  assert.match(table, /colors\.bandHeadAlt : colors\.bandHead\) : index % 2 === 1 \? colors\.bandAlt : colors\.band/);
  assert.match(table, /headBox: \{ borderBottomWidth: 2/);
  assert.match(table, /width: `\$\{\(count \/ BAND_SIZE\) \* 100\}%`/, 'a short band is only as wide as its games');
  assert.doesNotMatch(table, /fontWeight: '700' as const/, 'per-game numbers are plain weight; only the total is bold');
  assert.match(table, /default: return \{ color: colors\.onSurface \}/);
});

test('design: Add round — selected cell yellow, saved win light green with a green ring (PR 3); Save score has the edge', () => {
  const cell = src('components/game/ScoreCell.tsx');
  assert.match(cell, /tone === 'selected' \? colors\.onSecondaryContainer : isWin \? colors\.win : tone === 'confirmed' \? colors\.outline : colors\.outlineVariant/);
  assert.match(cell, /colors\[cellFill\('confirmed', value\)\]/, 'a saved plus is the light green');
  const keypad = src('components/game/ScoreKeypad.tsx');
  assert.match(keypad, /borderBottomColor: canSave \? colors\.primaryEdge/);
  assert.match(keypad, /saveEdge: \{\s*borderBottomWidth: BUTTON_EDGE/);
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /gameBadge, \{ backgroundColor: colors\.tertiaryContainer \}/);
  assert.ok(!/SeatAvatar name=\{scorerName\} size=\{3\d\} color=\{colors\.primary\}/.test(entry), 'the scorer avatar is a seat colour');
});

test('final batch 10 / PR 5: bottom bar is two same-size icon-only buttons (Home, Profile); the profile one is a plain circle of initials', () => {
  const tabs = src('components/ui/TabBarButtons.tsx');
  assert.match(tabs, /flex: 1,/, 'every button takes the same share of the row');
  assert.doesNotMatch(tabs, /flex\?: number|avatarPill|<Text/, 'no per-item widths, no drawn labels');
  assert.match(tabs, /accessibilityLabel=\{options\.tabBarAccessibilityLabel \?\? item\.label\}/, 'labels are spoken');
  assert.match(tabs, /<Icon source=\{item\.icon\} size=\{iconSize\} color=\{fg\} \/>/);
  assert.match(tabs, /<SeatAvatar name=\{item\.name\} size=\{iconSize \+ 6\} color=\{seatColor\(0, \{ onDark: dark \}\)\} \/>/, 'plain circle: no ring, no badge');
  assert.match(tabs, /backgroundColor: focused \? colors\.primary : colors\.surfaceSunken/, 'current button filled, others outlined, like every button');
  const layout = src('app/(tabs)/_layout.tsx');
  assert.match(layout, /index: \{ kind: 'icon', icon: 'home-variant', label: 'Home' \}/);
  assert.doesNotMatch(layout, /players: \{ kind: 'icon'/, 'PR 5: My players left the bar');
  assert.match(layout, /me: \{ kind: 'avatar', name: myName, label: 'Your profile' \}/);
  assert.doesNotMatch(layout, /flex: 1\.45/);
  assert.match(HELP.home, /## Bottom bar/);
});

test('final batch 11: the Joker mascot is the app icon and splash; four PNG options are kept; no version number beside the icon', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.icon, './assets/icon.png');
  assert.equal(app.splash.image, './assets/icon.png');
  assert.equal(app.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png', 'the adaptive foreground keeps the card inside the 66% safe zone');
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#FBF1E1');
  const png = (rel: string) => {
    const bytes = readFileSync(join(root, rel));
    assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${rel} is a PNG`);
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  };
  for (let i = 1; i <= 4; i += 1) assert.deepEqual(png(`assets/icon-options/joker-${i}.png`), { width: 1024, height: 1024 });
  assert.deepEqual(png('assets/icon.png'), { width: 1024, height: 1024 });
  assert.deepEqual(png('assets/adaptive-icon.png'), { width: 1024, height: 1024 });
  assert.deepEqual(png('assets/icon-small.png'), { width: 320, height: 320 });
  // Option 1 is wired: the launcher icon is byte-for-byte the first option.
  assert.ok(readFileSync(join(root, 'assets/icon.png')).equals(readFileSync(join(root, 'assets/icon-options/joker-1.png'))));
  const layout = src('app/(tabs)/_layout.tsx');
  assert.doesNotMatch(layout, /VERSION_LABEL|brandVersion/, 'the header is the logo and the name only');
  assert.match(src('app/(tabs)/me.tsx'), /`EZ Score \$\{VERSION_LABEL\}`/, 'the version moved to the foot of Profile');
});

test('design: the scorecard tag row wraps so a fourth tag is never cut short', () => {
  assert.match(src('app/(screens)/games/[id].tsx'), /metaRow: \{[\s\S]*?flexWrap: 'wrap'/);
});
