// Every colour written as a literal outside the theme file, and the token each one should become.
// The scan is the future test: with the rules below emptied, any literal it finds is a failure.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { APP_ROOT } from './today.mjs';

const CODE_DIRS = ['app', 'components', 'utils', 'contexts', 'hooks', 'services', 'constants'];
const EXTRA_FILES = ['public/scorecard.html', 'web/scorecard.html', 'app.json'];
const THEME_FILES = ['constants/theme.ts'];
const LITERAL = /#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3,4}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
  return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
});

/** Every line of code outside the theme file, comments left out: [{ file, line, code, text }]. */
function codeLines(root) {
  const files = [
    ...CODE_DIRS.filter((d) => existsSync(join(root, d))).flatMap((d) => walk(join(root, d))),
    ...EXTRA_FILES.map((f) => join(root, f)).filter(existsSync),
  ];
  const lines = [];
  for (const path of files) {
    const file = relative(root, path);
    if (THEME_FILES.includes(file)) continue;
    readFileSync(path, 'utf8').split('\n').forEach((text, i) => {
      if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(text)) return;
      lines.push({ file, line: i + 1, code: text.replace(/\/\/.*$/, ''), text: text.trim() });
    });
  }
  return lines;
}

/** [{ file, line, literals, text }] for every line with a colour literal. */
export function scan(root = APP_ROOT) {
  return codeLines(root).flatMap(({ file, line, code, text }) => {
    const literals = code.match(LITERAL);
    return literals ? [{ file, line, literals: [...new Set(literals)], text }] : [];
  });
}

/**
 * Colours that are not written as a literal but do not follow the theme either: they are read from
 * one fixed export of theme.ts, so the scan above cannot see them.
 */
export const BYPASSES = [
  {
    test: (code) => /\bbrand\.(felt|feltLight|cream|gold)\b/.test(code),
    what: 'The loading screen and the crash screen read the one fixed `brand` set',
    becomes: '`background`, `primary` and `onPrimary` of the picked theme',
  },
  {
    test: (code) => /\bseatColor\(/.test(code) && !/onDark/.test(code),
    what: 'Avatars and initials that always take the light set of seat colours, whatever the theme',
    becomes: '`theme.seats[n]`: its fill, its initials colour, its lettering colour',
  },
  {
    test: (code) => /\bseatColor\(/.test(code) && /onDark/.test(code),
    what: 'Seat colours picked by a light / dark flag passed by hand',
    becomes: '`theme.seats[n]`, the same call as the row above',
  },
];

/** [{ rule, places: [{ file, lines }] }] for the three kinds above. */
export function bypasses(root = APP_ROOT) {
  const lines = codeLines(root);
  return BYPASSES.map((rule) => {
    const places = [];
    for (const hit of lines.filter((l) => rule.test(l.code))) {
      let place = places.find((p) => p.file === hit.file);
      if (!place) { place = { file: hit.file, lines: [] }; places.push(place); }
      place.lines.push(hit.line);
    }
    return { rule, places };
  });
}

/**
 * The plan for each place. `where`: 'screen' follows the theme; 'share' is the one fixed set for
 * everything that leaves the phone (the recommendation); 'native' is baked into the build.
 * A rule covers a file, or the lines of it that `lines` or `match` pick out.
 */
export const RULES = [
  { file: 'app/_layout.tsx', where: 'screen', what: 'The crash screen\'s message', becomes: '`onSurface` (its title and button already read `brand.felt`)' },
  { file: 'components/ui/SeatAvatar.tsx', where: 'screen', what: 'The initials on every avatar', becomes: 'new `seats[n].on`: white on the light theme\'s seats, near-black on the dark theme\'s' },
  { file: 'components/ui/JokerCard.tsx', match: /shadowColor/, where: 'screen', what: 'The joker card\'s shadow', becomes: '`shadow`' },
  { file: 'components/ui/JokerCard.tsx', where: 'screen', what: 'The joker card: a white face, black letter', becomes: 'new `card` / `onCard`: a playing card stays white in every theme, but is named in the theme file' },
  { file: 'components/results/BandTable.tsx', where: 'screen', what: 'The line between a result\'s cells', becomes: '`surface` (white today, so on dark it draws white lines)' },
  { file: 'components/results/PlayerLine.tsx', match: /rgba/, where: 'screen', what: 'The medal\'s edge', becomes: '`outlineVariant`' },
  { file: 'components/results/PlayerLine.tsx', where: 'screen', what: 'Gold, silver and bronze medals', becomes: 'new `medal.gold` / `medal.silver` / `medal.bronze`, each with its `on`: the same metals in every theme' },
  { file: 'components/ui/AuthShell.tsx', match: /shadowColor/, where: 'screen', what: 'The Sign-in card\'s shadow', becomes: '`shadow`' },
  { file: 'components/ui/AuthShell.tsx', where: 'screen', what: 'The faint club behind the Sign-in band', becomes: '`onFelt` at 5%' },
  { file: 'utils/eventLog.ts', where: 'screen', what: 'The five dots of the game log', becomes: '`loss`, `leader`, `tertiary`, `win`, `outline`' },
  { file: 'components/share/ShareCardView.tsx', where: 'share', what: 'The result picture people share', becomes: '`share.*`' },
  { file: 'components/share/ScorecardImageView.tsx', where: 'share', what: 'The scorecard picture people share', becomes: '`share.*`' },
  { file: 'utils/shareImage.ts', where: 'share', what: 'The same two pictures, drawn for the web build', becomes: '`share.*`' },
  { file: 'utils/resultsDetails.ts', where: 'share', what: 'The result details page and its PDF', becomes: '`share.*`' },
  { file: 'public/scorecard.html', where: 'share', what: 'The live scorecard web page', becomes: '`share.*`, written into the page by the script that copies it' },
  { file: 'web/scorecard.html', where: 'share', what: 'Its source copy', becomes: '`share.*`' },
  { file: 'app.json', where: 'native', what: 'The splash screen and the icon\'s background', becomes: 'stays: Android reads these before the app starts, so they cannot follow a switch' },
];

export const WHERE = {
  screen: 'On screen: follows the theme',
  share: 'Leaves the phone: one fixed set, `share`',
  native: 'Baked into the build',
};

export function inventory(root = APP_ROOT) {
  const rows = scan(root).map((hit) => {
    const rule = RULES.find((r) => r.file === hit.file && (!r.match || r.match.test(hit.text)));
    return { ...hit, rule };
  });
  return { rows, problems: rows.filter((r) => !r.rule).map((r) => `fixed colour with no plan: ${r.file}:${r.line} ${r.literals.join(' ')}`) };
}

/** Rows folded to one per (file, plan), with the lines and the literals it covers. */
export function inventoryGroups(root = APP_ROOT) {
  const { rows, problems } = inventory(root);
  const groups = [];
  for (const row of rows.filter((r) => r.rule)) {
    let group = groups.find((g) => g.rule === row.rule);
    if (!group) { group = { rule: row.rule, file: row.file, lines: [], literals: [] }; groups.push(group); }
    group.lines.push(row.line);
    for (const lit of row.literals) if (!group.literals.includes(lit)) group.literals.push(lit);
  }
  const order = Object.keys(WHERE);
  groups.sort((a, b) => order.indexOf(a.rule.where) - order.indexOf(b.rule.where) || RULES.indexOf(a.rule) - RULES.indexOf(b.rule));
  return { groups, problems, lineCount: rows.length, literalCount: rows.reduce((n, r) => n + r.literals.length, 0) };
}

export const lineSpans = (lines) => {
  const out = [];
  for (const n of lines) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
};
