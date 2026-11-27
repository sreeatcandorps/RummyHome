#!/usr/bin/env node
// Builds everything docs/themes.md shows, from the palette spec in palettes.mjs.
//
//   node docs/themes/build.mjs           check the palettes, then write the pictures and the two tables
//   node docs/themes/build.mjs --check   check only (no Chrome): exit 1 when a token is missing, a pair
//                                        of colours is under its contrast floor, two seats are too close,
//                                        or a fixed colour in the app has no plan
//
// Needs: Node 22, `npm ci` (the icon font comes from @expo/vector-icons), Chrome (CHROME=/path to override).
// No npm dependency of its own. Phones are drawn at 1080 px wide (3 px per dp on the small phone, 2.625 on the
// Pixel 6, the sizes of the CI frames) and shown pixel for pixel on sheets photographed at 3x; the two
// reference sheets (calibration, every token) are photographed at 2x.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haveli, mehfil } from './palettes.mjs';
import { PAIRS, SEAT_FLOORS, contrastRows, problems, seatRows, seatSpread } from './lib/check.mjs';
import { WHERE, bypasses, inventoryGroups, lineSpans } from './lib/inventory.mjs';
import { TOKEN_GROUPS, groupsProblems } from './lib/tokens.mjs';
import { today, tokenKeys, valueOf } from './lib/today.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const out = (name) => join(HERE, name);

/** Today's frames: the last green run of PR #170 (merged to main), smoke flow, both CI phones. */
export const CI_RUN = { id: '46035664063', pr: 170, url: 'https://github.com/sreeatcandorps/RummyHome/actions/runs/46035664063' };
const CI = {
  home: out('today/home-pixel6.png'), // artifact …-pixel6-smoke-b, smoke/screens/22-home-ravi.png
  scorecard: out('today/scorecard-pixel6.png'), // same artifact, smoke/screens/22d-pool-9p-portrait.png
  homeSmall: out('today/home-small.png'), // artifact …-small-smoke-b, smoke/screens/22-home-ravi.png
};

const THEMES = [haveli, mehfil];
const ALL = [haveli, mehfil, today.light, today.dark];

function check() {
  const inv = inventoryGroups();
  return [
    ...THEMES.flatMap((t) => problems(t, today.light)),
    ...groupsProblems(today.light),
    ...inv.problems,
  ];
}

// ─────────────────────────────────────────────────────────────── the two tables

const GENERATED = '<!-- Written by `node docs/themes/build.mjs`. Change palettes.mjs or lib/, not this file. -->';
const ratio = (n) => `${n.toFixed(n >= 10 ? 1 : 2)}`;

