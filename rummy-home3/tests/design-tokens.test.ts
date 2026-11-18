import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { UNDO_DELETE_MS } from '../utils/resultsDelete';
import { UNDO_REMOVE_MS } from '../utils/removeMyPlayer';
import { ADD_NEW_PLAYERS, FIND_IN_DATABASE, SEARCH_PLACEHOLDER } from '../utils/addPlayers';
import { HELP } from '../constants/help';
import { blockedDialogTitle, completeDialogBody } from '../utils/endFlow';

// Design audit PR 15b (docs/design-audit.md §1, §3, §4): the token test (A15, DC15-1) and source checks for the
// mechanical half — A04 share sheet, A07 SearchField, A09 dialogs, A12 Tag/Chip, A13 Toast, A16, A17, A19, A20, A21.

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
const uiFiles = () => [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components'))].map((f) => path.relative(root, f));
/** Source minus comments, so a rule may be named in a comment without tripping its own test. */
const code = (text: string) => text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

// ---- DC15-1: the tokens hold ----

test('DC15-1: no Alert.alert anywhere — notices are NoticeDialog, questions ConfirmDialog (A09)', () => {
  for (const file of uiFiles()) {
    const text = code(src(file));
    assert.doesNotMatch(text, /Alert\.alert\(/, `${file} calls Alert.alert`);
    assert.doesNotMatch(text, /import \{[^}]*\bAlert\b[^}]*\} from 'react-native'/, `${file} imports Alert`);
  }
  const confirm = src('components/ui/ConfirmDialog.tsx');
  assert.match(confirm, /confirmLabel: string/);
  assert.match(confirm, /destructive\?: boolean/);
  assert.match(confirm, /buttonColor=\{destructive \? colors\.error : undefined\}/, 'destructive verbs are red (A05)');
  assert.match(confirm, /<Button onPress=\{onDismiss\} disabled=\{busy\} accessibilityLabel=\{cancelLabel\}>\{cancelLabel\}<\/Button>/, 'Cancel on the left');
  assert.match(src('app/(tabs)/players.tsx'), /<ConfirmDialog[\s\S]*?confirmLabel="Remove"[\s\S]*?destructive/, 'Remove from My players asks with the dialog');
  assert.match(src('app/(tabs)/me.tsx'), /<NoticeDialog[\s\S]*?testID="me-notice"/, 'Me notices are the dialog');
  assert.match(src('app/(auth)/register.tsx'), /<NoticeDialog[\s\S]*?testID="register-created"/, 'the created-account notice too');
});

test('DC15-1: two button weights — no contained-tonal anywhere, and AppButton no longer accepts it (A17)', () => {
  for (const file of uiFiles()) {
    assert.doesNotMatch(code(src(file)), /contained-tonal/, `${file} uses contained-tonal`);
  }
  assert.match(src('components/ui/AppButton.tsx'), /export type AppButtonMode = 'contained' \| 'outlined' \| 'text';/);
  assert.doesNotMatch(code(src('components/ui/AppButton.tsx')), /tonal/);
});

test('DC15-1: every borderRadius outside theme.ts is a radius token (A15)', () => {
  for (const file of uiFiles()) {
    const text = code(src(file));
    const raw = text.match(/borderRadius:\s*\d/g) ?? [];
    assert.equal(raw.length, 0, `${file} has a raw borderRadius number (use radius.xs/sm/md/lg/xl/full)`);
    for (const use of text.match(/borderRadius:\s*[A-Za-z_.]+/g) ?? []) {
      assert.match(use, /borderRadius:\s*(radius\.(xs|sm|md|lg|xl|full)|[a-zA-Z_]+)$/, `${file}: ${use}`);
    }
  }
  const theme = src('constants/theme.ts');
  assert.match(theme, /export const radius = \{\s*xs: 6,\s*sm: 8,\s*md: 12,\s*lg: 16,\s*xl: 24,\s*full: 999,\s*\} as const;/);
});

test('DC15-1: Paper Chip only as a filter or choice (always tappable); status and roles are our Tag (A12)', () => {
  for (const file of uiFiles()) {
    const text = code(src(file));
    if (!/import \{[^}]*\bChip\b[^}]*\} from 'react-native-paper'/.test(text)) continue;
    const chips = text.match(/<Chip\b[\s\S]*?(\/>|>)/g) ?? [];
    for (const chip of chips) {
      assert.match(chip, /onPress=/, `${file}: a Paper Chip without onPress is a status — use Tag`);
    }
  }
  assert.match(src('components/players/InitialsConflictList.tsx'), /<Tag label=\{chosen\} tone="warning"/, 'the chosen custom initials are a Tag');
  assert.match(src('app/(screens)/results/index.tsx'), /<Button\s+compact\s+mode="outlined"\s+icon="restore"[\s\S]*?testID=\{`deleted-result-restore-\$\{row\.id\}`\}/, 'Restore is a button, not a chip');
});

