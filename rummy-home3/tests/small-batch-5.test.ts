import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pickerWhileTyping } from '../utils/addPlayers';
import { screenTitle } from '../utils/gameLabel';
import { PLAYERS_ADMINS_TITLE } from '../utils/gameAdmins';
import { FIT_MIN_FONT_SCALE } from '../utils/fitText';
import { visibleRoleTag } from '../utils/gameAccess';
import { HELP_TOPICS, helpIndex, searchHelp } from '../constants/helpTopics';
import { leftAndDrops } from '../utils/poolAwards';
import { ROUND_SAVED_NOTE_MS, roundSavedMark, roundSavedNote, UNDO_MENU_ITEM } from '../utils/roundSavedNote';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

// ---- 12l (D137): Undo leaves the Scorecard's bottom bar ----

test('12l: the note names the round just saved and offers Undo only while it is still the last round', () => {
  assert.equal(ROUND_SAVED_NOTE_MS, 5000, 'Sree: a 5-second note');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: false, canScore: true }), 'Round 3 saved');
  assert.equal(roundSavedNote({ savedRound: null, roundCount: 3, isComplete: false, canScore: true }), null, 'no save, no note');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 4, isComplete: false, canScore: true }), null, 'another phone saved round 4: Undo would remove theirs');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 2, isComplete: false, canScore: true }), null, 'already undone');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: true, canScore: true }), null, 'completed from the Round saved sheet');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: false, canScore: false }), null, 'view only');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: false, canScore: true, reentryPending: true }), null, 'Undo would take back the re-entry, not round 3');
  assert.match(src('app/(screens)/games/[id].tsx'), /reentryPending: pool && players\.some\(\(player\) => seatOf\(game, player\.id\)\?\.reenteredRound === maxRounds \+ 1\)/);
});

test('12l: Add round marks the round once, for its own game only', () => {
  roundSavedMark.mark('g1', 4);
  assert.equal(roundSavedMark.take('g2'), null, 'another game does not take it');
  assert.equal(roundSavedMark.take('g1'), 4);
  assert.equal(roundSavedMark.take('g1'), null, 'taken once');
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /await gamesService\.addRound\([\s\S]*?\}\);\s*roundSavedMark\.mark\(game\.id, nextRoundNumber\(game\)\);/, 'marked after a new round saves, before the pool sheet');
  assert.doesNotMatch(entry.slice(entry.indexOf('if (editRound) {'), entry.indexOf('} else {', entry.indexOf('if (editRound) {'))), /roundSavedMark/, 'an edit is not a new round');
});

