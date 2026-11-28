import test from 'node:test';
import assert from 'node:assert/strict';
import {
  badgeSize,
  CENTRE_MIN_WIDTH,
  dealArrow,
  discSize,
  discWidth,
  initialsFontSize,
  initialsWidth,
  layoutRing,
  RING_DISC_MIN,
  RING_GAP,
  RingLayout,
  screenAngle,
} from '../utils/seatRing';
import {
  clearOrder,
  deselect,
  displayOrder,
  displayRows,
  nextDealerFor,
  orderComplete,
  seatNumberOf,
  startOrder,
  stepNumbered,
  stepsFor,
  tapRing,
} from '../utils/seating';

// D138 (Sree, Nov 27): "the highest on the top … The second highest goes to the left. It goes on like that … The
// dealer is always one step to the right … give him number 1." "Make your design work for up to 13, and then 14
// onwards, it's okay if it doesn't look that great, but if you can make it work, definitely make it work."

/** The ring box on the CI phones: the window less the page gutters; the height between the title and the buttons. */
const PIXEL6 = { width: 411 - 32, height: 630, fontScale: 1 };
const SMALL = { width: 360 - 32, height: 480, fontScale: 1.3 };
const initials = (n: number) => Array.from({ length: n }, (_, i) => `${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(75 + (i % 10))}`);
/** Every fifth player has the widest initials the app makes (WWW, MMM, a deduped HG2). */
const wide = (n: number) => initials(n).map((label, i) => (i % 5 === 0 ? ['WWW', 'MMM', 'HG2'][(i / 5) % 3] : label));

const stadiumGap = (L: RingLayout, i: number, k: number) => {
  const p = L.points[i];
  const q = L.points[k];
  const dx = Math.max(0, Math.abs(p.x - q.x) - (L.widths[i] - L.disc + L.widths[k] - L.disc) / 2);
  return Math.hypot(dx, p.y - q.y) - L.disc;
};

function assertClear(L: RingLayout, what: string) {
  const n = L.points.length;
  for (let i = 0; i < n; i += 1) {
    for (let k = i + 1; k < n; k += 1) assert.ok(stadiumGap(L, i, k) >= RING_GAP - 0.01, `${what}: discs ${i} and ${k} touch`);
    // A badge never sits on another player's disc.
    for (let k = 0; k < n; k += 1) {
      if (k === i) continue;
      const b = L.badges[i];
      const d = L.points[k];
      const apart = Math.abs(b.x - d.x) >= L.badge / 2 + L.widths[k] / 2 || Math.abs(b.y - d.y) >= L.badge / 2 + L.disc / 2;
      assert.ok(apart, `${what}: badge ${i} on disc ${k}`);
    }
    // Inside the box, left to right.
    assert.ok(L.points[i].x - L.widths[i] / 2 >= 0 && L.points[i].x + L.widths[i] / 2 <= L.boxWidth, `${what}: disc ${i} runs off the side`);
    assert.ok(L.points[i].y - L.disc / 2 >= 0 && L.points[i].y + L.disc / 2 <= L.boxHeight, `${what}: disc ${i} runs off the top or bottom`);
  }
}

test('D138: seat N (the first tap) at 12 o\'clock, N-1 to its left, seat 1 one step to the right of the top', () => {
  for (const device of [PIXEL6, SMALL]) {
    for (let n = 2; n <= 20; n += 1) {
      const L = layoutRing({ labels: initials(n), ...device, dealerIndex: n - 1 });
      const top = L.points[0];
      assert.ok(Math.abs(top.x - L.cx) < 0.5, `${n}: the highest seat is centred`);
      assert.ok(L.points.every((p) => p.y >= top.y - 0.5), `${n}: nothing sits above the highest seat`);
      if (n >= 3) {
        assert.ok(L.points[1].x < L.cx, `${n}: seat N-1 is left of the top`);
        assert.ok(L.points[n - 1].x > L.cx, `${n}: seat 1 is right of the top`);
      }
      if (n >= 5) assert.ok(L.points[n - 1].y < L.cy, `${n}: seat 1 is in the top half (about 1 o'clock)`);
      if (n === 2) assert.ok(L.points[1].y > L.cy, 'two players: seat 1 faces the highest across the table');
    }
  }
});