// ---- A13: one Toast ----

test('A13: one Toast — 3 s plain, 4 s with Undo; Snackbar is imported nowhere else; Delete result keeps its 10 s (D9.1)', () => {
  const toast = src('components/ui/Toast.tsx');
  assert.match(toast, /export const TOAST_MS = 3000;/);
  assert.match(toast, /export const TOAST_UNDO_MS = 4000;/);
  assert.equal(UNDO_REMOVE_MS, 4000, 'Remove from My players asks first now, so its Undo takes the standard 4 s');
  assert.equal(UNDO_DELETE_MS, 10000, 'the one exception: this Undo stands in for a confirm dialog');
  for (const file of uiFiles()) {
    if (file === 'components/ui/Toast.tsx') continue;
    assert.doesNotMatch(code(src(file)), /\bSnackbar\b/, `${file} uses Snackbar directly — use Toast`);
  }
  assert.match(toast, /durationMs \?\? \(action \? TOAST_UNDO_MS : TOAST_MS\)/);
  assert.match(toast, /aboveBar \? \{ marginBottom: BOTTOM_BAR_CLEARANCE \} : undefined/, 'knows the bar height');
  assert.match(src('app/(screens)/results/[id].tsx'), /<Toast[\s\S]*?durationMs=\{UNDO_DELETE_MS\}/);
});

// ---- A04 / A20: share sheet and header order ----

test('A04: the scorecard header share icon opens the one ShareSheet (live link · final scores); the ⋮ has no share items', () => {
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /<IconButton icon="share-variant" size=\{22\} onPress=\{\(\) => setShareOpen\(true\)\} accessibilityLabel="Share" testID="scorecard-share-icon" \/>/);
  assert.match(scorecard, /<ShareSheet[\s\S]*?key: 'live', icon: 'link-variant', label: 'Live scorecard link'/);
  assert.match(scorecard, /canShareResults\(game\.isComplete\)[\s\S]*?label: 'Share final scores'/);
  assert.doesNotMatch(scorecard, /<Menu\.Item[^>]*title="Share live scorecard"/);
  assert.doesNotMatch(scorecard, /<Menu\.Item[^>]*title="Share final scores"/);
  const sheet = src('components/share/ShareSheet.tsx');
  assert.match(sheet, /testID="share-sheet"/);
  assert.match(sheet, /<Button onPress=\{onDismiss\} accessibilityLabel="Close">Close<\/Button>/, 'an info sheet closes with Close (A05)');
  assert.match(src('e2e/full/41-share-images.yaml'), /id: "scorecard-share-icon"[\s\S]*?id: "share-final-scores-option"/, 'the nightly flow goes through the sheet');
});