function contrastMd() {
  const rows = ALL.map((t) => contrastRows(t));
  const seats = ALL.map((t) => seatRows(t));
  const spreads = ALL.map((t) => seatSpread(t));
  const lowest = (list, floor) => {
    const of = list.filter((r) => r.floor === floor).sort((a, b) => a.ratio - b.ratio)[0];
    return `${ratio(of.ratio)} (${of.fg} on ${of.bg})`;
  };
  const count = (floor) => PAIRS.filter((p) => p[2] === floor).length;
  const cell = (r) => (r.pass ? ratio(r.ratio) : `**${ratio(r.ratio)} ✗**`);
  const mark = (value, floor) => (value >= floor ? ratio(value) : `**${ratio(value)} ✗**`);
  const head = ALL.map((t) => t.name).join(' | ');
  const lines = [
    '# Themes: the contrast numbers',
    '',
    GENERATED,
    '',
    'WCAG 2.2 contrast, foreground on background. Floors: **4.5 : 1** for body text and numbers, **3 : 1** for large',
    'numbers, icons and outlines. Seat distances are CIEDE2000 (about 2 is just visible; 10 and up reads as another',
    `colour). The two new themes pass every row. Today's values are beside them for comparison; **✗** marks a value under its floor.`,
    '',
    '## Summary',
    '',
    `| | ${head} |`,
    `| --- | ${ALL.map(() => '---').join(' | ')} |`,
    `| Pairs under their floor (of ${PAIRS.length}) | ${rows.map((r) => r.filter((x) => !x.pass).length).join(' | ')} |`,
    `| Text and numbers, the weakest of ${count(4.5)} pairs (floor 4.5) | ${rows.map((r) => lowest(r, 4.5)).join(' | ')} |`,
    `| Large numbers, icons and outlines, the weakest of ${count(3)} (floor 3) | ${rows.map((r) => lowest(r, 3)).join(' | ')} |`,
    `| Seat colours | ${ALL.map((t) => t.seats.length).join(' | ')} |`,
    `| Initials on the avatar, lowest (floor ${SEAT_FLOORS.initials}) | ${seats.map((s) => mark(Math.min(...s.map((x) => x.initials)), SEAT_FLOORS.initials)).join(' | ')} |`,
    `| Seat lettering on the header, lowest (floor ${SEAT_FLOORS.lettering}) | ${seats.map((s) => mark(Math.min(...s.map((x) => x.lettering)), SEAT_FLOORS.lettering)).join(' | ')} |`,
    `| Two closest seats (floor ${SEAT_FLOORS.spread}) | ${spreads.map((s) => `${mark(s.min, SEAT_FLOORS.spread)} (seats ${s.pair.join(' and ')})`).join(' | ')} |`,
    `| Closest neighbours at the table (floor ${SEAT_FLOORS.neighbour}) | ${spreads.map((s) => mark(s.neighbour, SEAT_FLOORS.neighbour)).join(' | ')} |`,
    `| Two closest seats as red-green colour-blind eyes see them (no floor) | ${spreads.map((s) => ratio(s.minCvd)).join(' | ')} |`,
    '',
    `Today's dark avatar figure is white initials on the pale seat tints: the avatar in the bottom bar (seat 1, ${ratio(seats[3][0].initials)} : 1)`,
    'and the seating guide (all ten). The other avatars on dark use the light theme\'s seat colours, which pass.',
    '',
    'The last row is why colour is never the only sign: with twenty colours (or with today\'s ten) some pairs look alike',
    'to red-green colour-blind eyes, so every seat always shows its initials too.',
    '',
    '## Every pair',
    '',
    `| Text / mark | On | Used for | Floor | ${head} |`,
    `| --- | --- | --- | --- | ${ALL.map(() => '---').join(' | ')} |`,
    ...PAIRS.map(([fg, bg, floor, where], i) => `| \`${fg}\` | \`${bg}\` | ${where} | ${floor} | ${rows.map((r) => cell(r[i])).join(' | ')} |`),
    '',
    '## Seats',
    '',
    'Initials = the seat\'s initials on its avatar. Lettering = the seat colour as initials on the table header, a card',
    'and the dealer\'s column (the lowest of the three).',
    '',
    '| Seat | Haveli | initials | lettering | Mehfil | initials | lettering |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...seats[0].map((s, i) => `| ${s.seat} | \`${s.fill}\` | ${ratio(s.initials)} | ${ratio(s.lettering)} | \`${seats[1][i].fill}\` | ${ratio(seats[1][i].initials)} | ${ratio(seats[1][i].lettering)} |`),
    '',
  ];
  return lines.join('\n');
}

function tokensMd() {
  const show = (v) => `\`${/^#/.test(v) ? v.toUpperCase() : v.replace(/\s+/g, '')}\``;
  return [
    '# Themes: every token, four ways',
    '',
    GENERATED,
    '',
    `The ${tokenKeys(today.light).length} colour tokens \`constants/theme.ts\` has today, each with its value in the two new sets and in today's two.`,
    'A token missing from a new set, or one no group below mentions, fails `node docs/themes/build.mjs --check`.',
    'The 20 seat colours of each new set are in [contrast.md](contrast.md#seats).',
    '',
    ...TOKEN_GROUPS.flatMap((g) => [
      `## ${g.title}`,
      '',
      '| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |',
      '| --- | --- | --- | --- | --- | --- |',
      ...g.tokens.map(([k, use]) => `| \`${k}\` | ${use} | ${ALL.map((t) => show(valueOf(t, k))).join(' | ')} |`),
      '',
    ]),
  ].join('\n');
}