test('D138: the seats run anticlockwise on the screen (top → left → bottom → right), once round', () => {
  for (const device of [PIXEL6, SMALL]) {
    for (let n = 3; n <= 20; n += 1) {
      const L = layoutRing({ labels: wide(n), ...device });
      // Unwrapped screen angle, anticlockwise positive, starting at the top (π/2).
      let last = screenAngle(L, L.points[0]);
      assert.ok(Math.abs(last - Math.PI / 2) < 0.01, `${n}: position 0 at 12 o'clock`);
      let turned = 0;
      for (let i = 1; i < n; i += 1) {
        let step = screenAngle(L, L.points[i]) - last;
        while (step <= 0) step += 2 * Math.PI;
        assert.ok(step > 0 && step < Math.PI * 1.01, `${n}: position ${i} is anticlockwise of ${i - 1}`);
        turned += step;
        last += step;
      }
      assert.ok(turned < 2 * Math.PI, `${n}: once round, not more`);
    }
  }
});

test('D95 / D52: discs never under 48 dp and never narrower than their letters — 2 to 20 players, 360 dp × text 1.3', () => {
  for (let n = 2; n <= 20; n += 1) {
    const L = layoutRing({ labels: wide(n), ...SMALL });
    assert.ok(L.disc >= RING_DISC_MIN, `${n}: disc height`);
    L.widths.forEach((w, i) => {
      assert.ok(w >= RING_DISC_MIN, `${n}: disc ${i} width`);
      assert.ok(w >= initialsWidth(wide(n)[i], initialsFontSize(L.disc) * SMALL.fontScale), `${n}: ${wide(n)[i]} fits its pill`);
    });
  }
  assert.equal(discSize(10), 56, 'up to 10 players: 56 dp');
  assert.equal(discSize(11), 48, 'from 11: 48 dp, the touch target');
  assert.ok(discWidth('WWW', 1.3, 48) > 48, 'WWW at text 1.3 is a pill');
  assert.equal(discWidth('AK', 1, 56), 56, 'two letters are a round disc');
  assert.equal(badgeSize(1.3), 29);
});

test('no two discs touch and no badge sits on a disc: 2–20 players, both CI phones, plain and widest initials, any dealer', () => {
  for (const device of [PIXEL6, SMALL, { width: 328, height: 480, fontScale: 2 }, { width: 700, height: 230, fontScale: 1 }]) {
    for (let n = 2; n <= 20; n += 1) {
      for (const labels of [initials(n), wide(n)]) {
        for (const dealerIndex of [null, n - 1, 0, Math.floor(n / 2), Math.floor(n / 3)]) {
          const L = layoutRing({ labels, ...device, dealerIndex });
          assertClear(L, `${device.width}×${device.height}@${device.fontScale} n=${n} dealer=${dealerIndex}`);
          if (dealerIndex != null && n >= 2) {
            assert.ok(L.dealerTag, 'there is a Dealer tag');
            assert.ok(L.dealerTag!.x - L.dealerTagWidth / 2 >= 0 && L.dealerTag!.x + L.dealerTagWidth / 2 <= L.boxWidth, 'the tag stays on screen');
            for (let k = 0; k < n; k += 1) {
              if (k === dealerIndex) continue;
              const d = L.points[k];
              const apart = Math.abs(L.dealerTag!.x - d.x) >= L.dealerTagWidth / 2 + L.widths[k] / 2 || Math.abs(L.dealerTag!.y - d.y) >= L.dealerTagHeight / 2 + L.disc / 2;
              assert.ok(apart, `n=${n}: the Dealer tag sits on disc ${k}`);
            }
          }
        }
      }
    }
  }
});

