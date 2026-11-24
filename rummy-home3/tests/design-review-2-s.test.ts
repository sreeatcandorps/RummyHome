import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { emailPrefsSummary } from '../utils/emailPrefs';

/**
 * Design review 2, Size S (docs/design-review-2.md §10; D65–D69, Nov 23): Palette B tokens and the
 * four approved screens as grouped lists — Profile, Settings, Game type, Sign in. Source pins, so
 * a later PR cannot quietly bring a card, a pill or a hint block back.
 */
const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const inOrder = (text: string, needles: string[], what: string) => {
  let at = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, at + 1);
    assert.ok(next > at, `${what}: "${needle}" after the one before it`);
    at = next;
  }
};

test('D65 Palette B "Felt & Brass": the light and dark tokens, the web scorecard green, seat colours untouched', () => {
  const theme = src('constants/theme.ts');
  for (const pin of ["primary: '#0E4D2A'", "primaryContainer: '#D8ECDD'", "secondary: '#8A6A1E'", "secondaryContainer: '#F0DFAE'", "onSecondaryContainer: '#3E2E07'", "background: '#F5F2E8'", "outlineVariant: '#E6E1D3'"]) {
    assert.ok(theme.includes(pin), `light ${pin}`);
  }
  for (const pin of ["background: '#0C120E'", "surface: '#141B16'", "primary: '#7FD39F'", "secondaryContainer: '#4A3A10'", "onSecondaryContainer: '#F5E3B0'"]) {
    assert.ok(theme.includes(pin), `dark ${pin}`);
  }
  assert.match(theme, /feltLight: '#0E4D2A'/, 'the auth band follows primary');
  assert.match(theme, /'#0F766E'/, 'seat 1 teal is untouched');
  assert.doesNotMatch(theme, /#15803D|#FFE38A/, 'no Clubhouse green or lemon left');
  for (const file of ['public/scorecard.html', 'web/scorecard.html', 'public/r/index.html']) {
    assert.match(src(file), /--green: #0E4D2A/, `${file} uses the felt green`);
    assert.doesNotMatch(src(file), /#15803D/, `${file} has no Clubhouse green`);
  }
  assert.match(src('utils/resultsDetails.ts'), /--green: #0E4D2A/);
  assert.match(src('components/share/ShareCardView.tsx'), /#0E4D2A/, 'the share card frame');
});

test('§10.1 Profile: six groups in order, rows not cards, zero Buttons, Appearance is a SegmentedChoice', () => {
  const me = src('app/(tabs)/me.tsx');
  assert.equal(count(me, /<Button\b/g), 0, 'B01: no Button on the screen (13 → 0)');
  assert.equal(count(me, /SectionCard/g), 0, 'B12: no SectionCard');
  assert.doesNotMatch(me, /SegmentedButtons|<Checkbox|<Pressable/);
  inOrder(me, ['title="Your table"', 'title="Notifications"', 'title="Game defaults"', 'title="Appearance"', 'title="Help"', 'title="Account"'], 'Profile groups');
  assert.match(me, /<SegmentedChoice\s+value=\{appearance\}/, 'Appearance is the one inline control');
  assert.match(me, /title="Initials on scorecards"[\s\S]*?testID="me-edit-initials"/, 'the initials row keeps its id');
  assert.match(me, /testID="me-help-index"/);
  assert.match(me, /title="Delete account" tone="danger"[^\n]*testID="delete-account"/);
  assert.match(me, /title="Log out" tone="danger" noChevron/);
  assert.match(me, /testID="me-notice"/, 'A09: the notice dialog stays');
  assert.match(me, /title="Admin"/, 'demo tools are the admins\u2019 seventh group');
  assert.match(me, /<EditFieldDialog[\s\S]*?title="Edit name"/);
  assert.match(me, /<EditFieldDialog[\s\S]*?keyboardType="phone-pad"/);
  assert.equal(emailPrefsSummary({ gameStarted: true, results: false }), 'Game started');
});

test('§10.1 pieces: ListRow value slot drops the icon square; SettingsGroup has one ⓘ; SegmentedChoice is a 40-dp radiogroup', () => {
  const row = src('components/ui/ListRow.tsx');
  assert.match(row, /icon && value === undefined \?/, 'no icon square once a value is shown');
  assert.match(row, /pen \? 'pencil-outline' : 'chevron-right'/);
  assert.match(row, /noChevron \|\| !onPress \? null/);
  const group = src('components/ui/SettingsGroup.tsx');
  assert.equal(count(group, /<InfoTip /g), 1, 'one ⓘ per group (B16)');
  assert.match(group, /StyleSheet\.hairlineWidth/, 'hairlines between rows, no card border');
  const choice = src('components/ui/SegmentedChoice.tsx');
  assert.match(choice, /accessibilityRole="radiogroup"/);
  assert.match(choice, /accessibilityRole="radio"/);
  assert.match(choice, /colors\.secondaryContainer/, 'selected = brass container');
  assert.match(choice, /minHeight: 40/);
});

test('§10.2 Settings: four groups, grouped RulesForm, one contained Save in the bar, the testIDs flow 07 taps', () => {
  const settings = src('app/(screens)/settings.tsx');
  assert.equal(count(settings, /SectionCard/g), 0);
  assert.equal(count(settings, /SegmentedButtons/g), 0);
  inOrder(settings, ['title="New game starts as"', 'title="Points defaults"', 'title="Pool defaults"', 'title="More"'], 'Settings groups');
  assert.equal(count(settings, /mode="contained"/g), 1, 'Save is the one filled button');
  assert.match(settings, /<BottomBar>[\s\S]*testID="settings-save"/);
  assert.match(settings, /testIDPrefix="settings-points" helpTopic="settings" layout="grouped"/);
  assert.match(settings, /testIDPrefix="settings-pool" helpTopic="settings" layout="grouped"/);
  assert.match(settings, /testID: 'settings-starts-points'/);
  assert.match(settings, /testID: 'settings-starts-pool'/);
  assert.match(settings, /title="Which setting wins"[\s\S]*<SettingsPriority/, 'the priority ladder opens from a row');
  assert.match(settings, /title="Hidden & deleted"/);
  const form = src('components/game/RulesForm.tsx');
  assert.match(form, /layout\?: 'card' \| 'grouped'/);
  const grouped = form.slice(form.indexOf('function GroupedRulesForm'), form.indexOf('function EntryPlusRadios'));
  assert.equal(count(grouped, /RadioButton/g), 0, 'B06: segmented rows, not radios');
  assert.equal(count(grouped, /<Button\b/g), 0, 'no chip buttons for the limit');
  for (const id of ['limit-${limit}', 'limit-custom', 'limit-input', 'reentries-unlimited', 'reentries-limited', 'reentries-count', 'reentry-score', 'late-entry-score']) {
    assert.ok(grouped.includes(`\${testIDPrefix}-${id}`), `grouped form keeps ${id}`);
  }
  assert.match(grouped, /limitNumber \? limitHint\(limitNumber\)/, 'the live "100 is in, 101 is out" line stays');
  assert.doesNotMatch(grouped, /secondaryContainer/, 'B03: no yellow hint block');
  assert.match(src('components/game/RulesForm.tsx'), /`\$\{testID\}-highest`[\s\S]*`\$\{testID\}-plus-one`/, 'EntryPlusChoice keeps the -highest / -plus-one ids');
});

test('§10.3 Game type: three groups, segmented Points | Pool with the old ids, players as rows, the refused-limit strip and Next unchanged', () => {
  const step = src('components/game/GameTypeStep.tsx');
  assert.equal(count(step, /SectionCard/g), 0);
  assert.equal(count(step, /SegmentedButtons/g), 0);
  assert.doesNotMatch(step, /styles\.chip\b/, 'no player chips');
  inOrder(step, ['title="Game type"', "title={pool ? 'Pool settings' : 'Points settings'}", 'title={`Playing · ${picks.length}`}'], 'Game type groups');
  assert.match(step, /testID: 'game-type-points'/);
  assert.match(step, /testID: 'game-type-pool'/);
  assert.match(step, /testIDPrefix="new-game" layout="grouped"/);
  assert.match(step, /<ListRow key=\{p\.id\} title=\{p\.name\} left=\{<SeatAvatar/, 'the Playing group is read-only rows');
  assert.match(step, /note=\{GAME_KIND_NOTE\[kind\]\}/, 'one grey line under the choice; the paragraphs are behind ⓘ');
  assert.match(step, /testID="new-game-problem"/);
  assert.match(step, /testID="new-game-type-next"/);
  assert.match(step, /testID="multiplier-high-confirm"/);
});

test('§10.4 Sign in: the Joker card hero, the eye kept, no mail icon, no Create-account pill, no "Secure sign-in enabled"', () => {
  const login = src('app/(auth)/login.tsx');
  assert.match(login, /hero=\{<JokerCard \/>\}/);
  assert.match(login, /<PasscodeField/, 'the six cells and their eye are untouched');
  assert.doesNotMatch(login, /email-outline/, 'one input style: no leading icon');
  assert.doesNotMatch(login, /Secure sign-in enabled/, 'B17');
  assert.doesNotMatch(login, /mode="outlined"[\s\S]{0,200}Create account/, 'B01: Create account is a text action');
  assert.match(login, /mode="text" compact[^\n]*testID="login-create-account"/);
  assert.match(login, /Local prototype mode: add Supabase env vars/, 'the no-Supabase warning stays');
  assert.match(src('components/ui/PasscodeField.tsx'), /useState\(false\)/, 'hidden by default; the eye reveals');
  const card = src('components/ui/JokerCard.tsx');
  assert.match(card, /JOKER_CARD_RATIO = 2\.25 \/ 3\.5/, 'bridge size, not poker');
  assert.match(card, /\['J', 'O', 'K', 'E', 'R'\]/, 'stacked letters, not a rotated word');
  assert.doesNotMatch(card, /borderWidth/, 'no inner frame (Sree, Nov 23)');
  assert.match(card, /require\('\.\.\/\.\.\/assets\/joker-figure\.png'\)/);
  const shell = src('components/ui/AuthShell.tsx');
  assert.match(shell, /hero\?: React\.ReactNode/);
  assert.match(shell, /hero \? <View style=\{styles\.hero\}>\{hero\}<\/View> : badge/, 'the tile stays the default for Register and Forgot passcode');
});