function fixedColoursMd() {
  const { groups, lineCount, literalCount } = inventoryGroups();
  const lines = [
    '# Fixed colours outside the theme file',
    '',
    GENERATED,
    '',
    `Found by scanning \`app/\`, \`components/\`, \`utils/\`, \`contexts/\`, \`hooks/\`, \`services/\`, \`constants/\` (tests and`,
    `\`constants/theme.ts\` left out), the live scorecard page and \`app.json\`: **${literalCount} colour values on ${lineCount} lines in ${new Set(groups.map((g) => g.file)).size} files.**`,
    'Each needs one of three answers before a theme can be one switch.',
    '',
  ];
  for (const where of Object.keys(WHERE)) {
    const of = groups.filter((g) => g.rule.where === where);
    if (!of.length) continue;
    lines.push(`## ${WHERE[where]}`, '', '| File | Lines | Values | What it draws | Becomes |', '| --- | --- | --- | --- | --- |');
    for (const g of of) {
      const values = g.literals.length > 6 ? `${g.literals.slice(0, 5).map((l) => `\`${l}\``).join(' ')} … (${g.literals.length})` : g.literals.map((l) => `\`${l}\``).join(' ');
      lines.push(`| \`${g.file}\` | ${lineSpans(g.lines)} | ${values} | ${g.rule.what} | ${g.rule.becomes} |`);
    }
    lines.push('');
  }
  lines.push(
    '## Not written as a colour, but fixed all the same',
    '',
    'These read one fixed export of `constants/theme.ts` instead of the picked theme, so a search for colour values',
    'does not find them. A theme switch has to move them too.',
    '',
    '| What | Where | Becomes |',
    '| --- | --- | --- |',
    ...bypasses().map(({ rule, places }) => `| ${rule.what} | ${places.map((p) => `\`${p.file}\` ${lineSpans(p.lines)}`).join('; ')} | ${rule.becomes} |`),
    '',
  );
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────── pictures

/** How alike two frames are: the share of pixels equal, and equal allowing a 3 px (about 1 dp) shift. */
async function alike(chrome, fileA, fileB) {
  const data = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  return chrome.evaluate({
    html: `<img id="a" src="${data(fileA)}"><img id="b" src="${data(fileB)}">`,
    expression: `(async () => {
      const px = async (id) => { const im = document.getElementById(id); await im.decode(); const c = new OffscreenCanvas(im.naturalWidth, im.naturalHeight); const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
      const A = await px('a'), B = await px('b');
      const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height), T = 24;
      const same = (i, j) => Math.abs(A.data[i] - B.data[j]) <= T && Math.abs(A.data[i + 1] - B.data[j + 1]) <= T && Math.abs(A.data[i + 2] - B.data[j + 2]) <= T;
      let exact = 0, near = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * A.width + x) * 4;
        if (same(i, (y * B.width + x) * 4)) { exact++; near++; continue; }
        let hit = false;
        for (let dy = -3; dy <= 3 && !hit; dy++) for (let dx = -3; dx <= 3 && !hit; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w && same(i, (yy * B.width + xx) * 4)) hit = true;
        }
        if (hit) near++;
      }
      return { exact: 100 * exact / (w * h), near: 100 * near / (w * h) };
    })()`,
  });
}

async function pictures() {
  const { launch } = await import('./lib/chrome.mjs');
  const { robotoPath } = await import('./lib/font.mjs');
  const S = await import('./lib/screens.mjs');
  const sheets = await import('./lib/sheets.mjs');
  const fontPath = await robotoPath();
  const chrome = await launch();
  const temp = mkdtempSync(join(tmpdir(), 'themes-'));
  const { pixel6, small } = S.DEVICES;
  const written = [];
  const shoot = async (name, { html, width }, scale = 3) => {
    const size = await chrome.shot({ html, out: out(name), width, height: 800, scale, fullPage: true });
    written.push(`${name}  ${size.width} x ${size.height}`);
  };

  /** One screen photographed at the phone's own pixel size (1080 wide), the size the CI frames have. */
  const drawn = new Map();
  const draw = async (screen, theme, device = pixel6, data) => {
    const key = [screen, theme.id, device.id, data ? 'ci' : 'asked'].join('-');
    if (!drawn.has(key)) {
      const file = join(temp, `${key}.png`);
      const html = S.screenHtml({ fontPath, screen, theme, device, data, zoom: device.ratio });
      await chrome.shot({ html, out: file, width: Math.round(device.width * device.ratio), height: Math.round(device.height * device.ratio), scale: 1 });
      drawn.set(key, file);
    }
    return drawn.get(key);
  };

  try {
    // 1. Is the drawing today's layout? Draw it in today's colours and compare with the CI frame, pixel by pixel.
    const pairs = [
      { title: 'Home · Pixel 6', device: pixel6, screen: 'home', img: CI.home },
      { title: 'Scorecard · Pixel 6', device: pixel6, screen: 'scorecard', img: CI.scorecard, data: S.POOL_DATA_CI },
      { title: 'Home · small phone, text 1.3', device: small, screen: 'home', img: CI.homeSmall },
    ];
    for (const p of pairs) {
      p.drawn = await draw(p.screen, today.light, p.device, p.data);
      Object.assign(p, await alike(chrome, p.img, p.drawn));
    }
    await shoot('calibration.png', sheets.calibrationSheet({ fontPath, pairs }), 2);

    // 2. The two screens: today beside the new light and the new dark.
    await shoot('home.png', sheets.compareSheet({
      fontPath,
      title: 'Home: today, the new light, the new dark',
      sub: 'Same screen, same games, same sizes. Only the colours differ.',
      columns: [
        { cap: 'Today', note: `The real screen, from CI run ${CI_RUN.id}.`, img: CI.home },
        { cap: 'Haveli · new light', note: 'Cream paper, peacock-teal buttons, gold for games.', img: await draw('home', haveli) },
        { cap: 'Mehfil · new dark', note: 'Near-black brown, gold buttons, emerald for what is live.', img: await draw('home', mehfil) },
      ],
    }));
    await shoot('scorecard.png', sheets.compareSheet({
      fontPath,
      title: 'Scorecard of a pool in progress: today, the new light, the new dark',
      sub: '101 pool, 6 players, 5 rounds played. Kiran went out in round 4. Meena went out in round 2 and came back in round 3 at 71. The sixth player, Lakshmi, is one swipe to the right, as today.',
      columns: [
        { cap: 'Today · the real screen', note: `CI run ${CI_RUN.id}. Its pool has 9 players and no re-entry, so its rows are a little shorter.`, img: CI.scorecard },
        { cap: 'Today · the same game', note: 'Drawn in today\'s colours, so the two new ones can be compared with it line by line.', img: await draw('scorecard', today.light) },
        { cap: 'Haveli · new light', note: 'Gold badge and Pool tag, teal buttons, rust-red for OUT.', img: await draw('scorecard', haveli) },
        { cap: 'Mehfil · new dark', note: 'Gold buttons, emerald newest round, coral OUT, indigo re-entry.', img: await draw('scorecard', mehfil) },
      ],
    }));
    await shoot('home-small-phone.png', sheets.compareSheet({
      fontPath,
      device: small,
      title: 'Home on the small phone (360 dp wide, text size 1.3): nothing changes size',
      sub: 'The left frame is the real screen from CI. The other two are the new themes at the same width and text size: every button, card and line of text sits where it sits today.',
      columns: [
        { cap: 'Today', note: `CI run ${CI_RUN.id}, small phone.`, img: CI.homeSmall },
        { cap: 'Mehfil · new dark', note: 'Same sizes, new colours.', img: await draw('home', mehfil, small) },
        { cap: 'Haveli · new light', note: 'Same sizes, new colours.', img: await draw('home', haveli, small) },
      ],
    }));
    await shoot('overview.png', sheets.compareSheet({
      fontPath,
      title: 'Gold: one theme, a dark side and a light side',
      sub: 'Home and the Scorecard in the two new sets of colours. The layout is today\'s; nothing has moved.',
      columns: [
        { cap: 'Mehfil · dark', note: 'Home', img: await draw('home', mehfil) },
        { cap: 'Mehfil · dark', note: 'Scorecard', img: await draw('scorecard', mehfil) },
        { cap: 'Haveli · light', note: 'Home', img: await draw('home', haveli) },
        { cap: 'Haveli · light', note: 'Scorecard', img: await draw('scorecard', haveli) },
      ],
    }));

    // 3. A swatch sheet per theme, and the long sheet with every token.
    const keys = (names) => [
      ['Page', names[0], 'background', 'onBackground'], ['Card', names[1], 'surface', 'onSurface'], ['Main action', names[2], 'primary', 'onPrimary'],
      ['A game, a selection', names[3], 'secondaryContainer', 'onSecondaryContainer'], ['Live', names[4], 'primaryContainer', 'onPrimaryContainer'], ['Minus, OUT, Delete', names[5], 'error', 'onError'],
      ['Winner', names[6], 'winContainer', 'onWinContainer'], ['Leader, Creator', names[7], 'leaderContainer', 'onLeaderContainer'], ['Re-entry', names[8], 'reentryContainer', 'reentry'],
      ['Warning', names[9], 'errorContainer', 'onErrorContainer'], ['Toast', names[10], 'inverseSurface', 'inverseOnSurface'], ['Sign-in band', names[11], 'felt', 'onFelt'],
    ];
    await shoot('swatches-haveli.png', sheets.swatchSheet({
      fontPath,
      theme: haveli,
      blurb: 'Light, from the truck painting: cream paper, teak-brown ink, peacock teal for the main action, gold for a game or a selection, rust-red for a minus, saffron for the leader, indigo for a re-entry.',
      keys: keys(['cream', 'ivory', 'peacock teal', 'gold', 'pale teal', 'rust red', 'mint', 'saffron', 'indigo', 'blush', 'teak', 'rust brown']),
    }));
    await shoot('swatches-mehfil.png', sheets.swatchSheet({
      fontPath,
      theme: mehfil,
      blurb: 'Dark, from the three Pushpa pictures: near-black brown, ivory ink, gold for the main action, bronze for a game or a selection, emerald for what is live, coral and ruby for a minus, saffron for the leader, indigo for a re-entry.',
      keys: keys(['near-black brown', 'dark teak', 'gold', 'bronze', 'emerald', 'coral', 'deep emerald', 'burnt saffron', 'indigo', 'ruby', 'ivory', 'ruby']),
    }));
    await shoot('tokens-haveli.png', sheets.tokenSheet({ fontPath, theme: haveli }), 2);
    await shoot('tokens-mehfil.png', sheets.tokenSheet({ fontPath, theme: mehfil }), 2);

    // 4. How the switch works.
    await shoot('switch.png', sheets.switchSheet({ fontPath, gold: { light: haveli, dark: mehfil }, clubhouse: today }));

    return { written, pairs };
  } finally {
    await chrome.close();
    rmSync(temp, { recursive: true, force: true });
  }
}

const found = check();
if (found.length) {
  console.error(found.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${THEMES.map((t) => t.name).join(' and ')}: all ${tokenKeys(today.light).length} tokens set, ${PAIRS.length} contrast pairs and 20 seats each above their floors; every fixed colour has a plan.`);

if (!process.argv.includes('--check')) {
  writeFileSync(out('contrast.md'), contrastMd());
  writeFileSync(out('tokens.md'), tokensMd());
  writeFileSync(out('fixed-colours.md'), fixedColoursMd());
  const { written, pairs } = await pictures();
  console.log(['contrast.md', 'tokens.md', 'fixed-colours.md', ...written].map((w) => `  wrote ${w}`).join('\n'));
  for (const p of pairs) console.log(`  drawing vs CI, ${p.title}: ${p.exact.toFixed(1)}% of pixels the same, ${p.near.toFixed(1)}% within 3 px`);
}
