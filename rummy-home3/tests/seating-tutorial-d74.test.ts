import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { dealerPill, dealsLine, displayRows, orderComplete, seatNumberOf, stepsFor } from '../utils/seating';
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

test('D138: the Show me demo is the circle — highest at the top, the dealer one step right, ▲ ▼ only for the selected player', () => {
  // Ring position 1 is 12 o'clock, then anticlockwise; position 4 of 4 is one step right of the top.
  const step2 = seatingDemoFrames(1);
  const end = displayRows(step2[step2.length - 1].draft);
  assert.equal(end[0], 'anu', 'the K (seat 4) at the top');
  assert.equal(end[3], 'dev', 'the 2 (seat 1, the dealer) one step right of the top');
  assert.ok(step2.every((f) => f.draft.focus == null), 'numbering never selects anyone (tapRing): no arrows while tapping');
  for (const id of DEMO_TAP_ORDER) assert.ok(step2.some((f) => f.flash === id && seatNumberOf(f.draft, id) != null), `the middle names ${id} after the tap`);
  const step3 = seatingDemoFrames(2);
  const taken = step3.findIndex((f) => f.flash === 'chitra');
  assert.equal(step3[taken - 1].finger, 'chitra', 'the latest player tapped again…');
  assert.equal(seatNumberOf(step3[taken].draft, 'chitra'), null, '…gives his number back');
  const up = step3.find((f) => f.finger === 'up');
  assert.ok(up && up.draft.focus === 'chitra' && stepsFor(up.draft, 'chitra').up, 'the finger is on the selected player\'s ▲');
  assert.equal(step3[step3.length - 1].draft.focus, null, 'the loop ends with nobody selected');
  const demo = read('components/tutorial/SeatingTutorial.tsx');
  assert.match(demo, /layoutRing\(\{ labels, width: Math\.max\(width, DEMO_MIN_WIDTH\), height: DEMO_HEIGHT, fontScale: fs, dealerIndex: tagAt \}\)/, 'the screen\'s own geometry');
  assert.match(demo, /if \(selected\) \{\s*const steps = stepsFor\(draft, selected\)/, 'arrows only in the middle, for the selected player');
  assert.match(demo, /\{DEALER_TAG\}/);
  assert.doesNotMatch(demo, /SEAT_ROW_MIN_HEIGHT|demo-row-/, 'no list rows left');
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