test('where it fits on one screen (the PR\'s "Where it fails" table): Pixel 6 always to 20; the small phone to 18 on New game, 12 mid-game; then it scrolls', () => {
  for (let n = 2; n <= 20; n += 1) {
    const L = layoutRing({ labels: initials(n), ...PIXEL6, dealerIndex: n - 1 });
    assert.ok(L.fits, `Pixel 6, ${n} players: one screen (${L.boxHeight} of ${PIXEL6.height})`);
    assert.ok(L.centre.width >= CENTRE_MIN_WIDTH, `Pixel 6, ${n} players: the middle card fits beside the discs (${L.centre.width})`);
    // Mid-game the Dealer mark can be anyone; the page's subline and note leave about 540 dp.
    for (let d = 0; d < n; d += 1) assert.ok(layoutRing({ labels: initials(n), ...PIXEL6, height: 540, dealerIndex: d }).fits, `Pixel 6 mid-game, ${n} players, dealer at ${d}`);
  }
  for (let n = 2; n <= 18; n += 1) {
    const L = layoutRing({ labels: initials(n), ...SMALL, dealerIndex: n - 1 });
    assert.ok(L.fits, `360 × 1.3, ${n} players: one screen (${L.boxHeight} of ${SMALL.height})`);
    if (n <= 16) assert.ok(layoutRing({ labels: wide(n), ...SMALL, dealerIndex: n - 1 }).fits, `360 × 1.3, ${n} players with some three-letter pills`);
  }
  for (let n = 2; n <= 12; n += 1) {
    for (let d = 0; d < n; d += 1) assert.ok(layoutRing({ labels: initials(n), ...SMALL, height: 390, dealerIndex: d }).fits, `360 × 1.3 mid-game (yellow note), ${n} players, dealer at ${d}`);
  }
  assert.equal(layoutRing({ labels: initials(20), ...SMALL, dealerIndex: 19 }).fits, false, '360 × 1.3, 20 players: taller than the screen → the page scrolls');
  assert.equal(layoutRing({ labels: wide(18), ...SMALL, dealerIndex: 17 }).fits, false, '360 × 1.3, 18 players with three-letter pills: scrolls');
  const big = layoutRing({ labels: wide(20), width: 328, height: 480, fontScale: 2, dealerIndex: 19 });
  assert.equal(big.fits, false, 'text 2.0: scrolls');
  assert.equal(big.disc, 48, 'and the discs still do not shrink');
  assert.ok(big.boxHeight < 4 * 480, 'but never runs away: under four screens even then');
});

test('the deal arrow leaves the dealer anticlockwise (towards the highest card, who gets the first card)', () => {
  for (const n of [4, 6, 13, 20]) {
    const L = layoutRing({ labels: initials(n), ...PIXEL6, dealerIndex: n - 1 });
    const { points, angle } = dealArrow(L, n - 1);
    assert.ok(points.length >= 3);
    const angles = points.map((p) => screenAngle(L, p));
    for (let i = 1; i < angles.length; i += 1) {
      let step = angles[i] - angles[i - 1];
      while (step < -Math.PI) step += 2 * Math.PI;
      assert.ok(step > 0, `${n}: dot ${i} is anticlockwise of dot ${i - 1}`);
    }
    // From 1 o'clock towards 12, the head points left (and a little up).
    assert.ok(angle < 0 && angle > -180, `${n}: the head points left (${angle.toFixed(0)}°)`);
  }
});

// ---------- the taps (D56 numbering unchanged, D138 selection) ----------
const six = ['ravi', 'anil', 'kiran', 'meena', 'priya', 'sree'];