test('A20: header right is share · help · menu — scorecard and saved result; the saved result has one headerRight source', () => {
  const scorecard = src('app/(screens)/games/[id].tsx');
  const header = scorecard.slice(scorecard.indexOf('headerRight: () => ('), scorecard.indexOf('</Menu>', scorecard.indexOf('headerRight: () => (')));
  const share = header.indexOf('testID="scorecard-share-icon"');
  const help = header.indexOf('<HelpButton');
  const menu = header.indexOf('<Menu');
  assert.ok(share > 0 && help > share && menu > help, 'share, then help, then menu');
  const rs = src('components/results/ResultsShare.tsx');
  assert.match(rs, /testID="results-share-icon"[\s\S]*?<HelpButton text=\{HELP\.results\} \/>\s*\{menu\}/, 'ResultsShare renders share · help · menu');
  const saved = src('app/(screens)/results/[id].tsx');
  assert.doesNotMatch(saved, /headerRight:/, 'the saved result no longer sets a second headerRight that raced ResultsShare');
  assert.match(saved, /<ResultsShare[\s\S]*?menu=\{result \? \(\s*<Menu/, 'its ⋮ goes through ResultsShare');
});

// ---- A07 / A21: one SearchField, one pair of labels ----

test('A07: My players, New game and Find in database use the one SearchField with the one placeholder; no Searchbar elsewhere', () => {
  for (const file of uiFiles()) {
    if (file === 'components/ui/SearchField.tsx') continue;
    assert.doesNotMatch(code(src(file)), /\bSearchbar\b/, `${file} uses Paper's Searchbar directly — use SearchField`);
  }
  const field = src('components/ui/SearchField.tsx');
  assert.match(field, /placeholder = SEARCH_PLACEHOLDER/);
  assert.match(field, /backgroundColor: colors\.surface, borderColor: colors\.outline/, 'white with the standard border');
  assert.match(field, /borderRadius: radius\.sm/, 'the input radius');
  assert.equal(SEARCH_PLACEHOLDER, 'Search name, initials or #ID');
  assert.match(src('app/(tabs)/players.tsx'), /<SearchField value=\{query\} onChangeText=\{setQuery\} style=\{styles\.search\} testID="my-players-search" \/>/);
  assert.match(src('app/(screens)/games/new.tsx'), /<SearchField value=\{query\} onChangeText=\{setQuery\} style=\{\[styles\.search, styles\.flex\]\} testID="picker-search" \/>/);
  assert.match(src('app/(screens)/players/new.tsx'), /<SearchField[\s\S]*?testID="find-search"/);
  assert.doesNotMatch(src('app/(screens)/players/new.tsx'), /Name or player ID/, 'the old placeholder is gone');
});

test('A21: "Add by initials" / "Find in database" everywhere — tiles, titles, help; no "Add new players" / "From database" / "Find player in database" labels', () => {
  assert.equal(ADD_NEW_PLAYERS, 'Add by initials');
  assert.equal(FIND_IN_DATABASE, 'Find in database');
  assert.match(src('app/(tabs)/players.tsx'), /label=\{ADD_NEW_PLAYERS\}/);
  assert.match(src('app/(tabs)/players.tsx'), /label=\{FIND_IN_DATABASE\}/);
  assert.match(src('app/(screens)/games/new.tsx'), /\{FIND_IN_DATABASE\}/);
  assert.match(src('app/(screens)/players/add.tsx'), /export const ADD_PLAYERS_TITLE = 'Add by initials';/);
  assert.match(src('app/(screens)/players/new.tsx'), /title: FIND_IN_DATABASE,/);
  const layout = src('app/(screens)/_layout.tsx');
  assert.match(layout, /title: 'Find in database'/);
  assert.match(layout, /title: 'Add by initials'/);
  for (const file of uiFiles()) {
    const text = code(src(file));
    assert.doesNotMatch(text, /["'`>]Find player in database["'`<]/, `${file}: old label`);
    assert.doesNotMatch(text, /["'`>]From database["'`<]/, `${file}: old label`);
    assert.doesNotMatch(text, /label="Add new players"|actionLabel="Add new players"|title: 'Add new players'/, `${file}: old label`);
  }
  for (const key of ['players', 'newGame', 'addPlayers', 'find', 'addToGame'] as const) {
    const text = HELP[key];
    assert.doesNotMatch(text, /From database|Find player in database|use Add new players/, `HELP.${key} still says the old label`);
  }
  assert.match(HELP.players, /Find in database/);
  assert.match(HELP.players, /Add by initials/);
  assert.match(HELP.newGame, /Add by initials: new people by initials/);
  assert.match(HELP.newGame, /Find in database: a registered player/);
});

// ---- A16 / A19 ----

test('A16 (Nov 18): Complete is one dialog on the scorecard; its body says what will be locked and what comes next', () => {
  const dialog = src('components/game/CompleteGameDialog.tsx');
  assert.match(dialog, /<Dialog\.Title>\{pool \? 'Complete this pool\?' : 'Complete this game\?'\}<\/Dialog\.Title>/);
  assert.match(dialog, /testID="complete-body"/);
  assert.equal(completeDialogBody({ pool: false, roundCount: 0, inCount: 0, outCount: 0 }), 'No rounds were played. The game will be completed with no scores.');
  assert.match(completeDialogBody({ pool: false, roundCount: 6, inCount: 0, outCount: 0 }), /^6 rounds will be locked\. Every round adds to 0\. You can reopen the game later from the ⋮ menu\.$/);
  assert.match(completeDialogBody({ pool: true, roundCount: 8, inCount: 1, outCount: 5 }), /^8 rounds will be locked\. 1 player in, 5 out\. Next you give the awards\./);
  assert.match(completeDialogBody({ pool: true, roundCount: 8, inCount: 3, outCount: 3 }), /More than one player is still in\./);
  assert.equal(blockedDialogTitle([4]), 'Fix round 4 first');
  assert.match(src('app/(screens)/games/[id].tsx'), /<CompleteGameDialog/, 'the scorecard opens it');
  assert.match(src('app/(screens)/score-entry.tsx'), /<CompleteGameDialog/, 'so does Round saved → Complete');
  assert.match(src('app/(screens)/score-entry.tsx'), /onCompleted=\{\(updated\) => router\.replace\(afterCompleteRoute\(updated\)\)\}/, 'then on to Awards (pool) or the Final screen (points)');
});

test('A19: EmptyState everywhere — no plain "None yet" text', () => {
  for (const file of uiFiles()) {
    assert.doesNotMatch(code(src(file)), />None yet/, `${file}: plain "None yet" text (use EmptyState)`);
  }
  assert.match(src('app/(screens)/results/index.tsx'), /<EmptyState icon="podium" title="No results yet"/);
  assert.match(src('app/(screens)/sessions/[id].tsx'), /<EmptyState icon="cash-multiple" title="No entries yet"/);
});
