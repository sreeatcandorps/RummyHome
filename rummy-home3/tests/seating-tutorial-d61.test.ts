import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { displayRows, orderComplete, seatNumberOf } from '../utils/seating';
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

test('D61: four steps, Next · Next · Next · Got it, nothing about seat numbers', () => {
  assert.equal(SEATING_STEPS.length, 4);
  assert.equal(SEATING_TUTORIAL_TITLE, 'How to seat the table');
  assert.deepEqual(SEATING_STEPS.map((s) => s.title), ['Everyone draws a card', 'Tap the highest card first', 'The last tap deals', 'Wrong tap? Fix it']);
  for (const step of SEATING_STEPS) {
    assert.doesNotMatch(step.line, /seat \d|seat N/i, `${step.title}: Sree — "we don't want to explain the seat number story"`);
    assert.ok(step.line.length <= 130, `${step.title}: one line`);
  }
  assert.match(SEATING_STEPS[2].line, /lowest card.*deals round 1/i);
  assert.equal(TUTORIAL_NEXT, 'Next');
  assert.equal(TUTORIAL_DONE, 'Got it');
  assert.equal(stepCounter(0, 4), '1 of 4');
  assert.equal(stepCounter(3, 4), '4 of 4');
});

test('D61: the demo loop is scripted from the real seating model, highest card first, the last tap deals', () => {
  assert.equal(DEMO_PLAYERS.length, 4);
  const cardOf = new Map(DEMO_PLAYERS.map((p) => [p.id, p.card]));
  assert.deepEqual(DEMO_TAP_ORDER.map((id) => cardOf.get(id)), ['K♠', '7♣', '4♥', '2♦'], 'the tap order runs from the highest card to the lowest');
  for (let step = 0; step < 4; step += 1) {
    const frames = seatingDemoFrames(step);
    assert.ok(frames.length >= 3, `step ${step + 1} has a loop`);
    assert.ok(frames.length * DEMO_FRAME_MS <= 7000, `step ${step + 1} loops within a few seconds`);
    for (const frame of frames) assert.equal(displayRows(frame.draft).length, 4, 'every frame shows all four rows');
  }
  // Step 2 ends with three numbered: the K on top as seat 4, the 7 as seat 3, the 4 as seat 2; the 2 unnumbered at the bottom.
  const step2 = seatingDemoFrames(1);
  const end2 = step2[step2.length - 1].draft;
  assert.deepEqual(displayRows(end2), ['anu', 'bala', 'chitra', 'dev']);
  assert.equal(seatNumberOf(end2, 'anu'), 4);
  assert.equal(seatNumberOf(end2, 'chitra'), 2);
  assert.equal(seatNumberOf(end2, 'dev'), null);
  assert.ok(step2.some((f) => f.finger === 'anu') && step2.some((f) => f.finger === 'bala') && step2.some((f) => f.finger === 'chitra'), 'the finger taps K, 7, 4');
  // Step 3: the last tap (the 2) completes the order as seat 1 — the dealer.
  const step3 = seatingDemoFrames(2);
  const end3 = step3[step3.length - 1].draft;
  assert.ok(orderComplete(end3));
  assert.equal(seatNumberOf(end3, 'dev'), 1);
  assert.equal(end3.numbered[0], 'dev', 'seat 1 deals');
  assert.ok(step3.some((f) => f.finger === 'dev'));
  // Step 4: the latest tap comes back off, then an arrow moves a player one seat.
  const step4 = seatingDemoFrames(3);
  assert.ok(step4.some((f) => !orderComplete(f.draft)), 'take-back shows an unnumbered row');
  const moved = step4[step4.length - 1].draft;
  assert.equal(seatNumberOf(moved, 'chitra'), 3, 'the arrow moved Chitra up one seat');
  assert.equal(seatNumberOf(moved, 'bala'), 2);
});

