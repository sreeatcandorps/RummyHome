/**
 * Order of players as a circle (D138, Sree Nov 27): where each disc sits on the oval. Pure numbers, no React.
 *
 * Ring positions are counted from the top, anticlockwise on the screen: position 0 is 12 o'clock and holds the
 * highest seat (seat N, the first tap), position 1 is just to its left, then down the left side, across the
 * bottom and up the right, so the last position (seat 1, the last tap, who deals round 1) ends one step to the
 * right of the top. That is the order of `displayRows` in `utils/seating.ts`: ring position p = list row p.
 *
 * Discs are 56 dp up to 10 players and 48 dp from 11 (never under 48, the touch target). A disc grows into a pill
 * to fit its initials at the current text size and never cuts them (D95). Gaps along the oval follow the disc
 * widths; the oval grows taller until no two discs, badges or the dealer tag touch and the middle card fits.
 * When that is taller than the space given, `fits` is false and the host scrolls (the discs never shrink).
 */

export type Point = { x: number; y: number };

export type RingInput = {
  /** Initials in ring order (position 0 = top = the highest seat, then anticlockwise). */
  labels: readonly string[];
  /** Width of the ring box (dp). */
  width: number;
  /** Height the host can give the ring box before it has to scroll (dp). */
  height: number;
  fontScale: number;
  /** The ring position whose badge carries the "Dealer" tag (wider than a plain badge), if any. */
  dealerIndex?: number | null;
};

export type RingLayout = {
  /** Disc height (and the minimum width). */
  disc: number;
  /** Disc width per position (≥ `disc`). */
  widths: number[];
  /** Disc centres, in box coordinates. */
  points: Point[];
  /** Seat-number badge centres (just inside the ring, in front of each disc). */
  badges: Point[];
  /** Badge diameter. */
  badge: number;
  /** Centre of the "Dealer" tag (on the dealer's disc, away from the middle line), when there is a dealer. */
  dealerTag: Point | null;
  dealerTagWidth: number;
  dealerTagHeight: number;
  /** Oval half-axes through the disc centres, and the centre of the oval. */
  a: number;
  b: number;
  cx: number;
  cy: number;
  boxWidth: number;
  boxHeight: number;
  /** Room in the middle for the name card. */
  centre: { width: number; height: number };
  /** True when the whole ring fits in `height`; false → the host scrolls. */
  fits: boolean;
};

export const RING_DISC_LARGE = 56;
export const RING_DISC_MIN = 48;
/** Players from which the discs drop from 56 to 48 dp. */
export const RING_SMALL_DISCS_FROM = 11;
/** Space kept clear between two discs (dp). */
export const RING_GAP = 4;
/** The oval never gets wider than this half-axis (tablets): a 4-player table stays a table, not a racetrack. */
export const RING_MAX_HALF_WIDTH = 260;
/** Padding round the oval inside its box. */
export const RING_PAD = 8;
/** The tallest the oval may grow while looking for room (20 players at text 2.0 still lands far below it). */
const RING_MAX_HALF_HEIGHT = 4000;
/** How many times the arc between two touching neighbours may grow before the oval grows instead. */
const MAX_BUMPS = 400;
const RING_STEP = 4;
const SAMPLES = 720;

export const discSize = (count: number) => (count < RING_SMALL_DISCS_FROM ? RING_DISC_LARGE : RING_DISC_MIN);

/** The initials' font size before the phone's text size is applied (19 on a 56 disc, 16 on a 48 disc). */
export const initialsFontSize = (disc: number) => Math.round(disc / 3);

/**
 * Width of bold initials at `fontPx`, a little generous so the drawn pill is never narrower than its letters
 * (W and M are the widest Roboto capitals; digits are narrow; the dedupe suffix is a digit, "HG2").
 */
export function initialsWidth(label: string, fontPx: number): number {
  let em = 0;
  for (const ch of label) em += ch === 'W' ? 0.95 : ch === 'M' ? 0.9 : /\d/.test(ch) ? 0.6 : /[a-z]/.test(ch) ? 0.6 : 0.74;
  return em * fontPx;
}

