import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { dealerPill, dealsLine, displayRows, orderComplete, seatNumberOf, showsArrows, startOrder, stepNumbered, tapPlayer } from '../utils/seating';
import {
  DEMO_FRAME_MS,
  DEMO_PLAYERS,
  DEMO_TAP_ORDER,
  lowestCardToast,
  ORDER_ONE_LINE,
  SEATING_STEPS,
  SEATING_TUTORIAL_TITLE,
  seatingDemoFrames,
  SHOW_ME,
  stepCounter,
  TUTORIAL_DONE,
  TUTORIAL_NEXT,
  WATCH_HOW,
} from '../utils/tutorials';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

test('D74: three steps, Next · Next · Got it, nothing about seat numbers, no card pictures', () => {
  assert.equal(SEATING_STEPS.length, 3, 'Sree, Nov 21: "merge tutorial steps 2 and 3 — the last tap deals is obvious"');
  assert.equal(SEATING_TUTORIAL_TITLE, 'How to seat the table');
  assert.deepEqual(SEATING_STEPS.map((s) => s.title), ['Everyone draws a card', 'Tap the highest card first', 'Wrong tap? Fix it']);
  for (const step of SEATING_STEPS) {
    assert.doesNotMatch(step.line, /seat \d|seat N/i, `${step.title}: Sree — "we don't want to explain the seat number story"`);
    assert.ok(step.line.length <= 130, `${step.title}: one line`);
  }
  assert.match(SEATING_STEPS[1].line, /last tap is the lowest card and deals round 1/i, 'steps 2 and 3 merged');
  assert.match(SEATING_STEPS[2].line, /tap a player and use ▲ ▼ to move them/i, 'the arrow rule as built');
  assert.equal(TUTORIAL_NEXT, 'Next');
  assert.equal(TUTORIAL_DONE, 'Got it');
  assert.equal(stepCounter(0, 3), '1 of 3');
  assert.equal(stepCounter(2, 3), '3 of 3');
  const demo = read('components/tutorial/SeatingTutorial.tsx');
  assert.doesNotMatch(demo, /frame\.cards|player\.card|styles\.card/, 'no card pictures: "in some places even Joker is highest"');
  assert.doesNotMatch(read('utils/tutorials.ts'), /cards: (true|false)/);
});

test('D74: the demo loop is scripted from the real seating model, highest card first, the last tap deals', () => {
  assert.equal(DEMO_PLAYERS.length, 4);
  const cardOf = new Map(DEMO_PLAYERS.map((p) => [p.id, p.card]));
  assert.deepEqual(DEMO_TAP_ORDER.map((id) => cardOf.get(id)), ['K♠', '7♣', '4♥', '2♦'], 'the tap order runs from the highest card to the lowest');
  for (let step = 0; step < 3; step += 1) {
    const frames = seatingDemoFrames(step);
    assert.ok(frames.length >= 3, `step ${step + 1} has a loop`);
    assert.ok(frames.length * DEMO_FRAME_MS <= 9000, `step ${step + 1} loops within a few seconds`);
    for (const frame of frames) assert.equal(displayRows(frame.draft).length, 4, 'every frame shows all four rows');
  }
  // Step 2 (merged): K, 7, 4, then the 2 — the last tap completes the order as seat 1, the dealer.
  const step2 = seatingDemoFrames(1);
  const end2 = step2[step2.length - 1].draft;
  assert.deepEqual(displayRows(end2), ['anu', 'bala', 'chitra', 'dev']);
  assert.equal(seatNumberOf(end2, 'anu'), 4);
  assert.ok(orderComplete(end2));
  assert.equal(seatNumberOf(end2, 'dev'), 1);
  assert.equal(end2.numbered[0], 'dev', 'seat 1 deals');
  for (const id of DEMO_TAP_ORDER) assert.ok(step2.some((f) => f.finger === id), `the finger taps ${id}`);
  // Step 3: the latest tap comes back off; then, everyone numbered, a player is selected and ▲ moves them.
  const step3 = seatingDemoFrames(2);
  assert.ok(step3.some((f) => !orderComplete(f.draft)), 'take-back shows an unnumbered row');
  const moved = step3[step3.length - 1].draft;
  assert.equal(seatNumberOf(moved, 'chitra'), 3, 'the arrow moved Chitra up one seat');
  assert.equal(seatNumberOf(moved, 'bala'), 2);
});

// The Show me demo still draws the D74 list (redrawing it as the circle is a follow-up); the screen uses tapRing (seat-ring.test.ts).
test('D74 (the Show me demo\'s list): arrows — all at rest, only the selected row while one is selected, deselect by tapping again', () => {
  const four = ['sree', 'harish', 'priya', 'zed'];
  let d = startOrder(four);
  for (const id of four) assert.equal(showsArrows(d, id), false, 'unnumbered rows have no arrows');
  d = tapPlayer(d, 'zed');
  assert.ok(showsArrows(d, 'zed') && !showsArrows(d, 'sree'), 'while numbering the latest tap is the selected row');
  d = tapPlayer(tapPlayer(tapPlayer(d, 'sree'), 'harish'), 'priya');
  assert.ok(orderComplete(d));
  assert.equal(d.focus, 'priya');
  assert.deepEqual(four.map((id) => showsArrows(d, id)), [false, false, true, false], 'everyone numbered, Priya selected: only her arrows');
  d = tapPlayer(d, 'priya');
  assert.equal(d.focus, null, 'the same tap again deselects (it no longer takes the number back once everyone is numbered)');
  assert.ok(orderComplete(d), 'nothing was un-numbered');
  assert.deepEqual(four.map((id) => showsArrows(d, id)), [true, true, true, true], 'nobody selected: every numbered row shows its arrows');
  d = tapPlayer(d, 'harish');
  assert.deepEqual(four.map((id) => showsArrows(d, id)), [false, true, false, false], 'selection moves');
  d = stepNumbered(d, 'harish', 1);
  assert.equal(d.focus, 'harish', 'an arrow keeps the selection on the player, so three taps move three seats');
  // A prefilled mid-game sheet starts with nobody selected (the demo's list shows all arrows; the circle shows none).
  assert.deepEqual(four.map((id) => showsArrows(startOrder(four, true), id)), [true, true, true, true]);
});

