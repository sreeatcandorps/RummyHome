// What every colour token is used for, in the app's own words, grouped the way the swatch sheets show
// them. `on` names the token that carries this token's text; `under` names the fill this token is
// drawn on. `groupsProblems` fails the build when theme.ts has a token no group mentions.
import { tokenKeys } from './today.mjs';

export const TOKEN_GROUPS = [
  {
    title: 'Page and cards',
    tokens: [
      ['background', 'The page behind everything', { on: 'onBackground' }],
      ['onBackground', 'Titles on the page: "Hi Ravi"', { under: 'background' }],
      ['surface', 'Cards, the table, the bottom bar', { on: 'onSurface' }],
      ['onSurface', 'Text and scores', { under: 'surface' }],
      ['surfaceVariant', 'The Recent card, a Closed tag, an out column', { on: 'onSurfaceVariant' }],
      ['onSurfaceVariant', 'Grey notes: "Pool", OPENS, player count', { under: 'surface' }],
      ['surfaceSunken', 'The unlit tab', { on: 'onSurface' }],
      ['outline', 'Outlined buttons, input borders', { under: 'surface', line: true }],
      ['outlineVariant', 'Card edges', { under: 'surface', line: true }],
      ['hairline', 'Lines between rows and cells', { under: 'surface', line: true }],
      ['surfaceDisabled', 'A button that cannot be pressed', { under: 'surface', fill: true }],
      ['onSurfaceDisabled', 'Its label', { under: 'surface' }],
      ['backdrop', 'The dim behind a dialog', { under: 'surface', fill: true }],
      ['elevation.level0', 'Flat (no lift)', { under: 'surface', fill: true }],
      ['elevation.level1', 'Menus', { on: 'onSurface' }],
      ['elevation.level2', 'Menus, pickers', { on: 'onSurface' }],
      ['elevation.level3', 'Dialogs', { on: 'onSurface' }],
      ['elevation.level4', 'Raised sheets', { on: 'onSurface' }],
      ['elevation.level5', 'The highest sheet', { on: 'onSurface' }],
      ['shadow', 'Shadows', {}],
      ['scrim', 'The dim behind a sheet', {}],
    ],
  },
  {
    title: 'The main action',
    tokens: [
      ['primary', 'New game, Add round, the lit tab, links', { on: 'onPrimary' }],
      ['onPrimary', 'Their labels', { under: 'primary' }],
      ['primaryEdge', 'The pressable edge under a filled button', { on: 'onPrimary' }],
      ['primaryContainer', 'Active, Round 6, section icons, the dealer column', { on: 'onPrimaryContainer' }],
      ['onPrimaryContainer', 'Their text', { under: 'primaryContainer' }],
      ['focus', 'The ring around a focused field', { under: 'surface', line: true }],
    ],
  },
  {
    title: 'Gold: a game or a selection',
    tokens: [
      ['secondaryContainer', 'Game badge, Results, My players, a picked option', { on: 'onSecondaryContainer' }],
      ['onSecondaryContainer', 'Their text', { under: 'secondaryContainer' }],
      ['secondary', 'The rule and label of a picked game', { under: 'surface' }],
      ['onSecondary', 'Text on solid gold', { under: 'secondary' }],
      ['secondaryEdge', 'The edge under a gold button', { on: 'onSecondaryContainer' }],
      ['gameTypes.stake.container', 'A Points game\'s badge', { on: 'gameTypes.stake.on' }],
      ['gameTypes.stake.on', 'Its number: S1', { under: 'gameTypes.stake.container' }],
      ['gameTypes.stake.accent', 'A Points game\'s line in a result', { under: 'surface' }],
      ['gameTypes.pool.container', 'A Pool game\'s badge and tag', { on: 'gameTypes.pool.on' }],
      ['gameTypes.pool.on', 'Its number: P1', { under: 'gameTypes.pool.container' }],
      ['gameTypes.pool.accent', 'A Pool game\'s line in a result', { under: 'surface' }],
      ['brand.gold', 'The brand\'s gold, by name (no screen reads it today)', {}],
    ],
  },
  {
    title: 'Scores',
    tokens: [
      ['winContainer', 'The winning 0', { on: 'onWinContainer' }],
      ['onWinContainer', 'The 0 itself', { under: 'winContainer' }],
      ['win', 'Winner text and ticks', { under: 'surface' }],
      ['positiveContainer', 'A positive tag (Awarded)', { on: 'onPositiveContainer' }],
      ['onPositiveContainer', 'Its text', { under: 'positiveContainer' }],
      ['positive', 'A plus number (plain, as today)', { under: 'surface' }],
      ['loss', 'Minus numbers, a Full count, OUT R4', { under: 'surface' }],
      ['negative', 'Minus totals', { under: 'surface' }],
      ['lossContainer', 'A loss note', { on: 'onLossContainer' }],
      ['onLossContainer', 'Its text', { under: 'lossContainer' }],
      ['leader', 'The crown', { under: 'surface' }],
      ['leaderContainer', 'Creator, the leading row, the My players count', { on: 'onLeaderContainer' }],
      ['onLeaderContainer', 'Their text', { under: 'leaderContainer' }],
      ['reentry', 'A re-entered player: ↺71, initials, total', { under: 'surface' }],
      ['reentryContainer', 'A re-entered row in Standings', { on: 'reentry' }],
    ],
  },
  {
    title: 'Notices and errors',
    tokens: [
      ['tertiary', 'One notice per screen', { under: 'surface' }],
      ['onTertiary', 'Text on a solid notice', { under: 'tertiary' }],
      ['tertiaryContainer', 'Completed and Admin tags', { on: 'onTertiaryContainer' }],
      ['onTertiaryContainer', 'Their text', { under: 'tertiaryContainer' }],
      ['error', 'Error text, Delete', { on: 'onError' }],
      ['onError', 'The Delete label', { under: 'error' }],
      ['errorContainer', 'A warning box', { on: 'onErrorContainer' }],
      ['onErrorContainer', 'Its text', { under: 'errorContainer' }],
    ],
  },
  {
    title: 'Scorecard table and results',
    tokens: [
      ['tableHeader', 'The header row and the round column', { on: 'onSurface' }],
      ['tableStripe', 'Every second round', { on: 'onSurface' }],
      ['tableLatest', 'The newest round', { on: 'onSurface' }],
      ['cellNeutral', 'An empty score key', { on: 'onSurface' }],
      ['band', 'A result\'s rows', { on: 'onSurface' }],
      ['bandAlt', 'Every second game in a result', { on: 'onSurface' }],
      ['bandHead', 'A result\'s column heads', { on: 'onSurface' }],
      ['bandHeadAlt', 'Column heads, every second game', { on: 'onSurface' }],
    ],
  },
  {
    title: 'Toast and the Sign-in band',
    tokens: [
      ['inverseSurface', 'The toast', { on: 'inverseOnSurface' }],
      ['inverseOnSurface', 'Its words', { under: 'inverseSurface' }],
      ['inversePrimary', 'Its action: UNDO', { under: 'inverseSurface' }],
      ['felt', 'The Sign-in band', { on: 'onFelt' }],
      ['onFelt', 'Its title', { under: 'felt' }],
      ['onFeltMuted', 'Its second line', { under: 'felt' }],
      ['brand.felt', 'The loading and crash screens: title, spinner, button', { on: 'brand.cream' }],
      ['brand.feltLight', 'The band\'s lighter tone, by name (no screen reads it today)', {}],
      ['brand.cream', 'The loading and crash screens: the page, the button\'s label', { on: 'brand.felt' }],
    ],
  },
];

/** Every token theme.ts has must appear in a group exactly once. */
export function groupsProblems(reference) {
  const listed = TOKEN_GROUPS.flatMap((g) => g.tokens.map(([key]) => key));
  const want = tokenKeys(reference);
  return [
    ...want.filter((k) => !listed.includes(k)).map((k) => `swatch sheet: token ${k} has no "used for" line`),
    ...listed.filter((k) => !want.includes(k)).map((k) => `swatch sheet: ${k} is not a token in theme.ts`),
    ...listed.filter((k, i) => listed.indexOf(k) !== i).map((k) => `swatch sheet: ${k} is listed twice`),
  ];
}