test('D138 taps: a tap numbers the next seat down and selects nobody; the latest tapped again gives his number back', () => {
  let d = startOrder(six);
  d = tapRing(d, 'meena');
  assert.equal(seatNumberOf(d, 'meena'), 6, 'first tap = highest card = seat 6');
  assert.equal(d.focus, null, 'numbering selects nobody (the middle flashes instead)');
  assert.equal(displayRows(d)[0], 'meena', 'ring position 1 (12 o\'clock) is seat 6');
  d = tapRing(d, 'kiran');
  assert.equal(seatNumberOf(d, 'kiran'), 5);
  assert.deepEqual(displayRows(d).slice(0, 2), ['meena', 'kiran'], 'seat 5 sits just left of the top');
  d = tapRing(d, 'kiran');
  assert.equal(seatNumberOf(d, 'kiran'), null, 'the latest tapped again: number back');
  assert.equal(d.focus, null);
  d = tapRing(d, 'kiran');
  d = tapRing(d, 'meena');
  assert.equal(d.focus, 'meena', 'tapping an earlier numbered player selects him');
  assert.deepEqual(stepsFor(d, 'meena'), { up: false, down: true }, 'the highest seat has no ▲');
  d = tapRing(d, 'meena');
  assert.equal(d.focus, null, 'tap him again to let go');
  d = tapRing(d, 'meena');
  assert.deepEqual(deselect(d).focus, null, 'a tap on the table lets go too');
  d = tapRing(d, 'anil');
  assert.equal(d.focus, null, 'numbering someone else lets go of the selection');
  assert.equal(seatNumberOf(d, 'anil'), 4);
});

test('D138 taps: the last tap is seat 1 and deals; once everyone is numbered every tap selects (seat 1 too); ▲ ▼ only for him', () => {
  let d = startOrder(six);
  for (const id of ['meena', 'kiran', 'anil', 'priya', 'sree', 'ravi']) d = tapRing(d, id);
  assert.ok(orderComplete(d));
  assert.equal(seatNumberOf(d, 'ravi'), 1);
  assert.equal(displayRows(d)[5], 'ravi', 'seat 1 is the last ring position: one step right of the top');
  assert.equal(nextDealerFor(displayOrder(d), null, 0), 'ravi', 'seat 1 deals round 1');
  d = tapRing(d, 'ravi');
  assert.equal(d.focus, 'ravi', 'complete: the tap selects, it does not undo');
  assert.deepEqual(stepsFor(d, 'ravi'), { up: true, down: false }, 'seat 1 has no ▼ (D59)');
  d = stepNumbered(d, 'ravi', 1);
  assert.equal(seatNumberOf(d, 'ravi'), 2);
  assert.equal(d.focus, 'ravi', 'an arrow keeps him selected');
  assert.equal(nextDealerFor(displayOrder(d), null, 0), 'sree', 'Sree took seat 1, so he deals');
  assert.deepEqual(stepsFor(d, 'kiran'), { up: true, down: true });
  assert.equal(clearOrder(d).numbered.length, 0);
  // Mid-game opens prefilled with nobody selected and no arrows at rest.
  const mid = startOrder(six, true);
  assert.equal(mid.focus, null);
  assert.equal(tapRing(mid, 'anil').focus, 'anil');
});

test('mid-game: the Dealer mark is the scorecard\'s next dealer — the seat after the last round\'s dealer, or the Dealer sheet\'s pick', () => {
  const order = ['ravi', 'anil', 'kiran', 'meena'];
  assert.equal(nextDealerFor(order, ['ravi', 'anil'], 2), 'kiran', 'seat 1, 2 dealt; seat 3 deals round 3');
  assert.equal(nextDealerFor(order, ['ravi', 'anil'], 2, new Set(), { playerId: 'meena', round: 3, keepsSequence: false }), 'meena', 'the Dealer sheet named Meena for round 3');
  assert.equal(nextDealerFor(order, ['ravi', 'anil'], 2, new Set(), { playerId: 'meena', round: 2, keepsSequence: false }), 'kiran', 'an override for another round does not count');
  assert.equal(nextDealerFor(order, ['ravi', 'anil'], 2, new Set(['meena']), { playerId: 'meena', round: 3, keepsSequence: false }), 'kiran', 'nor one for a player who is out');
});