test('D61 → D138: the last tap names the dealer in the middle of the circle — "you" for the signed-in player', () => {
  assert.equal(lowestCardToast('Sree Test', true), 'Lowest card — you deal round 1', 'the demo keeps its words');
  assert.equal(dealerPill(1, true), 'Dealer · you deal round 1');
  assert.equal(dealerPill(1, false), 'Dealer · deals round 1');
  assert.equal(dealsLine('Harish Test', 1, false), 'Harish Test deals round 1');
  assert.equal(dealsLine('Sree Test', 6, true), 'You deal round 6');
  const ring = read('components/game/OrderOfPlayers.tsx');
  assert.match(ring, /testID=\{`\$\{testIDPrefix\}-flash-deals`\}>\{dealerPill\(dealRound, shown\.id === meId\)\}/, 'the flash on the dealer\'s tap');
  assert.match(ring, /dealsLine\(dealerName, dealRound, dealsNext === meId\)/, 'and the middle at rest');
  const step = read('components/game/OrderStep.tsx');
  assert.match(step, /!orderComplete\(draft\) && orderComplete\(next\)\) void lightTap\(\)/, 'a light tap of the phone on the tap that completes the order, not on Clear or a reload');
  assert.doesNotMatch(step, /<Toast/, 'the toast went: the middle card says it');
  assert.match(read('utils/haptics.ts'), /impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/);
  assert.match(read('package.json'), /"expo-haptics"/);
});

test('D74: never opens by itself — Show me on the screen, Watch how in Help; the sheet is always dismissable', () => {
  const sheet = read('components/tutorial/StepsSheet.tsx');
  assert.doesNotMatch(sheet, /forced[?]?[:=]|dismissable=/, 'Sree, Nov 23: "I don\'t want it to pop up as a default anymore"');
  assert.match(sheet, /<Dialog visible=\{visible\} onDismiss=\{onDone\}/);
  assert.doesNotMatch(sheet, />\s*Cancel\s*</, 'no Cancel button: Got it or a tap outside');
  const hook = read('hooks/useTutorial.ts');
  assert.doesNotMatch(hook, /useEffect|setForced|tutorialsService/, 'no first-visit check, no flag read');
  assert.ok(!existsSync(path.join(process.cwd(), 'services/tutorials.ts')), 'the seen-flag service is gone with the forced run');
  // The screen: one line + Show me, on the New game step and the mid-game sheet alike.
  assert.equal(ORDER_ONE_LINE, 'Tap players from the highest card to the lowest.');
  assert.equal(SHOW_ME, 'Show me');
  // D138: the line and Show me sit in the middle of the circle.
  const ring = read('components/game/OrderOfPlayers.tsx');
  assert.match(ring, /\{building \? ORDER_ONE_LINE : RING_REST_DONE\}/);
  assert.match(ring, /testID=\{`\$\{howToTestID\}-show-me`\}/);
  assert.ok(!existsSync(path.join(process.cwd(), 'components/game/OrderHowTo.tsx')));
  assert.match(read('components/game/OrderStep.tsx'), /onShowMe=\{tutorial\.show\}\s*howToTestID="order-how-to"/);
  assert.match(read('components/game/SeatingSheet.tsx'), /onShowMe=\{tutorial\.show\}\s*howToTestID="seating-how-to"/);
  // Help › New game › Order of players: the Watch how button and the arrow rule in words.
  assert.equal(WATCH_HOW, 'Watch how (20 s)');
  const topics = read('constants/helpTopics.ts');
  assert.match(topics, /title: 'Order of players',\s*watch: 'seating'/);
  assert.match(topics, /tap a player and use the ▲ ▼ arrows to move them one seat; tap them again to deselect/);
  assert.doesNotMatch(topics, /the screen also opens them the first time/);
  const page = read('components/help/HelpPage.tsx');
  assert.match(page, /testID=\{`help-watch-\$\{s\.watch\}`\}/);
  assert.match(page, /<SeatingTutorial visible=\{watching === 'seating'\} onDone=\{watched\} \/>/);
  // The flow opens the steps from Show me, three of them, and never waits for a forced sheet.
  const flow = read('e2e/smoke/24-seating-tutorial.yaml');
  assert.match(flow, /text: "1 of 3"/);
  assert.doesNotMatch(flow, /1 of 4|forced/);
});

test('D138: the selected player lifts out — a primary ring, a little larger, the others dimmed; his name and ▲ ▼ in the middle', () => {
  const src = read('components/game/OrderOfPlayers.tsx');
  assert.match(src, /selected === id && \{ borderWidth: 3, borderColor: colors\.primary, transform: \[\{ scale: 1\.08 \}\] \}/);
  assert.match(src, /const dim = Boolean\(selected && selected !== id\);/);
  assert.match(src, /opacity: dim \? 0\.4 : 1/);
  assert.match(src, /style=\{\[styles\.move, \{ backgroundColor: colors\.primary \}\]\}/, 'filled arrows');
  assert.match(src, /onLongPress=\{\(\) => \{\}\}/, 'a long tap does nothing');
});
