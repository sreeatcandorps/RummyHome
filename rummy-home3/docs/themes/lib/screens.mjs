// Home and the pool Scorecard, drawn from the app's own numbers: every size, gap and radius below is
// the one in the component it mirrors (named beside it), and every colour is a theme token. Nothing
// here chooses a layout; only the token set changes between the pictures.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_ROOT } from './today.mjs';

const ICON_DIR = join(APP_ROOT, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons');
const ICON_FONT = join(ICON_DIR, 'Fonts', 'MaterialCommunityIcons.ttf');
const GLYPHS = existsSync(join(ICON_DIR, 'glyphmaps', 'MaterialCommunityIcons.json'))
  ? JSON.parse(readFileSync(join(ICON_DIR, 'glyphmaps', 'MaterialCommunityIcons.json'), 'utf8'))
  : null;

export const DEVICES = {
  // The two phones CI runs the smoke flows on.
  pixel6: { id: 'pixel6', label: 'Pixel 6', width: 1080 / 2.625, height: 2400 / 2.625, ratio: 2.625, fontScale: 1, statusBar: 24, navBar: 48, navKeys: 119, statusEnd: 43 },
  small: { id: 'small', label: 'Small phone · 360 dp · text 1.3', width: 360, height: 780, ratio: 3, fontScale: 1.3, statusBar: 24, navBar: 48, navKeys: 90, statusEnd: 28 },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A MaterialCommunityIcons glyph: the same font file and code point the app draws. */
export function icon(name, size, color, extra = '') {
  if (!GLYPHS) throw new Error('Run `npm ci` in rummy-home3 first: the icon font comes from @expo/vector-icons.');
  const code = GLYPHS[name];
  if (!code) throw new Error(`No MaterialCommunityIcons glyph "${name}"`);
  return `<i class="mi" style="width:${size}px;height:${size}px;font-size:${size}px;line-height:${size}px;color:${color};${extra}">&#x${code.toString(16)};</i>`;
}

const flat = (theme) => {
  const vars = [];
  const walk = (prefix, obj) => Object.entries(obj).forEach(([k, v]) => (typeof v === 'object' ? walk(`${prefix}${k}-`, v) : vars.push(`--${prefix}${k}:${v}`)));
  walk('', theme.colors);
  walk('game-', theme.gameTypes.pool);
  theme.seats.forEach((s, i) => vars.push(`--seat${i + 1}:${s.fill}`, `--seat${i + 1}-on:${s.on}`, `--seat${i + 1}-text:${s.text}`));
  return vars.join(';');
};
const v = (token) => `var(--${token})`;

/**
 * Paper's Material 3 type scale with the overrides in constants/theme.ts (`fontOverrides`):
 * size, line height, weight, letter spacing, and whether Paper draws it in Android's medium face.
 */
const TYPE = {
  headlineSmall: [24, 32, 800, 0, false],
  titleLarge: [22, 28, 800, 0, false],
  titleMedium: [18, 24, 700, 0.15, true],
  titleSmall: [14, 20, 500, 0.1, true],
  bodyLarge: [16, 24, 400, 0.15, false],
  bodyMedium: [16, 24, 400, 0.25, false],
  bodySmall: [14, 20, 400, 0.4, false],
  labelLarge: [16, 20, 700, 0.1, true],
  labelMedium: [14, 18, 700, 0.5, true],
  labelSmall: [13, 16, 600, 0.5, true],
};

/**
 * What Android draws for a requested weight. React Native asks the system font for "normal" below
 * 700 and "bold" from 700 up, on top of the face Paper picked: regular gives 400 / 700, medium gives
 * 500 / 800. Measured against the CI frames (the ink of each line matches within 2%).
 */
const deviceWeight = (weight, medium) => (weight >= 700 ? (medium ? 800 : 700) : (medium ? 500 : 400));

/**
 * Android 14's font scaling is not a straight multiply: small text grows by the full setting and
 * large text by less (FontScaleConverterFactory's table for 1.3, read between its points).
 */
const SP_AT_130 = [[8, 10.4], [10, 13], [12, 15.6], [14, 18.8], [18, 21.6], [20, 23.6], [24, 26.4], [30, 30], [100, 100]];
function scaledSp(size, fontScale) {
  if (fontScale === 1) return size;
  if (fontScale !== 1.3) return size * fontScale;
  if (size <= SP_AT_130[0][0]) return size * 1.3;
  for (let i = 1; i < SP_AT_130.length; i++) {
    const [x0, y0] = SP_AT_130[i - 1];
    const [x1, y1] = SP_AT_130[i];
    if (size <= x1) return y0 + ((size - x0) / (x1 - x0)) * (y1 - y0);
  }
  return size;
}

function makeText(device) {
  const fontScale = device.fontScale;
  /**
   * `scale` false = the text ignores the phone's font size; a number caps it (the table's
   * maxFontSizeMultiplier). `tight` = includeFontPadding false. With no line height Android gives a
   * line the font's full top-to-bottom box (1.327 em for Roboto), drawn here as padding.
   */
  return function text(content, { variant, size, line, weight, spacing, color, style = '', scale = true, cls = '', tight = false } = {}) {
    const [vs, vl, vw, vsp, medium] = variant ? TYPE[variant] : [size ?? 14, null, weight ?? 400, spacing ?? 0, false];
    const sp = (n) => (scale === false ? n : typeof scale === 'number' ? Math.min(scaledSp(n, fontScale), n * scale) : scaledSp(n, fontScale));
    const fs = sp(size ?? vs);
    const lh = line ?? (variant && size == null ? vl : null);
    const px = (n) => Math.ceil(n * device.ratio - 0.001) / device.ratio;
    const box = lh != null
      ? `line-height:${px(sp(lh))}px;`
      : tight ? `line-height:${px(fs * 1.1719)}px;` : `line-height:${fs * 1.1719}px;padding-top:${fs * 0.1284}px;padding-bottom:${fs * 0.0269}px;`;
    return `<span class="t ${cls}" style="font-size:${fs}px;${box}font-weight:${deviceWeight(weight ?? vw, medium)};letter-spacing:${(spacing ?? vsp)}px;color:${color ?? v('onSurface')};${style}">${esc(content)}</span>`;
  };
}

/** Fonts for a page: Roboto (the phone's) and the app's icon font. */
export function fontCss(fontPath) {
  return `
@font-face{font-family:'Roboto';src:url('${pathToFileURL(fontPath).href}');font-weight:100 900;font-stretch:75% 100%}
@font-face{font-family:'MDI';src:url('${pathToFileURL(ICON_FONT).href}')}
.mi{font-family:'MDI';font-style:normal;font-weight:400;display:block;flex-shrink:0;text-align:center}`;
}

/** React Native's box model (column flex, border-box), scoped to `.phone` so a sheet can hold several. */
export const PHONE_CSS = `
.phone,.phone div{box-sizing:border-box;margin:0;padding:0;display:flex;flex-direction:column;position:relative;flex-shrink:0;min-width:0;min-height:0;border:0 solid transparent}
.phone{font-family:'Roboto',sans-serif;font-stretch:100%;-webkit-font-smoothing:antialiased;background:var(--background);color:var(--onSurface);overflow:hidden;text-align:left}
.phone .row{flex-direction:row;align-items:center}
.phone .t{display:block;margin:0;white-space:nowrap;font-variant-numeric:normal;flex-shrink:0}
.phone .t.shrink{flex-shrink:1;overflow:hidden;text-overflow:ellipsis;min-width:0}
.phone .t.tab{font-variant-numeric:tabular-nums}
.phone .t.struck{text-decoration:line-through}
.phone .status{flex-direction:row;align-items:center;justify-content:space-between}
.phone .nav{position:absolute;left:0;right:0;bottom:0;flex-direction:row;align-items:center;justify-content:center}
.phone .card{border-radius:16px;border-width:var(--hl2);border-color:var(--outlineVariant);background:var(--surface)}
.phone .tag{flex-direction:row;align-items:center;gap:4px;padding:0 10px;min-height:32px;border-radius:999px;flex-shrink:1}
.phone .pill{border-radius:999px;flex-direction:row;align-items:center;justify-content:center}
`;

/** Android's status bar (clock, wifi, signal) and three-button bar, in the system's own greys. */
function systemBars(theme, device, time) {
  const ink = theme.dark ? 'rgba(255,255,255,0.86)' : 'rgba(0,0,0,0.6)';
  const key = theme.dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  const pad = device.id === 'small' ? 14 : 8;
  const status = `<div class="status" style="height:${device.statusBar}px;padding:0 ${pad}px"><span class="t" style="font-size:14px;font-weight:400;color:${ink};letter-spacing:0.2px">${time}</span>
    <div class="row" style="gap:1px;margin-right:${device.statusEnd - pad}px">${icon('wifi-strength-4', 17, ink)}${icon('signal-cellular-3', 16, ink)}${device.id === 'small' ? icon('battery-charging', 16, ink) : ''}</div></div>`;
  const cx = device.width / 2;
  const k = device.navKeys;
  const nav = `<div class="nav" style="height:${device.navBar}px"><svg width="${device.width}" height="${device.navBar}" viewBox="0 0 ${device.width} ${device.navBar}">
      <path d="M ${cx - k - 8.2} 24 l 13.2 -7.9 a 1.6 1.6 0 0 1 2.4 1.4 v 13 a 1.6 1.6 0 0 1 -2.4 1.4 z" fill="${key}"/>
      <circle cx="${cx}" cy="24" r="8.2" fill="${key}"/>
      <rect x="${cx + k - 7.4}" y="16.6" width="14.8" height="14.8" rx="1.6" fill="${key}"/></svg></div>`;
  return { status, nav };
}

const tagTone = {
  neutral: ['surfaceVariant', 'onSurfaceVariant'],
  primary: ['primaryContainer', 'onPrimaryContainer'],
  leader: ['leaderContainer', 'onLeaderContainer'],
  info: ['tertiaryContainer', 'onTertiaryContainer'],
  pool: ['game-container', 'game-on'],
};

/**
 * One phone as markup: `screen` is 'home' or 'scorecard'. `zoom` scales the whole phone (1 = one CSS px
 * per dp), so the same drawing serves a 1080 px calibration frame and a 3x sheet.
 */
export function phone({ screen, theme, device, data, zoom = 1, time }) {
  const text = makeText(device);
  const bars = systemBars(theme, device, time ?? (screen === 'home' ? '5:00' : '5:01'));
  const tag = (label, tone, iconName) => {
    const [bg, fg] = tagTone[tone];
    return `<div class="tag" style="background:${v(bg)}">${iconName ? icon(iconName, 16, v(fg)) : ''}${text(label, { variant: 'labelMedium', color: v(fg), cls: 'shrink' })}</div>`;
  };
  const body = screen === 'home'
    ? home({ theme, device, text, tag, data: data ?? HOME_DATA })
    : scorecard({ theme, device, text, tag, data: data ?? POOL_DATA });
  const hl = 1 / device.ratio;
  return `<div class="phone" style="${flat(theme)};--hl:${hl}px;--hl2:${2 * hl}px;width:${device.width}px;height:${device.height}px;zoom:${zoom}">${bars.status}${body}${bars.nav}</div>`;
}

/** A whole page holding one phone, edge to edge (the calibration frames). */
export function screenHtml({ fontPath, ...rest }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}${fontCss(fontPath)}${PHONE_CSS}</style></head><body>${phone(rest)}</body></html>`;
}

// ─────────────────────────────────────────────────────────────── Home (app/(tabs)/index.tsx)

export const HOME_DATA = {
  firstName: 'Ravi',
  initials: 'RK',
  myPlayers: 9,
  live: [
    { badge: 'P1', when: 'Fri, Nov 27 · 3:28 PM', status: 'Active', role: 'Creator', type: 'Pool', players: 9 },
    { badge: 'S1', when: 'Fri, Nov 27 · 2:58 PM', status: 'Active', role: 'Creator', type: 'Points', players: 10 },
  ],
  recent: [
    { badge: 'S2', when: 'Thu, Nov 26 · 3:48 PM', status: 'Closed', role: 'Creator', type: 'Points', players: 4 },
    { badge: 'S1', when: 'Thu, Nov 26 · 2:48 PM', status: 'Closed', role: 'Creator', type: 'Points', players: 3 },
  ],
};

const STATUS = { Active: ['primary', 'circle-medium'], Completed: ['info', 'flag-checkered'], Closed: ['neutral', 'lock-outline'] };

function home({ device, text, tag, data, theme }) {
  // components/ui/GameListItem.tsx
  const gameRow = (g) => `
    <div style="margin-bottom:8px">
      <div class="card" style="overflow:hidden">
        <div class="row" style="gap:12px;padding:12px 8px 12px 12px;min-height:76px">
          <div style="width:44px;height:44px;border-radius:12px;background:${v('game-container')};align-items:center;justify-content:center">
            ${text(g.badge, { size: 16, weight: 800, spacing: -0.5, color: v('game-on') })}
          </div>
          <div style="flex:1;gap:4px;flex-shrink:1">
            ${text(g.when, { variant: 'titleMedium', cls: 'shrink' })}
            <div class="row" style="gap:8px;flex-wrap:wrap">
              ${tag(g.status, STATUS[g.status][0], STATUS[g.status][1])}
              ${tag(g.role, 'leader', 'crown-outline')}
              ${text(g.type, { variant: 'bodySmall', color: v('onSurfaceVariant'), cls: 'shrink' })}
              <div class="row" style="gap:2px">${icon('account-multiple-outline', 14, v('onSurfaceVariant'))}${text(g.players, { variant: 'bodySmall', color: v('onSurfaceVariant') })}</div>
            </div>
          </div>
          ${icon('chevron-right', 22, v('onSurfaceVariant'))}
        </div>
      </div>
    </div>`;
  // components/ui/SectionCard.tsx
  const cardHead = (title, iconName) => `
    <div class="row" style="gap:12px">
      <div style="width:32px;height:32px;border-radius:8px;background:${v('primaryContainer')};align-items:center;justify-content:center">${icon(iconName, 18, v('onPrimaryContainer'))}</div>
      <div style="flex:1;flex-shrink:1">${text(title, { variant: 'titleMedium' })}</div>
      <div style="min-width:28px;min-height:28px;align-items:center;justify-content:center">${icon('information-outline', 18, v('onSurfaceVariant'))}</div>
    </div>`;
  // components/ui/AppButton.tsx on Paper's Button (icon 18, label 16/20 800). `cut`: a label too long
  // for its button. Yoga gives the label the button's width less its own margins, lets the row
  // overflow by the icon's 18 dp and centres it: everything starts 9 dp early (the small phone's CI frame).
  const button = (label, iconName, { bg, fg, edge, minHeight, labelStyle = {}, cut = false }) => `
    <div class="pill" style="background:${bg};min-height:${minHeight + (edge ? 4 : 0)}px;${edge ? `border-bottom:4px solid ${edge};` : ''}${cut ? 'justify-content:flex-start;' : ''}">
      ${icon(iconName, 18, fg, `margin-left:${cut ? 7 : 16}px;margin-right:-16px`)}
      ${text(label, { variant: 'labelLarge', size: labelStyle.size ?? 16, line: 20, weight: 800, spacing: labelStyle.spacing ?? 0.1, color: fg, style: `margin:9px ${cut ? 7 : 16}px 9px 26px`, cls: 'shrink' })}
    </div>`;
  const seat1 = theme.seats[0];
  const tabHeight = 52;
  return `
    <!-- app/(tabs)/_layout.tsx: BrandTitle + HelpButton -->
    <div class="row" style="height:64px;padding-left:16px;justify-content:space-between">
      <div class="row" style="gap:8px">
        <div style="width:40px;height:40px;border-radius:999px;background:${v('secondaryContainer')};align-items:center;justify-content:center">
          <img src="${pathToFileURL(join(APP_ROOT, 'assets', 'icon-small.png')).href}" style="width:28px;height:28px;border-radius:999px;display:block">
        </div>
        ${text('EZ Score: Rummy', { variant: 'titleLarge', line: 24, spacing: -0.2 })}
      </div>
      <div style="width:38px;height:38px;margin:6px;align-items:center;justify-content:center">${icon('help-circle-outline', 22, v('onSurface'))}</div>
    </div>
    <!-- components/ui/Screen.tsx ScreenList: padding 16 / 16 / 32, gap 16 -->
    <div style="flex:1;flex-shrink:1;overflow:hidden;padding:16px 16px 0 16px">
      <div style="gap:16px">
        ${text(`Hi ${data.firstName}`, { variant: 'headlineSmall', weight: 700, style: 'margin-bottom:8px' })}
        <div style="margin-bottom:12px">${button('New game', 'plus', { bg: v('primary'), fg: v('onPrimary'), edge: v('primaryEdge'), minHeight: 52 })}</div>
        <div>
          <div class="row" style="gap:8px;align-items:flex-start">
            <!-- Both are flex 1; Paper's Button also has minWidth 64, which Yoga adds to the first one's share. -->
            <div style="flex:1 1 64px;margin-bottom:16px">${button('Results', 'podium', { bg: v('secondaryContainer'), fg: v('onSecondaryContainer'), minHeight: 56, labelStyle: { size: 17, spacing: 0.2 } })}</div>
            <div style="flex:1 1 0px;margin-bottom:16px">
              ${button('My players', 'account-group', { bg: v('secondaryContainer'), fg: v('onSecondaryContainer'), minHeight: 56, labelStyle: { size: 17, spacing: 0.2 }, cut: device.fontScale > 1 && device.width <= 360 })}
              <div style="position:absolute;top:-8px;right:-4px;min-width:26px;height:26px;padding:0 6px;border-radius:999px;border:2px solid ${v('background')};background:${v('leaderContainer')};align-items:center;justify-content:center">
                ${text(data.myPlayers, { variant: 'labelMedium', weight: 800, color: v('onLeaderContainer'), cls: 'tab' })}
              </div>
            </div>
          </div>
          <div class="card" style="padding:16px;gap:12px">
            ${cardHead(`Live · ${data.live.length}`, 'cards-playing-outline')}
            ${data.live.map(gameRow).join('')}
          </div>
          <div style="height:12px"></div>
          <div class="card" style="padding:16px 16px 0 16px;gap:12px;background:${v('surfaceVariant')};border-bottom-width:0;border-bottom-left-radius:0;border-bottom-right-radius:0">
            ${cardHead('Recent', 'history')}
          </div>
        </div>
      </div>
      ${data.recent.map((g) => `<div style="background:${v('surfaceVariant')};border-left:var(--hl2) solid ${v('outlineVariant')};border-right:var(--hl2) solid ${v('outlineVariant')};padding:12px 16px 0 16px">${gameRow(g)}</div>`).join('')}
    </div>
    <!-- components/ui/TabBarButtons.tsx -->
    <div class="row" style="gap:8px;background:${v('surface')};border-top:var(--hl) solid ${v('outlineVariant')};padding:8px 12px ${device.navBar + 8}px 12px">
      <div class="pill" style="flex:1;height:${tabHeight}px;background:${v('primary')};border:2px solid ${v('primary')};border-bottom:4px solid ${v('primaryEdge')}">${icon('home-variant', 26, v('onPrimary'))}</div>
      <div class="pill" style="flex:1;height:${tabHeight}px;background:${v('surfaceSunken')};border:2px solid ${v('outlineVariant')}">
        <div style="width:32px;height:32px;border-radius:999px;background:${seat1.fill};align-items:center;justify-content:center">
          ${text(data.initials, { size: 13, line: 15.6, weight: 700, spacing: 0.3, color: seat1.on })}
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────── Scorecard (app/(screens)/games/[id].tsx)

/**
 * The pool asked for: 101 limit, 6 players, 5 rounds played. Kiran went out in round 4; Meena went
 * out in round 2 and re-entered before round 3 at the highest score still in, plus one (70 + 1).
 * The first five columns carry the numbers of the CI frame (22d) wherever the story allows.
 */
export const POOL_DATA = {
  label: 'P1',
  limit: 101,
  drop: 25,
  fullCount: 80,
  nextRound: 6,
  dealers: ['RK', 'AR', 'KR', 'MI', 'SN'],
  opens: 'SN',
  players: [
    { label: 'RK', name: 'Ravi Kumar', scores: [20, 5, 10, 10, 20] },
    { label: 'AR', name: 'Anil Reddy', scores: [0, 20, 5, 10, 0] },
    { label: 'KR', name: 'Kiran Rao', scores: [30, 40, 25, 20, null], outRound: 4 },
    { label: 'MI', name: 'Meena Iyer', scores: [80, 25, 5, 10, 5], reenteredRound: 3, reentryScore: 71 },
    { label: 'SN', name: 'Suresh Nair', scores: [20, 0, 15, 5, 20] },
    { label: 'LP', name: 'Lakshmi Pillai', scores: [10, 25, 0, 0, 25] },
  ],
};

/** The game in CI frame 22d-pool-9p-portrait, used only to measure the drawing against the real app. */
export const POOL_DATA_CI = {
  label: 'P1',
  limit: 101,
  drop: 25,
  fullCount: 80,
  nextRound: 6,
  dealers: ['RK', 'AR', 'KR', 'MI', 'SN'],
  opens: 'SN',
  players: [
    { label: 'RK', name: 'Ravi Kumar', scores: [20, 5, 10, 10, 20] },
    { label: 'AR', name: 'Anil Reddy', scores: [0, 20, 5, 10, 0] },
    { label: 'KR', name: 'Kiran Rao', scores: [30, 40, 25, 20, null], outRound: 4 },
    { label: 'MI', name: 'Meena Iyer', scores: [15, 15, 5, 20, 5] },
    { label: 'SN', name: 'Suresh Nair', scores: [20, 0, 15, 5, 20] },
    { label: 'LP', name: 'Lakshmi Pillai', scores: [25, 10, 10, 0, 20] },
    { label: 'VM', name: 'Vijay Menon', scores: [10, 15, 0, 15, 10] },
    { label: 'AD', name: 'Arun Das', scores: [15, 10, 20, 5, 5] },
    { label: 'NS', name: 'Neha Shah', scores: [25, 25, 30, 25, null], outRound: 4 },
  ],
};

/** utils/pool.ts: the re-entry score plus every score from the (re-)entry round on. */
function poolTotal(p) {
  const from = p.reenteredRound ? p.reenteredRound - 1 : 0;
  return p.scores.reduce((sum, s, i) => (i >= from && typeof s === 'number' ? sum + s : sum), p.reenteredRound ? p.reentryScore : 0);
}

/** utils/scorecardLayout.ts, portrait, five columns (D90). */
function tableMetrics(tableWidth, playerCount, fontScale) {
  const scale = Math.min(Math.max(fontScale, 1), 1.2);
  const columnWidth = Math.max(38, (tableWidth - 42) / Math.min(playerCount, 5));
  const cell = columnWidth >= 64 ? 18 : columnWidth >= 52 ? 16 : columnWidth >= 44 ? 15 : 13;
  const m = (size, ratio = 1.2) => ({ size, line: Math.ceil(size * ratio) });
  const type = { initials: m(cell - 1), total: m(columnWidth >= 56 ? cell + 2 : cell - 1), deals: m(columnWidth >= 52 ? 9 : 8, 1.35) };
  const headerH = Math.ceil((type.initials.line + type.total.line + type.deals.line) * scale + 4 + 8 + 4);
  const rowH = Math.max(playerCount > 8 ? 42 : 48, Math.ceil(cell * 1.25 * scale) + 10);
  return { columnWidth, cell, type, headerH, rowH, scale };
}

function scorecard({ device, text, tag, data, theme }) {
  const width = device.width;
  const tableWidth = Math.floor(width - 16);
  const players = data.players.map((p, i) => ({ ...p, seat: i + 1, total: poolTotal(p) }));
  const { columnWidth, cell, type, headerH, rowH } = tableMetrics(tableWidth, players.length, device.fontScale);
  const rounds = players[0].scores.length;
  const inPlayers = players.filter((p) => !p.outRound);
  const lowest = Math.min(...inPlayers.map((p) => p.total));
  const cap = 1.2;

  // components/game/ScoreTable.tsx: headerCells
  const headCell = (p) => {
    const out = Boolean(p.outRound);
    const re = Boolean(p.reenteredRound) && !out;
    const leader = !out && p.total === lowest;
    const seatText = out ? v('onSurfaceVariant') : re ? v('reentry') : v(`seat${p.seat}-text`);
    const totalColor = out ? v('onSurfaceVariant') : re ? v('reentry') : v('onSurface');
    const foot = out
      ? text(`OUT R${p.outRound}`, { size: type.deals.size, line: type.deals.line, weight: 800, spacing: 0.6, color: v('loss'), scale: cap })
      : p.label === data.opens
        ? `${leader ? icon('crown', type.deals.size + 1, v('leader')) : ''}${text('OPENS', { size: type.deals.size, line: type.deals.line, weight: 800, spacing: 0.6, color: v('onSurfaceVariant'), scale: cap })}`
        : leader ? icon('crown', type.deals.line, v('leader'))
          : `<div style="width:16px;height:3px;border-radius:999px;background:${seatText}"></div>`;
    return `<div style="width:${columnWidth}px;height:${headerH}px;padding:4px 2px;align-items:center;justify-content:space-between;border-right:var(--hl) solid ${v('hairline')};${out ? `background:${v('surfaceVariant')};` : ''}">
      ${text(p.label, { size: type.initials.size, line: type.initials.line, weight: 800, spacing: 0.2, color: seatText, scale: cap, cls: out ? 'struck' : '' })}
      ${text(p.total, { size: type.total.size, line: type.total.line, weight: 800, color: totalColor, scale: cap, cls: `tab ${out ? 'struck' : ''}` })}
      <div class="row" style="height:${type.deals.line}px;justify-content:center;gap:1px;overflow:hidden;max-width:100%">${foot}</div>
    </div>`;
  };

  // ScoreRow (pool branch)
  const scoreCell = (p, r) => {
    const s = p.scores[r];
    const has = typeof s === 'number';
    const round = r + 1;
    const before = p.reenteredRound != null && round < p.reenteredRound;
    const reHere = p.reenteredRound === round;
    const outHere = p.outRound === round;
    const win = has && s === 0;
    const big = has && s >= data.fullCount;
    const color = before ? v('onSurfaceVariant') : reHere ? v('reentry') : win ? v('onWinContainer') : big ? v('loss') : v('onSurface');
    const weight = before ? 500 : reHere ? 700 : win ? 800 : big ? 700 : 500;
    const shown = !has ? '–' : reHere ? `↺${p.reentryScore}` : `${s}${outHere ? ' ✕' : ''}`;
    return `<div style="width:${columnWidth}px;height:${rowH}px;align-items:center;justify-content:center;padding:0 2px;border-right:var(--hl) solid ${v('hairline')}">
      <div style="min-width:86%;padding:2px;border-radius:6px;align-items:center;${win && !before ? `background:${v('winContainer')};` : ''}">
        ${text(shown, { size: cell, weight, color, scale: cap, cls: `tab ${outHere ? 'struck' : ''}` })}
      </div></div>`;
  };

  const roundCell = (r) => {
    const latest = r === rounds - 1;
    return `<div style="width:42px;height:${rowH}px;align-items:center;justify-content:center;padding:0 2px;border-right:var(--hl) solid ${v('outlineVariant')};border-bottom:var(--hl) solid ${v('hairline')};background:${latest ? v('tableLatest') : v('tableHeader')}">
      ${text(r + 1, { size: cell - 1, weight: 800, scale: cap, cls: 'tab' })}
      ${text(data.dealers[r], { size: 11, weight: 600, color: v('onSurfaceVariant'), scale: cap, style: 'margin-top:-1px' })}
    </div>`;
  };

  const row = (r) => {
    const latest = r === rounds - 1;
    const bg = latest ? v('tableLatest') : r % 2 === 1 ? v('tableStripe') : v('surface');
    return `<div class="row" style="width:${columnWidth * players.length}px;height:${rowH}px;align-items:stretch;border-bottom:var(--hl) solid ${v('hairline')};background:${bg}">${players.map((p) => scoreCell(p, r)).join('')}</div>`;
  };

  // components/game/PoolStandings.tsx
  const standing = (p, index) => {
    const leader = index === 0 && inPlayers.length > 1;
    const re = Boolean(p.reenteredRound);
    const left = Math.max(0, data.limit - p.total);
    const drops = left <= 0 ? 0 : Math.ceil(left / data.drop);
    const num = (value, color) => text(value, { size: 14, weight: 700, color, style: 'width:56px;text-align:right', cls: 'tab' });
    return `<div class="row" style="padding:5px 4px;border-radius:8px;background:${leader ? v('leaderContainer') : re ? v('reentryContainer') : 'transparent'}">
      <div class="row" style="flex:1;gap:6px;flex-shrink:1">
        ${text(p.label, { size: 14, weight: 800, color: re ? v('reentry') : v('onSurface'), style: 'min-width:30px' })}
        ${text(p.name, { variant: 'bodyMedium', cls: 'shrink' })}
        ${leader ? icon('crown', 14, v('leader')) : ''}${re ? icon('restore', 14, v('reentry')) : ''}
      </div>
      ${num(p.total, re ? v('reentry') : v('onSurface'))}
      ${num(left, left <= Math.ceil(data.limit / 4) ? v('loss') : v('onSurface'))}
      ${num(drops, drops <= 1 ? v('loss') : v('onSurface'))}
    </div>`;
  };
  const outRow = (p) => `<div class="row" style="padding:5px 4px;border-radius:8px">
      <div class="row" style="flex:1;gap:6px;flex-shrink:1">
        ${text(p.label, { size: 14, weight: 800, color: v('onSurfaceVariant'), style: 'min-width:30px', cls: 'struck' })}
        ${text(p.name, { variant: 'bodyMedium', color: v('onSurfaceVariant'), cls: 'shrink struck' })}
        ${text(`OUT R${p.outRound}`, { variant: 'bodySmall', weight: 700, color: v('loss') })}
      </div>
      ${text(p.total, { size: 14, weight: 700, color: v('onSurfaceVariant'), style: 'width:56px;text-align:right', cls: 'tab struck' })}
      <div style="width:112px;align-items:flex-end">
        <!-- AppButton, compact outlined: 2 px border, 40 content, Paper's compact icon and label margins -->
        <div class="pill" style="min-height:44px;border:2px solid ${v('outline')}">
          ${icon('restore', 18, v('primary'), 'margin-left:8px')}
          ${text('Re-enter', { variant: 'labelLarge', size: 16, line: 20, weight: 800, spacing: 0.1, color: v('primary'), style: 'margin:10px 8px' })}
        </div>
      </div>
    </div>`;
  const sorted = [...inPlayers].sort((a, b) => a.total - b.total);
  const outs = players.filter((p) => p.outRound).sort((a, b) => a.outRound - b.outRound);

  // components/ui/StackedAction.tsx
  const action = (label, iconName, { filled, flex, emphasis }) => `
    <div class="pill" style="flex:${flex};height:52px;gap:4px;padding:0 6px;${filled
    ? `background:${v('primary')};border-bottom:4px solid ${v('primaryEdge')}`
    : `background:${v('surface')};border:2px solid ${v('outline')}`}">
      ${icon(iconName, emphasis ? 22 : 18, filled ? v('onPrimary') : v('primary'))}
      ${text(label, { variant: 'labelLarge', size: emphasis ? 16 : 15, line: 20, weight: 800, color: filled ? v('onPrimary') : v('primary'), cls: 'shrink' })}
    </div>`;

  return `
    <!-- native stack header: back, title 20/700 at the 72 dp keyline, then Share, Help and the menu, 16 from the edge -->
    <div class="row" style="height:56px;padding-right:16px">
      <div style="width:48px;height:48px;margin-left:4px;align-items:center;justify-content:center">${icon('arrow-left', 24, v('onSurface'))}</div>
      <div style="flex:1;flex-shrink:1;margin-left:19px">${text(`Scorecard · ${data.label}`, { size: 20, weight: 700, cls: 'shrink' })}</div>
      <div class="row">
        <div style="width:38px;height:38px;margin:6px;align-items:center;justify-content:center">${icon('share-variant', 22, v('onSurfaceVariant'))}</div>
        <div style="width:38px;height:38px;margin:6px;align-items:center;justify-content:center">${icon('help-circle-outline', 22, v('onSurface'))}</div>
        <div class="row" style="width:42.4px;height:40px">${icon('dots-vertical', 18, v('primary'), 'margin-left:6px')}</div>
      </div>
    </div>
    <!-- infoStrip: badge, type, players, round -->
    <div style="padding:4px 16px 8px 16px">
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <div style="min-width:48px;height:32px;padding:0 8px;border-radius:8px;background:${v('game-container')};align-items:center;justify-content:center">${text(data.label, { size: 16, weight: 800, spacing: -0.3, color: v('game-on') })}</div>
        ${tag('Pool', 'pool', 'trophy-outline')}
        ${tag(`${players.length} players`, 'neutral', 'account-group-outline')}
        ${tag(`Round ${data.nextRound}`, 'primary', 'cards-outline')}
      </div>
    </div>
    <div style="flex:1;flex-shrink:1;padding:0 8px 8px 8px;overflow:hidden">
      <!-- ScoreTable: pinned header, then five rows (hugRows) -->
      <div class="row" style="align-items:stretch;background:${v('tableHeader')};border:var(--hl2) solid ${v('outlineVariant')};border-bottom:var(--hl2) solid ${v('outlineVariant')};border-top-left-radius:16px;border-top-right-radius:16px;overflow:hidden">
        <div style="width:42px;height:${headerH}px;align-items:center;justify-content:center;border-right:var(--hl) solid ${v('outlineVariant')}">${text('RND', { size: 11, weight: 800, spacing: 0.6, color: v('onSurfaceVariant'), scale: cap })}</div>
        <div class="row" style="flex:1;flex-shrink:1;overflow:hidden;align-items:stretch">${players.map(headCell).join('')}</div>
      </div>
      <div class="row" style="align-items:flex-start;height:${rowH * 5}px;overflow:hidden;background:${v('surface')};border-left:var(--hl2) solid ${v('outlineVariant')};border-right:var(--hl2) solid ${v('outlineVariant')}">
        <div style="width:42px">${Array.from({ length: rounds }, (_, r) => roundCell(r)).join('')}</div>
        <div style="flex:1;flex-shrink:1;overflow:hidden">${Array.from({ length: rounds }, (_, r) => row(r)).join('')}</div>
      </div>
      <!-- pool standings pane: paddingTop 12, the card's marginTop 8 -->
      <div style="flex:1;flex-shrink:1;overflow:hidden;padding-top:12px">
        <div class="card" style="padding:8px;gap:2px;margin-top:8px">
          <div class="row" style="justify-content:space-between;align-items:baseline;padding:0 4px 4px 4px">
            ${text('Standings', { variant: 'titleSmall' })}
            ${text(`Limit ${data.limit} · ${data.limit - 1} in, ${data.limit} out`, { variant: 'bodySmall', color: v('onSurfaceVariant') })}
          </div>
          <div class="row" style="padding:0 4px 2px 4px">
            ${['Player', 'Score', 'Left', 'Drops'].map((h, i) => text(h.toUpperCase(), { size: 11, weight: 700, spacing: 0.4, color: v('onSurfaceVariant'), style: i ? 'width:56px;text-align:right' : 'flex:1' })).join('')}
          </div>
          <div>
            ${sorted.map(standing).join('')}
            ${outs.length ? text('Out', { variant: 'labelSmall', color: v('onSurfaceVariant'), style: 'padding:4px 4px 0 4px' }) : ''}
            ${outs.map(outRow).join('')}
          </div>
        </div>
      </div>
    </div>
    <!-- components/ui/BottomBar.tsx: Undo, Add round, Complete -->
    <div style="background:${v('surface')};border-top:var(--hl) solid ${v('outlineVariant')};padding:12px 16px ${device.navBar + 12}px 16px">
      <div class="row" style="gap:8px">
        ${action('Undo', 'undo-variant', { flex: 1 })}
        ${action('Add round', 'plus', { filled: true, flex: 1.45, emphasis: true })}
        ${action('Complete', 'flag-checkered', { flex: 1.25 })}
      </div>
    </div>`;
}