test('D61: the real last tap names the dealer — "you" for the signed-in player', () => {
  assert.equal(lowestCardToast('Sree Test', true), 'Lowest card — you deal round 1');
  assert.equal(lowestCardToast('Harish Test', false), 'Lowest card — Harish Test deals round 1');
  const step = read('components/game/OrderStep.tsx');
  assert.match(step, /lowestCardToast\(dealer\.name, dealer\.id === meId\)/);
  assert.match(step, /!orderComplete\(draft\) && orderComplete\(next\)/, 'fires on the tap that completes the order, not on Clear or a reload');
  assert.match(step, /void lightTap\(\)/, 'with a light tap of the phone');
  assert.match(step, /<Toast message=\{toast\}.*aboveBar/, 'the toast sits above the Back · Clear · Next bar');
  assert.match(read('utils/haptics.ts'), /impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/);
  assert.match(read('package.json'), /"expo-haptics"/);
});

test('D61: forced the first time, Show me on the screen, Watch how in Help, the how-to shrunk to one line', () => {
  const sheet = read('components/tutorial/StepsSheet.tsx');
  assert.match(sheet, /dismissable=\{!forced\}/, 'the first-time run cannot be tapped away');
  assert.match(sheet, /onDismiss=\{forced \? undefined : onDone\}/);
  assert.doesNotMatch(sheet, />\s*Cancel\s*</, 'no Cancel button: the way out is through the steps');
  const hook = read('hooks/useTutorial.ts');
  assert.match(hook, /if \(!seen\) \{ setForced\(true\); setVisible\(true\); \}/);
  assert.match(hook, /tutorialsService\.markSeen\(flag\)/);
  const service = read('services/tutorials.ts');
  assert.match(service, /profiles.*default_settings|from\('profiles'\)\.select\('default_settings'\)/s, 'the flag lives on the profile (jsonb, no migration)');
  assert.match(service, /\[userId\]: \{ \.\.\.\(local\[userId\] \?\? \{\}\), \[flag\]: true \}/, 'per person on a shared phone');
  // The screen: one line + Show me, on the New game step and the mid-game sheet alike.
  assert.equal(ORDER_ONE_LINE, 'Tap players from the highest card to the lowest.');
  assert.equal(SHOW_ME, 'Show me');
  const howTo = read('components/game/OrderHowTo.tsx');
  assert.match(howTo, /ORDER_ONE_LINE/);
  assert.match(howTo, /testID=\{`\$\{testID\}-show-me`\}/);
  assert.match(read('components/game/OrderStep.tsx'), /<OrderHowTo onShowMe=\{tutorial\.show\} testID="order-how-to" \/>/);
  assert.match(read('components/game/SeatingSheet.tsx'), /<OrderHowTo onShowMe=\{tutorial\.show\} testID="seating-how-to" \/>/);
  assert.match(read('components/game/SeatingSheet.tsx'), /useTutorial\('seating', visible\)/, 'the mid-game sheet checks only while open');
  // Help › New game › Order of players: the Watch how button.
  assert.equal(WATCH_HOW, 'Watch how (20 s)');
  const topics = read('constants/helpTopics.ts');
  assert.match(topics, /title: 'Order of players',\s*watch: 'seating'/);
  const page = read('components/help/HelpPage.tsx');
  assert.match(page, /testID=\{`help-watch-\$\{s\.watch\}`\}/);
  assert.match(page, /<SeatingTutorial visible=\{watching === 'seating'\} forced=\{false\}/, 'never forced from Help');
  // The seeds: every seeded account has seen it except Ravi, so the old flows meet the screen as before.
  const seed = read('supabase/seed-listing.sql');
  assert.match(seed, /"seatingTutorialSeen": true/);
  assert.match(seed, /where id <> '00000000-0000-4000-8000-000000000d01'/);
  assert.match(read('e2e/smoke/24-seating-tutorial.yaml'), /EMAIL: demo@test\.local/);
});