/** The dealer's ring and the selected ring (3 dp each side) plus air either side of the letters. */
export const DISC_SIDE_ROOM = 2 * 3 + 2 * 8;
/** Disc width: round when the letters fit, a pill when they do not. Never under `disc`. */
export const discWidth = (label: string, fontScale: number, disc: number) =>
  Math.max(disc, Math.ceil(initialsWidth(label, initialsFontSize(disc) * Math.max(fontScale, 1)) + DISC_SIDE_ROOM));

/** The seat-number badge (12-dp digits) grows with the text size. */
export const badgeSize = (fontScale: number) => Math.round(22 * Math.max(fontScale, 1));

export const DEALER_TAG = 'Dealer';
/** The "Dealer" pill: the word at 11 dp bold. */
export const dealerTagWidth = (fontScale: number) => Math.ceil(DEALER_TAG.length * 0.64 * 11 * Math.max(fontScale, 1) + 14);
export const dealerTagHeight = (fontScale: number) => Math.ceil(16 * Math.max(fontScale, 1) + 2);

/**
 * The middle card at its tallest — the selected player: the name, "#57 · Seat 3" and the ▲ ▼ pair of 48-dp
 * buttons side by side. Reserved whatever the state, so the oval does not jump between a tap, a selection and rest.
 * A name too long for one line wraps and the card grows past this; the counter line lives under the ring.
 */
export const centreHeight = (fontScale: number) => {
  const fs = Math.max(fontScale, 1);
  return Math.ceil(20 + 24 * fs + 4 + 16 * fs + 6 + 48);
};
/** The narrowest the middle card can be: two 48-dp buttons, the gap between them and the card's padding. */
export const CENTRE_MIN_WIDTH = 2 * 48 + 6 + 2 * 8;

/** Points on the oval, top first and anticlockwise on screen (y grows downwards), with the arc length to each. */
function ovalSamples(a: number, b: number) {
  const pts: Point[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = (2 * Math.PI * i) / SAMPLES;
    const p = { x: -a * Math.sin(t), y: -b * Math.cos(t) };
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y));
    pts.push(p);
  }
  return { pts, cum };
}

type Box = { x: number; y: number; hw: number; hh: number };

/** Two stadiums (pills) of height `disc` clear each other by `gap`. */
function discsClear(p: Point, wp: number, q: Point, wq: number, disc: number, gap: number) {
  const dx = Math.max(0, Math.abs(p.x - q.x) - (wp - disc + wq - disc) / 2);
  return Math.hypot(dx, p.y - q.y) >= disc + gap;
}

const boxesClear = (p: Box, q: Box, gap: number) => Math.abs(p.x - q.x) >= p.hw + q.hw + gap || Math.abs(p.y - q.y) >= p.hh + q.hh + gap;

/** Where a badge (half-size hw × hh) sits: from the disc centre towards the oval's centre, just past the disc's edge. */
function badgeAt(p: Point, width: number, disc: number, hw: number, hh: number, a: number, b: number): Point {
  // The inward normal of the oval at p (in centre-relative coordinates).
  let nx = -p.x / (a * a);
  let ny = -p.y / (b * b);
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  // Distance from the disc centre to its own edge along the normal (the pill read as an ellipse).
  const rx = width / 2;
  const ry = disc / 2;
  const edge = 1 / Math.hypot(nx / rx, ny / ry);
  const d = edge + Math.abs(nx) * hw + Math.abs(ny) * hh + 2;
  return { x: p.x + nx * d, y: p.y + ny * d };
}

/** Corner radius of the middle card (radius.lg). */
export const CENTRE_RADIUS = 16;

/**
 * Half the width the middle card (half-height `hh`, rounded corners) can take without touching a disc, badge or
 * tag. Round obstacles (badges, round discs) are measured against the card's rounded corner, so a badge just
 * above or below the card's corner does not narrow it more than it has to.
 */
