import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { myPlayersAccessibilityLabel, myPlayersBadge } from '../utils/homeButtons';
import { appearanceFromSettings, DEFAULT_APPEARANCE } from '../utils/appearance';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

// ---------------------------------------------------------------------------
// PR 5 — Home: two bottom buttons, My players button with its count badge, Light default
// ---------------------------------------------------------------------------

test('H5-1 the My players badge is the count, 99+ past that, nothing while unknown', () => {
  assert.equal(myPlayersBadge(12), '12');
  assert.equal(myPlayersBadge(0), '0');
  assert.equal(myPlayersBadge(100), '99+');
  assert.equal(myPlayersBadge(null), null);
  assert.equal(myPlayersBadge(undefined), null);
  assert.equal(myPlayersAccessibilityLabel(12), 'My players · 12', 'the same spoken label the bottom bar used to carry');
  assert.equal(myPlayersAccessibilityLabel(null), 'My players');
});

test('H5-2 the bottom bar draws Home and Profile only; the players route stays reachable with a back arrow', () => {
  const layout = src('app/(tabs)/_layout.tsx');
  assert.match(layout, /index: \{ kind: 'icon', icon: 'home-variant', label: 'Home' \}/);
  assert.match(layout, /me: \{ kind: 'avatar', name: myName, label: 'Your profile' \}/);
  assert.doesNotMatch(layout, /players: \{ kind:/, 'no third button');
  assert.match(layout, /name="players"[\s\S]*?href: null,[\s\S]*?headerLeft: \(\) => <BackToHome \/>/, 'hidden tab with a back arrow to Home');
  assert.match(layout, /accessibilityLabel="Back to Home"/);
  const bar = src('components/ui/TabBarButtons.tsx');
  assert.match(bar, /const item = items\[route\.name\];\s+if \(!item\) return null;/, 'a route with no item is not drawn');
  assert.doesNotMatch(bar, /circle-outline/, 'no fallback circle for an unlisted route');
});

test('H5-3 Home: Results and My players side by side where Results was; cards, list and header untouched', () => {
  const home = src('app/(tabs)/index.tsx');
  assert.match(home, /<View style=\{styles\.actionRow\}>/);
  assert.match(home, /accessibilityLabel="Results"/);
  assert.match(home, /onPress=\{\(\) => router\.push\('\/\(tabs\)\/players'\)\}/);
  assert.match(home, /accessibilityLabel=\{myPlayersAccessibilityLabel\(playerCount\)\}/);
  assert.match(home, /testID="home-my-players-badge"/);
  assert.match(home, /playersService\.readMyPlayers\(home\.player\.id\)/, 'cached count first');
  assert.match(home, /playersService\.listMyPlayers\(home\.player\.id\)/, 'then the fresh one');
  // Sree (Nov 13): only the buttons change. The cards, the Live / Recent headers and the New game button stay.
  assert.match(home, /title=\{live\.length \? `Live · \$\{live\.length\}` : 'Live'\}/);
  assert.match(home, /const recentTitle = finished\.length \? `Recent · \$\{finished\.length\}` : 'Recent';/);
  assert.match(home, /const recentSupporting = 'Completed and Closed games, newest first\.';/);
  assert.match(home, /<GameListItem game=\{game\} viewerId=\{viewerId\} onPress=\{\(\) => openGame\(game\.id\)\} \/>/);
  assert.match(home, /style=\{styles\.newGame\}/);
});

test('H5-4 appearance opens Light by default from one constant; Phone and Dark stay choices', () => {
  assert.equal(DEFAULT_APPEARANCE, 'light');
  assert.equal(appearanceFromSettings(undefined), 'light');
  assert.equal(appearanceFromSettings({ appearance: 'system' }), 'system');
  assert.equal(appearanceFromSettings({ appearance: 'dark' }), 'dark');
  const context = src('contexts/PreferencesContext.tsx');
  assert.equal((context.match(/DEFAULT_APPEARANCE/g) ?? []).length, 3, 'import, context default and initial state read the constant');
  assert.doesNotMatch(context, /useState<Appearance>\('system'\)/);
  // The OS scheme must stay readable for the "Phone" choice to mean anything.
  assert.match(src('app.json'), /"userInterfaceStyle": "automatic"/);
});

test('H5-5 the help text describes the two-button bar and the badge', () => {
  const help = src('constants/help.ts');
  assert.match(help, /Two buttons: Home \(this page\) and your initials/);
  assert.match(help, /The number on the button is how many are in it\./);
});
