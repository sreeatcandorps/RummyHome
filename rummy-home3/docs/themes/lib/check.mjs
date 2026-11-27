// Contrast and seat-colour checks. Every row names the two tokens, where the pair is used, and its floor:
// 4.5 : 1 for body text and numbers, 3 : 1 for large numbers, icons and button outlines (WCAG 2.2 AA).
import { contrast, deltaE, simulate } from './color.mjs';
import { tokenKeys } from './today.mjs';

const TEXT = 4.5;
const LARGE = 3;

/** [foreground token, background token, floor, where it is used]. */
export const PAIRS = [
  ['onBackground', 'background', TEXT, 'Screen titles, "Hi Ravi"'],
  ['onSurface', 'surface', TEXT, 'Card text, scores'],
  ['onSurface', 'tableStripe', TEXT, 'Scores on a striped row'],
  ['onSurface', 'tableLatest', TEXT, 'Scores on the newest round'],
  ['onSurface', 'tableHeader', TEXT, 'Round numbers, totals'],
  ['onSurface', 'surfaceVariant', TEXT, 'Text on the Recent card'],
  ['onSurface', 'leaderContainer', TEXT, 'The leading row in Standings'],
  ['onSurface', 'reentryContainer', TEXT, 'A re-entered row in Standings'],
  ['onSurface', 'band', TEXT, 'Result rows'],
  ['onSurface', 'bandAlt', TEXT, 'Result rows, every second game'],
  ['onSurface', 'bandHead', TEXT, 'Result column heads'],
  ['onSurface', 'bandHeadAlt', TEXT, 'Result column heads, every second game'],
  ['onSurface', 'elevation.level3', TEXT, 'Dialogs'],
  ['onSurfaceVariant', 'surface', TEXT, 'Grey notes, "Pool", player count'],
  ['onSurfaceVariant', 'background', TEXT, 'Grey notes on the page'],
  ['onSurfaceVariant', 'surfaceVariant', TEXT, 'Closed tag, struck-out totals'],
  ['onSurfaceVariant', 'tableHeader', TEXT, 'RND, dealer initials, OPENS'],
  ['onSurfaceVariant', 'tableLatest', TEXT, 'Dealer initials on the newest round'],
  ['primary', 'surface', TEXT, 'Undo, Complete, Re-enter, links'],
  ['primary', 'background', TEXT, 'Links on the page'],
  ['onPrimary', 'primary', TEXT, 'New game, Add round, the lit tab'],
  ['onPrimaryContainer', 'primaryContainer', TEXT, 'Active, Round 6, the dealer column'],
  ['onSecondaryContainer', 'secondaryContainer', TEXT, 'Game badge, Results, My players, Pool'],
  ['secondary', 'surface', TEXT, 'A picked game\'s rule and label'],
  ['tertiary', 'surface', TEXT, 'Notices'],
  ['onTertiaryContainer', 'tertiaryContainer', TEXT, 'Completed, Admin tags'],
  ['error', 'surface', TEXT, 'Error text'],
  ['error', 'background', TEXT, 'Error text on the page'],
  ['onError', 'error', TEXT, 'Delete button'],
  ['onErrorContainer', 'errorContainer', TEXT, 'Warnings'],
  ['loss', 'surface', TEXT, 'Minus numbers, OUT R4 in Standings'],
  ['loss', 'tableStripe', TEXT, 'Big hands on a striped row'],
  ['loss', 'tableLatest', TEXT, 'Big hands on the newest round'],
  ['loss', 'surfaceVariant', TEXT, 'OUT R4 on a struck-out column'],
  ['loss', 'leaderContainer', TEXT, 'Low "left / drops" on the leading row'],
  ['loss', 'reentryContainer', TEXT, 'Low "left / drops" on a re-entered row'],
  ['loss', 'band', TEXT, 'Minus numbers in a result'],
  ['loss', 'bandAlt', TEXT, 'Minus numbers in a result, every second game'],
  ['onLossContainer', 'lossContainer', TEXT, 'Loss notes'],
  ['win', 'surface', TEXT, 'Winner text, ticks'],
  ['onWinContainer', 'winContainer', TEXT, 'The winning 0'],
  ['onPositiveContainer', 'positiveContainer', TEXT, 'Positive tags'],
  ['leader', 'surface', TEXT, 'Leader notes'],
  ['onLeaderContainer', 'leaderContainer', TEXT, 'Creator tag, My players count'],
  ['reentry', 'surface', TEXT, 'The re-entry score in a cell'],
  ['reentry', 'tableStripe', TEXT, 'The re-entry score on a striped row'],
  ['reentry', 'tableHeader', TEXT, 'A re-entered player\'s initials and total'],
  ['reentry', 'reentryContainer', TEXT, 'A re-entered row\'s initials and score'],
  ['onFelt', 'felt', TEXT, 'Sign-in band title'],
  ['onFeltMuted', 'felt', TEXT, 'Sign-in band subtitle'],
  ['inverseOnSurface', 'inverseSurface', TEXT, 'Toast text'],
  ['inversePrimary', 'inverseSurface', TEXT, 'Toast Undo'],
  ['leader', 'tableHeader', LARGE, 'Crown under a column'],
  ['leader', 'leaderContainer', LARGE, 'Crown on the leading row'],
  ['outline', 'surface', LARGE, 'Outlined button edge'],
  ['outline', 'background', LARGE, 'Field edge on the page'],
  ['primary', 'background', LARGE, 'A filled button against the page'],
];