function centreHalfWidth(obstacles: Box[], hh: number, a: number, b: number): number {
  const margin = 4;
  let half = Math.min(a, 160);
  for (const o of obstacles) {
    const dy = Math.abs(o.y);
    if (dy - o.hh >= hh + margin) continue;
    let limit: number;
    if (o.hw === o.hh && dy > hh - CENTRE_RADIUS) {
      const ey = dy - (hh - CENTRE_RADIUS);
      const reach = o.hw + CENTRE_RADIUS + margin;
      if (ey >= reach) continue;
      limit = Math.abs(o.x) - Math.sqrt(reach * reach - ey * ey) + CENTRE_RADIUS;
    } else {
      limit = Math.abs(o.x) - o.hw - margin;
    }
    half = Math.min(half, limit);
  }
  // Nothing beside the band (a few players): stay inside the felt.
  const feltAtBand = hh < b ? a * Math.sqrt(1 - (hh / b) ** 2) - 12 : 0;
  return Math.max(0, Math.min(half, feltAtBand));
}

/**
 * Lay the ring out. Each neighbour pair gets arc length in proportion to the room the two need, starting with
 * position 0 at 12 o'clock; the oval grows taller (never narrower than the box allows) until everything clears.
 */
export function layoutRing(input: RingInput): RingLayout {
  const n = input.labels.length;
  const fs = Math.max(input.fontScale, 1);
  const disc = discSize(n);
  const widths = input.labels.map((label) => discWidth(label, fs, disc));
  const badge = badgeSize(fs);
  const tagW = dealerTagWidth(fs);
  const halfBox = input.width / 2 - 2;
  let a = Math.max(disc, Math.min(RING_MAX_HALF_WIDTH, halfBox - disc / 2));
  const cardH = centreHeight(fs);
  const dealer = input.dealerIndex != null && input.dealerIndex >= 0 && input.dealerIndex < n ? input.dealerIndex : -1;
  // Arc each neighbour pair needs: side by side (at the top and bottom) the two half-widths; the oval shares the
  // perimeter out in proportion, so wide pills get more of it.
  const need = widths.map((w, i) => (w + widths[(i + 1) % n]) / 2 + RING_GAP);
  let needSum = need.reduce((s, v) => s + v, 0);
  // Start no flatter than a table seen from a chair, taller as the table fills (13 players: 1.65 : 1, 20: 2 : 1),
  // unless the space is short (a small phone, landscape); and always tall enough for the middle card.
  const tagH = dealerTagHeight(fs);
  // The dealer's tag can stick out past the top or bottom disc: keep room for it when the space is the limit.
  const fitB = (input.height - disc - 2 * RING_PAD - (dealer >= 0 ? tagH + 2 : 0)) / 2;
  const ratio = 1.3 + Math.max(0, n - 6) * 0.05;
  const bStart = Math.max(Math.min(ratio * a, fitB), cardH / 2 + disc / 2 + badge + 10, disc);

  let b = bStart;
  let points: Point[] = [];
  let badges: Point[] = [];
  let tag: Point | null = null;
  let centre = { width: 0, height: cardH };
  let bumps = 0;
  let firstClear: { b: number; points: Point[]; badges: Point[]; tag: Point | null; centre: typeof centre } | null = null;
  for (;;) {
    const { pts, cum } = ovalSamples(a, b);
    const perimeter = cum[cum.length - 1];
    const scale = n ? perimeter / needSum : 1;
    points = [];
    let s = 0;
    let j = 0;
    for (let i = 0; i < n; i += 1) {
      while (j < SAMPLES && cum[j + 1] <= s) j += 1;
      const span = cum[j + 1] - cum[j] || 1;
      const f = Math.min(1, Math.max(0, (s - cum[j]) / span));
      points.push({ x: pts[j].x + (pts[j + 1].x - pts[j].x) * f, y: pts[j].y + (pts[j + 1].y - pts[j].y) * f });
      s += need[i] * scale;
    }
    // A pill wider than a disc (WWW, HG2) must not run off the side: bring the oval in, only as far as it needs.
    if (a > disc && points.some((p, i) => Math.abs(p.x) + widths[i] / 2 > halfBox)) {
      a -= 2;
      continue;
    }
    badges = points.map((p, i) => badgeAt(p, widths[i], disc, badge / 2, badge / 2, a, b));
    // Two seats level across a narrow ring (big text, many pills) push their badges together whatever the height:
    // those two put theirs straight towards the middle line instead, under the disc in the top half.
    for (let i = 0; i < n; i += 1) {
      for (let k = i + 1; k < n; k += 1) {
        if (Math.hypot(badges[i].x - badges[k].x, badges[i].y - badges[k].y) >= badge + 2) continue;
        for (const q of [i, k]) {
          const toward = points[q].y <= 0 ? 1 : -1;
          badges[q] = { x: points[q].x, y: points[q].y + toward * (disc / 2 + badge / 2 + 2) };
        }
      }
    }
    const discBoxes: Box[] = points.map((p, i) => ({ x: p.x, y: p.y, hw: widths[i] / 2, hh: disc / 2 }));
    // Wide pills packed round a narrow end (big text, three letters each) can put a badge on the next disc at any
    // height: such a badge tries the other sides of its own disc before the oval grows for it.
    const badgeClear = (q: Point, i: number) =>
      Math.abs(q.x) + badge / 2 <= halfBox &&
      discBoxes.every((d, k) => k === i || boxesClear({ x: q.x, y: q.y, hw: badge / 2, hh: badge / 2 }, d, 2)) &&
      badges.every((o, k) => k === i || Math.hypot(o.x - q.x, o.y - q.y) >= badge + 2);
    for (let i = 0; i < n; i += 1) {
      if (badgeClear(badges[i], i)) continue;
      const p = points[i];
      const off = disc / 2 + badge / 2 + 2;
      const side = widths[i] / 2 + badge / 2 + 2;
      const toward = p.y <= 0 ? 1 : -1;
      const inward = p.x <= 0 ? 1 : -1;
      const tries: Point[] = [
        { x: p.x, y: p.y + toward * off },
        { x: p.x + inward * side, y: p.y },
        { x: p.x, y: p.y - toward * off },
        { x: p.x - inward * side, y: p.y },
      ];
      const found = tries.find((q) => badgeClear(q, i));
      if (found) badges[i] = found;
    }
    const badgeBoxes: Box[] = badges.map((p) => ({ x: p.x, y: p.y, hw: badge / 2, hh: badge / 2 }));
    let ok = n < 2 || scale >= 1;
    let clash: [number, number] | null = null;
    for (let i = 0; ok && i < n; i += 1) {
      for (let k = i + 1; ok && k < n; k += 1) {
        if (!discsClear(points[i], widths[i], points[k], widths[k], disc, RING_GAP) || Math.hypot(badges[i].x - badges[k].x, badges[i].y - badges[k].y) < badge + 2) {
          ok = false;
          clash = [i, k];
        }
      }
      for (let k = 0; ok && k < n; k += 1) {
        if (k !== i && !boxesClear(badgeBoxes[i], discBoxes[k], 2)) {
          ok = false;
          clash = [i, k];
        }
      }
    }
    // Two neighbours that touch where the oval turns sharply (the ends of a tall one) are closer than their arc: while
    // the ring has arc to spare, give that pair more of it before making the oval taller (which only sharpens the ends).
    if (clash && scale > 1.05 && bumps < MAX_BUMPS) {
      const [i, k] = clash;
      const arc = k === (i + 1) % n ? i : i === (k + 1) % n ? k : -1;
      if (arc >= 0) {
        need[arc] += 2;
        needSum += 2;
        bumps += 1;
        continue;
      }
    }
    // The "Dealer" tag sits on the dealer's disc, above or below it: away from the middle line when there is room
    // (inside the oval it would squeeze the name card whenever the dealer sits on a side, and the badge already
    // takes the inward side), else towards it.
    tag = null;
    let tagBox: Box | null = null;
    if (ok && dealer >= 0) {
      const p = points[dealer];
      const away = p.y <= 0 ? -1 : 1;
      // Part way round, his own badge sits diagonally inward; the tag may slide outward along the row to clear it.
      const outward = badges[dealer].x > p.x ? -1 : 1;
      // On a side of a crowded ring there is no free row above or below him: the tag then sits on his own disc's
      // rim, like a ribbon, half on the disc (the initials sit higher, in the middle).
      search: for (const off of [disc / 2 + 2 + tagH / 2, disc / 2 + 5, disc / 2]) {
        for (const side of [away, -away]) {
          for (const slide of [0, badge / 2, badge]) {
            const x = Math.max(-(halfBox - tagW / 2), Math.min(halfBox - tagW / 2, p.x + outward * slide));
            const box: Box = { x, y: p.y + side * off, hw: tagW / 2, hh: tagH / 2 };
            if (discBoxes.every((d, i) => i === dealer || boxesClear(box, d, 2)) && badgeBoxes.every((d) => boxesClear(box, d, 2))) {
              tagBox = box;
              tag = { x: box.x, y: box.y };
              break search;
            }
          }
        }
      }
      if (!tagBox) ok = false;
    }
    const half = centreHalfWidth(tagBox ? [...discBoxes, ...badgeBoxes, tagBox] : [...discBoxes, ...badgeBoxes], cardH / 2, a, b);
    centre = { width: Math.floor(2 * half), height: cardH };
    // A crowded ring lines the sides with discs: grow taller until the card's two buttons fit beside them, but
    // not past a cap (a few players on a narrow phone: the side discs sit level with the card whatever the height).
    if (ok && centre.width < CENTRE_MIN_WIDTH) {
      firstClear ??= { b, points, badges, tag, centre };
      // On one screen already: never scroll just to widen the card (it covers a badge while it is open instead).
      const cap = firstClear.b <= fitB ? fitB : firstClear.b + 0.35 * a;
      if (b + RING_STEP <= cap) ok = false;
      else ({ b, points, badges, tag, centre } = firstClear);
    }
    if (ok || b >= RING_MAX_HALF_HEIGHT) break;
    b += RING_STEP;
  }

  // The box hugs everything drawn: the discs, and the dealer tag where it sticks out above the top or below the bottom.
  const top = Math.min(-b - disc / 2, tag ? tag.y - tagH / 2 : Infinity);
  const bottom = Math.max(b + disc / 2, tag ? tag.y + tagH / 2 : -Infinity);
  const boxHeight = Math.ceil(bottom - top + 2 * RING_PAD);
  const cx = input.width / 2;
  const cy = RING_PAD - top;
  const shift = (p: Point) => ({ x: cx + p.x, y: cy + p.y });
  return {
    disc,
    widths,
    points: points.map(shift),
    badges: badges.map(shift),
    badge,
    dealerTag: tag ? shift(tag) : null,
    dealerTagWidth: tagW,
    dealerTagHeight: tagH,
    a,
    b,
    cx,
    cy,
    boxWidth: input.width,
    boxHeight,
    centre,
    fits: boxHeight <= input.height,
  };
}