test('12l: the bar has no Undo; the ⋮ menu and the note do, with the same confirm', () => {
  const screen = src('app/(screens)/games/[id].tsx');
  const bar = screen.slice(screen.indexOf('<BottomBar fullWidth>'), screen.indexOf('</BottomBar>'));
  assert.doesNotMatch(bar, /undo/i, 'Undo is out of the bottom bar');
  assert.doesNotMatch(screen, /icon="undo-variant"\s+label="Undo"/, 'no Undo StackedAction left');
  assert.equal(UNDO_MENU_ITEM, 'Undo last round');
  assert.match(screen, /<Menu\.Item leadingIcon="undo-variant" title=\{UNDO_MENU_ITEM\} disabled=\{maxRounds === 0\} onPress=\{handleUndoLastRound\} testID="game-menu-undo" \/>/);
  assert.match(screen, /<Toast\s+message=\{linkNote \? null : savedNote\}[\s\S]*?onPress: handleUndoLastRound[\s\S]*?durationMs=\{ROUND_SAVED_NOTE_MS\}/);
  assert.match(screen, /const handleUndoLastRound = \(\) => \{[\s\S]*?setShowUndoConfirm\(true\);/, 'both open "Remove the last round?"');
  assert.match(screen, /const round = roundSavedMark\.take\(id\);/);
});

// ---- 12o (option A): New game's players step with the keyboard up ----

test('12o: while typing, the chips take one row and the bar holds Next alone; both come back when the keyboard closes', () => {
  assert.deepEqual(pickerWhileTyping(true), { stripOneRow: true, barTiles: false });
  assert.deepEqual(pickerWhileTyping(false), { stripOneRow: false, barTiles: true });
});

test('12o: the page pads for the keyboard and the strip has its one-row mode', () => {
  const screen = src('app/(screens)/games/new.tsx');
  assert.match(screen, /const typing = pickerWhileTyping\(keyboardUp\);/);
  const kav = screen.slice(screen.indexOf('<KeyboardAvoidingView'), screen.indexOf('</KeyboardAvoidingView>'));
  assert.match(kav, /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\} keyboardVerticalOffset=\{topY\}/, 'the Add by initials pattern (D112)');
  assert.match(kav, /<Screen contentStyle=\{styles\.content\}/, 'the page is inside it');
  assert.match(kav, /<BottomBar style=\{styles\.bottom\} insetBottom=\{!keyboardUp\}>\s*\{typing\.barTiles \? tiles : null\}/, 'the Next bar rides on the keyboard, tiles hidden');
  assert.match(kav, /oneRow=\{typing\.stripOneRow\}/);
  const strip = src('components/players/SelectedPlayersStrip.tsx');
  assert.match(strip, /oneRow \? \([\s\S]*?<ScrollView[\s\S]*?horizontal[\s\S]*?testID="selected-strip-one-row"/);
  assert.match(strip, /if \(oneRow\) rowRef\.current\?\.scrollToEnd\(\{ animated: true \}\);/, 'the newest pick and its × stay in view');
  assert.match(strip, /<View style=\{styles\.chips\}>\{chips\}<\/View>/, 'wrapped as before when the keyboard is down');
  const keyboard = src('hooks/useKeyboardUp.ts');
  assert.match(keyboard, /keyboardDidShow/);
  assert.match(keyboard, /keyboardDidHide/);
});

test('12o: full/52 picks all twelve with the keyboard up', () => {
  const flow = src('e2e/full/52-seating-13p.yaml');
  assert.doesNotMatch(flow, /^- hideKeyboard$/m, 'no pick closes the keyboard first');
  assert.match(flow, /id: "selected-strip-one-row"/);
  assert.match(src('e2e/chaos/c03-bad-input.yaml'), /hideKeyboard/, 'c03 keeps its own');
});

// ---- One layout for every phone (Q64): no text or layout picked by width or font scale ----

const SIZE_SWITCH = /fontScale|useWindowDimensions|onLayout=\{\(e\) => set\w*\(e\.nativeEvent\.layout\.width\)|fitHeaderTitle|headerTitleRoom|myPlayersLabel|MY_PLAYERS_SHORT|playersAdminsTitle/;

test('Q64: the files 12k / 12j touched pick no text or layout by screen width or font scale', () => {
  for (const file of [
    'app/(tabs)/index.tsx',
    'app/(screens)/_layout.tsx',
    'app/(screens)/games/[id].tsx',
    'app/(screens)/games/players.tsx',
    'components/ui/HeaderTitle.tsx',
    'components/home/HomeTile.tsx',
    'components/ui/GameListItem.tsx',
    'utils/gameLabel.ts',
    'utils/gameAdmins.ts',
    'utils/homeButtons.ts',
  ]) {
    assert.doesNotMatch(src(file), SIZE_SWITCH, `${file} switches on the screen's size`);
  }
});

test('header titles: one shared title, always the full text, one line that shrinks to 75% before it is cut', () => {
  const title = src('components/ui/HeaderTitle.tsx');
  const text = title.match(/<Text[\s\S]*?>/)?.[0] ?? '';
  assert.match(text, /numberOfLines=\{1\}/);
  assert.match(text, /adjustsFontSizeToFit/);
  assert.match(text, /minimumFontScale=\{FIT_MIN_FONT_SCALE\}/);
  assert.equal(FIT_MIN_FONT_SCALE, 0.75);
  assert.match(title, /\{children\}/, 'it shows the screen\'s title as given');
  const layout = src('app/(screens)/_layout.tsx');
  assert.match(layout, /headerTitle: \(\{ children, tintColor \}\) => <HeaderTitle tintColor=\{tintColor\}>\{children\}<\/HeaderTitle>,/, 'set once in the stack defaults');
  assert.equal((layout.match(/headerTitle:/g) ?? []).length, 1, 'no screen overrides it');
});

// ---- 12k: five cut-off labels, wrapped or shrunk ----

test('12k: Home — always "My players", shrinking a little on a tight tile; the two tiles are equal halves', () => {
  const home = src('app/(tabs)/index.tsx');
  assert.match(home, /<HomeTile\s+icon="account-group"\s+label="My players"/);
  assert.match(home, /<HomeTile icon="podium" label="Results"/, 'Results is the same tile');
  assert.match(home, /<View style=\{styles\.actionRow\}>/, 'no width tracking on the row');
  assert.match(home, /results: \{\s*flex: 1,\s*flexBasis: 0,/);
  assert.match(home, /accessibilityLabel=\{myPlayersAccessibilityLabel\(playerCount\)\}/, 'the spoken label still says My players');
  const tile = src('components/home/HomeTile.tsx');
  const text = tile.match(/<Text[\s\S]*?>/)?.[0] ?? '';
  assert.match(text, /numberOfLines=\{1\}/);
  assert.match(text, /adjustsFontSizeToFit/);
  assert.match(text, /minimumFontScale=\{FIT_MIN_FONT_SCALE\}/);
  assert.match(tile, /\{label\}/);
});

test('12k: the locked Results card note wraps instead of "Give award…"', () => {
  const card = src('components/ui/GameListItem.tsx');
  const note = card.match(/<Text[^>]*testID="game-card-locked-note"[^>]*>/)?.[0] ?? '';
  assert.ok(note, 'the note has its test ID');
  assert.doesNotMatch(note, /numberOfLines/, 'no line cap');
});

test('12k: the Scorecard title is the full "Scorecard · P2" through the shared title, beside a 48-dp ⋮ (it read "Scorecar…")', () => {
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /title: screenTitle\('Scorecard', game\),/);
  assert.match(screen, /anchor=\{<IconButton icon="dots-vertical" size=\{22\} onPress=\{\(\) => setMenuOpen\(true\)\} accessibilityLabel="Scorecard menu"/, 'the ⋮ is an icon, not a compact text button');
});

test('12k: "101 left · 5 drops" breaks at the dot only', () => {
  assert.equal(leftAndDrops(101, 5), '101\u00A0left · 5\u00A0drops');
  assert.equal(leftAndDrops(50, 1), '50\u00A0left · 1\u00A0drop');
  assert.match(src('app/(screens)/games/award.tsx'), /: leftAndDrops\(inputs\.limit - r\.total, /);
});

test('12k: the Order of players dealer row ("Ravi K…") is gone with the circle (D138); names sit in the centre card on two lines', () => {
  const order = src('components/game/OrderOfPlayers.tsx');
  assert.match(order, /testID=\{`\$\{testIDPrefix\}-selected-name`\}>\{centrePlayer\.name\}/);
  assert.doesNotMatch(order, /numberOfLines=\{1\}[^>]*>\{(player|centrePlayer)\.name\}/, 'no name on one cut line');
});

test('12k: tablet smoke/22 turns really sideways and stands up again', () => {
  const flow = src('e2e/smoke/22-play-listing-frames.yaml');
  const lib = src('e2e/lib/turn-sideways.yaml');
  assert.match(lib, /- setOrientation: LANDSCAPE_LEFT[\s\S]*?when:\n\s+notVisible:\n\s+id: "landscape-table-only"\n\s+commands:\n\s+- setOrientation: PORTRAIT/);
  assert.ok(flow.indexOf('- runFlow: ../lib/turn-sideways.yaml') < flow.indexOf('- takeScreenshot: 22c-points-10p-landscape'));
  assert.match(flow, /- takeScreenshot: 22c-points-10p-landscape\n- setOrientation: PORTRAIT\n- runFlow: \.\.\/lib\/stand-upright\.yaml/);
});

// ---- 12j: Players · Admins title and help; D103's text ----

test('12j (a): the Players · Admins title is always the full "Players · Admins · S3", shrinking through the shared title', () => {
  assert.equal(screenTitle(PLAYERS_ADMINS_TITLE, { gameLabel: 'S3' }), 'Players · Admins · S3');
  assert.match(src('app/(screens)/games/players.tsx'), /title: screenTitle\(PLAYERS_ADMINS_TITLE, game\),/);
});

test('12j (b): the help names only the roles the screen shows (Creator, Admin; no Player or View only tag)', () => {
  const topic = HELP_TOPICS['players-admins'];
  const text = [...topic.needToKnow, ...(topic.screenshot?.legend ?? [])].join('\n');
  assert.doesNotMatch(text, /Player, View only|\(Creator, Admin, Player/);
  assert.match(text, /\*\*Playing\*\*, \*\*Admins not playing\*\* and \*\*Watching\*\*/);
  assert.match(text, /A \*\*Creator\*\* tag marks who started the game; creators and admins also see an \*\*Admin\*\* tag/);
  assert.equal(visibleRoleTag('Player', true), null, 'the screen never tags a plain player');
  assert.equal(visibleRoleTag('View only', true), null);
});

test('12j (c): D103 no longer says the Profile cards are built', () => {
  const d103 = src('docs/decisions.md').split('\n').find((line) => line.startsWith('| D103 ')) ?? '';
  assert.doesNotMatch(d103, /built · cards and initials/);
  assert.match(d103, /The white cards were not built:\*\* Profile is flat grouped rows \(`SettingsGroup`/);
  assert.match(src('components/ui/SettingsGroup.tsx'), /no card, no icon square/);
});

// ---- Row 8: the live page points at the app; Help has "Watch a game" ----

test('row 8: the live scorecard page ends with "Keep score like this — get EZ Score", linking to the Play listing', () => {
  const page = src('public/scorecard.html');
  const footer = page.match(/<footer class="get" id="get-app">([\s\S]*?)<\/footer>/);
  assert.ok(footer, 'the page has the get-the-app footer');
  assert.match(footer[1], /<a href="https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.mindweavetech\.rummyhome"[^>]*>Keep score like this — get EZ Score<\/a>/);
  assert.match(src('app.json'), /"package": "com\.mindweavetech\.rummyhome"/, 'the link names the package Play publishes');
  assert.ok(page.indexOf('id="get-app"') > page.indexOf('<section id="changes">'), 'the footer is the last thing on the page');
  assert.ok(page.indexOf('id="get-app"') < page.indexOf('<script>'), 'static HTML, so it also shows on an invalid or deleted link');
});

test('row 8: Help has a "Watch a game" page in Playing, found by "live link" and "spectator"', () => {
  const topic = HELP_TOPICS['watch-a-game'];
  assert.equal(topic.title, 'Watch a game');
  assert.equal(topic.group, 'Playing');
  assert.ok(helpIndex().find((g) => g.group === 'Playing')?.topics.some((t) => t.key === 'watch-a-game'));
  assert.ok(searchHelp('spectator').some((t) => t.key === 'watch-a-game'));
  assert.ok(searchHelp('live link').some((t) => t.key === 'watch-a-game'));
  assert.match(topic.needToKnow.join('\n'), /\*\*Live scorecard link\*\*/);
  assert.match(src('public/scorecard.html'), /setInterval\(load, 8000\)/, '"updates by itself every few seconds"');
});