const get = (theme, key) => key.split('.').reduce((o, k) => o?.[k], theme.colors);

export function contrastRows(theme) {
  return PAIRS.map(([fg, bg, floor, where]) => {
    const ratio = contrast(get(theme, fg), get(theme, bg));
    return { fg, bg, floor, where, ratio, pass: ratio >= floor };
  });
}

/** What the seat colours sit on when they are lettering: the table header, a card, the dealer's column. */
const SEAT_GROUNDS = ['tableHeader', 'surface', 'primaryContainer'];

export function seatRows(theme) {
  return theme.seats.map((s, i) => {
    const grounds = SEAT_GROUNDS.map((g) => contrast(s.text, get(theme, g)));
    return { seat: i + 1, ...s, initials: contrast(s.on, s.fill), lettering: Math.min(...grounds) };
  });
}

export function seatSpread(theme, upTo = theme.seats.length) {
  const fills = theme.seats.slice(0, upTo).map((s) => s.fill);
  let min = Infinity; let pair = [0, 0]; let minCvd = Infinity; let neighbour = Infinity;
  for (let i = 0; i < fills.length; i++) {
    for (let j = i + 1; j < fills.length; j++) {
      const d = deltaE(fills[i], fills[j]);
      if (d < min) { min = d; pair = [i + 1, j + 1]; }
      for (const kind of ['protan', 'deutan']) minCvd = Math.min(minCvd, deltaE(simulate(fills[i], kind), simulate(fills[j], kind)));
      if (j === i + 1) neighbour = Math.min(neighbour, d);
    }
  }
  return { min, pair, minCvd, neighbour };
}

/** Floors for the seats: initials and lettering 4.5 : 1; any two of the twenty at least 10 apart, neighbours 20. */
export const SEAT_FLOORS = { initials: TEXT, lettering: TEXT, spread: 10, neighbour: 20, away: 8 };

export function seatProblems(theme) {
  const problems = [];
  if (theme.seats.length !== 20) problems.push(`${theme.name}: ${theme.seats.length} seat colours, 20 wanted`);
  for (const row of seatRows(theme)) {
    if (row.initials < SEAT_FLOORS.initials) problems.push(`${theme.name} seat ${row.seat}: initials ${row.initials.toFixed(2)} : 1`);
    if (row.lettering < SEAT_FLOORS.lettering) problems.push(`${theme.name} seat ${row.seat}: lettering ${row.lettering.toFixed(2)} : 1`);
    for (const key of ['primary', 'reentry', 'loss']) {
      const away = deltaE(row.text, get(theme, key));
      if (away < SEAT_FLOORS.away) problems.push(`${theme.name} seat ${row.seat}: only ${away.toFixed(1)} from ${key}`);
    }
  }
  const spread = seatSpread(theme);
  if (spread.min < SEAT_FLOORS.spread) problems.push(`${theme.name}: seats ${spread.pair.join(' and ')} are ${spread.min.toFixed(1)} apart`);
  if (spread.neighbour < SEAT_FLOORS.neighbour) problems.push(`${theme.name}: two neighbouring seats are ${spread.neighbour.toFixed(1)} apart`);
  return problems;
}

/** A new theme must define exactly the tokens theme.ts has today: none missing, none invented. */
export function tokenProblems(theme, reference) {
  const want = tokenKeys(reference);
  const have = tokenKeys(theme);
  return [
    ...want.filter((k) => !have.includes(k)).map((k) => `${theme.name}: token ${k} is missing`),
    ...have.filter((k) => !want.includes(k)).map((k) => `${theme.name}: token ${k} is not in theme.ts`),
  ];
}

export function problems(theme, reference) {
  return [
    ...tokenProblems(theme, reference),
    ...contrastRows(theme).filter((r) => !r.pass).map((r) => `${theme.name}: ${r.fg} on ${r.bg} is ${r.ratio.toFixed(2)} : 1, floor ${r.floor}`),
    ...seatProblems(theme),
  ];
}