/**
 * The deal arrow: dots on an inner oval from just past the dealer, anticlockwise (towards the seat that gets the
 * first card), about one seat long. The last point carries the arrowhead; `angle` is its heading in degrees
 * (0 = pointing up, clockwise positive, as `rotate` reads it).
 */
export function dealArrow(layout: RingLayout, fromIndex: number, dots = 7): { points: Point[]; angle: number } {
  const n = layout.points.length;
  if (n < 2 || fromIndex < 0 || fromIndex >= n) return { points: [], angle: 0 };
  const inset = Math.max(...layout.widths) / 2 + layout.badge + 14;
  const ai = Math.max(8, layout.a - inset);
  const bi = Math.max(8, layout.b - layout.disc / 2 - layout.badge - 14);
  const from = layout.points[fromIndex];
  // The oval parameter of the dealer (x = -a sin t, y = -b cos t).
  const t0 = Math.atan2(-(from.x - layout.cx) / layout.a, -(from.y - layout.cy) / layout.b);
  const sweep = Math.min(Math.PI / 3, (2 * Math.PI) / n);
  const start = t0 + sweep * 0.3;
  const span = sweep * 0.65;
  const points: Point[] = [];
  for (let i = 0; i < dots; i += 1) {
    const t = start + (span * i) / (dots - 1);
    points.push({ x: layout.cx - ai * Math.sin(t), y: layout.cy - bi * Math.cos(t) });
  }
  const tEnd = start + span;
  // d/dt of (x, y) is the heading of the arrow on screen.
  const dx = -ai * Math.cos(tEnd);
  const dy = bi * Math.sin(tEnd);
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { points, angle };
}

/** Screen angle of a point round the oval's centre, anticlockwise positive, in radians (0 = 3 o'clock). */
export const screenAngle = (layout: Pick<RingLayout, 'cx' | 'cy'>, p: Point) => Math.atan2(-(p.y - layout.cy), p.x - layout.cx);
