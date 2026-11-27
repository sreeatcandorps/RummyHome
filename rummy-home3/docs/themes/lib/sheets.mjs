// The pictures themes.md shows: comparison sheets, swatch sheets, the switch diagram, the calibration.
// Each function returns one HTML page; build.mjs photographs it at 3x.
import { pathToFileURL } from 'node:url';
import { contrast, over } from './color.mjs';
import { DEVICES, PHONE_CSS, fontCss, icon } from './screens.mjs';
import { seatRows, seatSpread } from './check.mjs';
import { TOKEN_GROUPS } from './tokens.mjs';
import { valueOf } from './today.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SHEET_CSS = `
html,body{margin:0}
body{font-family:'Roboto',sans-serif;-webkit-font-smoothing:antialiased}
.sheet{box-sizing:border-box;padding:28px 28px 26px;background:var(--page);color:var(--ink)}
.sheet h1{font:800 26px/32px 'Roboto';margin:0 0 4px;letter-spacing:-0.2px}
.sheet h2{font:800 15px/20px 'Roboto';margin:22px 0 10px;letter-spacing:0.6px;text-transform:uppercase;color:var(--soft)}
.sheet p.sub{font:400 15px/21px 'Roboto';color:var(--soft);margin:0 0 20px;max-width:900px}
.cols{display:flex;gap:24px;align-items:flex-start}
.cap{font:800 15px/20px 'Roboto';margin:0 0 2px}
.note{font:400 12.5px/17px 'Roboto';color:var(--soft);margin:0 0 10px}
.frame{border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px var(--edge),0 8px 22px rgba(0,0,0,.14);line-height:0}
.frame img{display:block;width:100%}
.foot{font:400 12.5px/18px 'Roboto';color:var(--soft);margin:18px 0 0;max-width:1000px}
`;

const NEUTRAL = '--page:#EFECE6;--ink:#1F1A14;--soft:#5A5148;--edge:rgba(0,0,0,.18)';

const page = (fontPath, body, extraCss = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss(fontPath)}${PHONE_CSS}${SHEET_CSS}${extraCss}</style></head><body>${body}</body></html>`;

/** One phone picture in a rounded frame, `width` CSS px wide. At 360 and 3x a 1080-px frame is shown pixel for pixel. */
function framed({ width, device, img }) {
  const height = (width * device.height) / device.width;
  return `<div class="frame" style="width:${width}px;height:${height}px"><img src="${pathToFileURL(img).href}" style="width:${width}px;height:${height}px"></div>`;
}

/**
 * Phones side by side under a title. `columns`: [{ cap, note, img }], each `img` a CI frame or a drawn one.
 */
export function compareSheet({ fontPath, title, sub, columns, device = DEVICES.pixel6, phoneWidth = 360, foot }) {
  const noteHeight = Math.max(...columns.map((c) => Math.ceil((c.note ?? '').length / (phoneWidth / 6.4)))) * 17;
  const cols = columns.map((c) => `<div style="width:${phoneWidth}px">
      <p class="cap">${esc(c.cap)}</p>
      <p class="note" style="min-height:${noteHeight}px">${esc(c.note ?? '')}</p>
      ${framed({ width: phoneWidth, device, ...c })}
    </div>`).join('');
  const width = columns.length * phoneWidth + (columns.length - 1) * 24 + 56;
  return {
    width,
    html: page(fontPath, `<div class="sheet" style="${NEUTRAL};width:${width}px"><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p><div class="cols">${cols}</div>${foot ? `<p class="foot">${esc(foot)}</p>` : ''}</div>`),
  };
}

// ─────────────────────────────────────────────────────────────── swatch sheet

const SWATCH_CSS = `
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tile{display:flex;gap:10px;align-items:center;padding:8px;border-radius:12px;background:var(--tile);box-shadow:0 0 0 1px var(--tileEdge)}
.chip{flex:none;width:58px;height:46px;border-radius:9px;display:flex;align-items:center;justify-content:center;font:800 17px/20px 'Roboto';box-shadow:inset 0 0 0 1px var(--chipEdge);font-variant-numeric:tabular-nums;position:relative;overflow:hidden}
.meta{min-width:0;display:flex;flex-direction:column;gap:1px}
.meta b{font:700 13px/16px 'Roboto';color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta .hex{font:500 11.5px/15px 'Roboto';color:var(--soft);letter-spacing:0.3px;font-variant-numeric:tabular-nums}
.meta .use{font:400 11.5px/14px 'Roboto';color:var(--soft)}
.keys{display:flex;gap:12px;margin:0 0 12px}
.key{flex:1;border-radius:16px;padding:14px 14px 12px;min-height:112px;box-sizing:border-box;box-shadow:inset 0 0 0 1px var(--chipEdge);display:flex;flex-direction:column}
.key b{display:block;font:800 17px/21px 'Roboto'}
.key span{display:block;font:400 13px/17px 'Roboto';opacity:.9}
.key .hexline{margin-top:auto;font:500 12px/16px 'Roboto';letter-spacing:0.3px;opacity:.9;font-variant-numeric:tabular-nums}
.seats{display:grid;grid-template-columns:repeat(10,1fr);gap:12px 10px}
.seat{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0 6px;border-radius:12px;background:var(--tile);box-shadow:0 0 0 1px var(--tileEdge)}
.seat .av{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 17px/20px 'Roboto';letter-spacing:0.3px}
.seat .let{font:800 17px/20px 'Roboto';padding:1px 8px;border-radius:6px;letter-spacing:0.2px}
.seat .hex{font:500 10.5px/13px 'Roboto';color:var(--soft);letter-spacing:0.2px}
.seat .num{font:400 10.5px/13px 'Roboto';color:var(--soft);font-variant-numeric:tabular-nums}
`;

const shown = (value) => (/^#/.test(value) ? value.toUpperCase() : value.replace(/\s+/g, ''));

function tile(theme, [key, use, how]) {
  const value = valueOf(theme, key);
  const c = theme.colors;
  let chip;
  let ratio = null;
  if (how.on) {
    const fg = valueOf(theme, how.on);
    ratio = contrast(fg, over(value, c.surface));
    chip = `<div class="chip" style="background:${value};color:${fg}">12</div>`;
  } else if (how.line) {
    chip = `<div class="chip" style="background:${valueOf(theme, how.under)}"><div style="width:36px;height:24px;border-radius:12px;border:2px solid ${value}"></div></div>`;
  } else if (how.fill) {
    chip = `<div class="chip" style="background:${valueOf(theme, how.under)}"><div style="position:absolute;inset:0;background:${value}"></div></div>`;
  } else if (how.under) {
    const bg = valueOf(theme, how.under);
    ratio = contrast(value, bg);
    chip = `<div class="chip" style="background:${bg};color:${value}">12</div>`;
  } else {
    chip = `<div class="chip" style="background:${value}"></div>`;
  }
  return `<div class="tile">${chip}<div class="meta"><b>${esc(key)}</b><span class="hex">${esc(shown(value))}${ratio ? ` · ${ratio.toFixed(1)} : 1` : ''}</span><span class="use">${esc(use)}</span></div></div>`;
}

const sheetVars = (theme) => {
  const c = theme.colors;
  return `--page:${c.background};--ink:${c.onSurface};--soft:${c.onSurfaceVariant};--edge:${c.outlineVariant};--tile:${c.surface};--tileEdge:${c.outlineVariant};--chipEdge:${theme.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.10)'}`;
};

const sheetTitle = (theme, what) => `<h1>${esc(theme.name)} · ${what} <span style="font-weight:500;color:var(--soft)">(or “${esc(theme.altName)}”)</span></h1>`;

/** The short sheet: twelve colours that set the look, and the twenty seats. `keys`: [label, nickname, token, its text token]. */
export function swatchSheet({ fontPath, theme, keys, blurb }) {
  const c = theme.colors;
  const block = ([label, nick, token, onToken]) => {
    const bg = valueOf(theme, token);
    const fg = valueOf(theme, onToken);
    return `<div class="key" style="background:${bg};color:${fg}"><b>${esc(label)}</b><span>${esc(nick)}</span><span class="hexline">${esc(shown(bg))} · ${contrast(fg, over(bg, c.surface)).toFixed(1)} : 1</span></div>`;
  };
  const rows = seatRows(theme);
  const spread = seatSpread(theme);
  const seats = rows.map((s) => `<div class="seat">
      <div class="av" style="background:${s.fill};color:${s.on}">${s.seat}</div>
      <div class="let" style="background:${c.tableHeader};color:${s.text}">RK</div>
      <div class="hex">${s.fill}</div>
      <div class="num">${s.initials.toFixed(1)} · ${s.lettering.toFixed(1)}</div>
    </div>`).join('');
  const width = 1000;
  return {
    width,
    html: page(fontPath, `<div class="sheet" style="${sheetVars(theme)};width:${width}px">
      ${sheetTitle(theme, `the ${theme.dark ? 'dark' : 'light'} side of Gold`)}
      <p class="sub">${esc(blurb)}</p>
      <h2 style="margin-top:0">The twelve that set the look</h2>
      <div class="keys">${keys.slice(0, 6).map(block).join('')}</div>
      <div class="keys">${keys.slice(6).map(block).join('')}</div>
      <h2>Seats 1 to 20</h2>
      <div class="seats">${seats}</div>
      <p class="foot">On each block: what it is for, the colour, and the contrast of its own text (floor 4.5 : 1). Under each seat: the initials on the avatar · the same colour as lettering on the table header (floor 4.5 : 1 for both). The two closest seats (${spread.pair.join(' and ')}) are ${spread.min.toFixed(1)} apart on the CIEDE2000 scale, where 10 already reads as another colour; neighbours at the table are at least ${spread.neighbour.toFixed(1)} apart. Every token is on the second sheet.</p>
    </div>`, SWATCH_CSS),
  };
}

/** The long sheet: every token theme.ts has, grouped by what it is for. */
export function tokenSheet({ fontPath, theme }) {
  const groups = TOKEN_GROUPS.map((g, i) => `<h2${i ? '' : ' style="margin-top:0"'}>${esc(g.title)}</h2><div class="grid">${g.tokens.map((t) => tile(theme, t)).join('')}</div>`).join('');
  const width = 1120;
  return {
    width,
    html: page(fontPath, `<div class="sheet" style="${sheetVars(theme)};width:${width}px">
      ${sheetTitle(theme, 'every token')}
      <p class="sub">All ${TOKEN_GROUPS.reduce((n, g) => n + g.tokens.length, 0)} colour tokens the app's theme file has today, each given a value. Each tile: the colour, its token, its value, the contrast of the number drawn on it, and where the app uses it.</p>
      ${groups}
    </div>`, SWATCH_CSS),
  };
}

// ─────────────────────────────────────────────────────────────── the switch

const SWITCH_CSS = `
.switch{display:flex;gap:36px;align-items:flex-start}
.me{box-sizing:border-box;width:360px;padding:6px 16px 14px;border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px var(--edge),0 8px 22px rgba(0,0,0,.14)}
.me+.me{margin-top:16px}
.grid2{display:grid;grid-template-columns:118px 1fr 1fr;gap:10px;align-items:stretch;width:560px}
.grid2 .h{font:800 13px/16px 'Roboto';letter-spacing:0.6px;text-transform:uppercase;color:var(--soft);display:flex;align-items:center;justify-content:center;text-align:center}
.grid2 .r{justify-content:flex-start;text-align:left;font-size:15px;letter-spacing:0;text-transform:none;color:var(--ink)}
.cell{border-radius:14px;padding:12px;box-shadow:0 0 0 1px rgba(0,0,0,.16)}
.cell b{display:block;font:800 15px/20px 'Roboto'}
.cell span{display:block;font:400 12px/16px 'Roboto';opacity:.8;margin-bottom:10px}
.dots{display:flex;gap:6px}
.dots i{width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(128,128,128,.35)}
.flow{display:flex;align-items:center;gap:10px;margin-top:22px;width:560px}
.box{flex:1;border-radius:12px;padding:10px 12px;background:#FFFFFF;box-shadow:0 0 0 1px rgba(0,0,0,.16);font:400 12.5px/17px 'Roboto';color:#1F1A14}
.box b{display:block;font:800 13.5px/18px 'Roboto'}
.arrow{font:800 20px/20px 'Roboto';color:#5A5148}
`;

function meCard(theme, families, picked) {
  const v = (t) => valueOf(theme, t);
  const segmented = (options, on) => `<div style="display:flex;border:1px solid ${v('outline')};border-radius:999px;overflow:hidden;min-height:40px">${options.map((o, i) => `
      <div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:40px;padding:0 8px;${i ? `border-left:1px solid ${v('outline')};` : ''}${o === on ? `background:${v('secondaryContainer')};` : ''}font:700 15px/20px 'Roboto';letter-spacing:0.1px;color:${o === on ? v('onSecondaryContainer') : v('onSurface')}">${esc(o)}</div>`).join('')}</div>`;
  const head = (t) => `<div style="font:500 11px/16px 'Roboto';letter-spacing:0.8px;color:${v('onSurfaceVariant')};padding:8px 0 4px">${esc(t)}</div>`;
  const row = (title, right, description) => `<div style="display:flex;justify-content:space-between;align-items:center;min-height:52px;gap:12px">
      <div><div style="font:400 16px/24px 'Roboto'">${esc(title)}</div>${description ? `<div style="font:400 12px/16px 'Roboto';letter-spacing:0.4px;color:${v('onSurfaceVariant')}">${esc(description)}</div>` : ''}</div>
      <div style="display:flex;align-items:center;gap:10px;color:${v('onSurfaceVariant')};font:400 14px/20px 'Roboto';letter-spacing:0.25px">${right ? esc(right) : ''}${icon('chevron-right', 20, v('onSurfaceVariant'))}</div>
    </div>`;
  return `<div class="me" style="background:${v('background')};color:${v('onSurface')}">
      <div style="display:flex;align-items:center;justify-content:space-between;height:56px"><div style="font:700 22px/28px 'Roboto'">Profile</div>${icon('help-circle-outline', 24, v('onSurface'))}</div>
      ${row('Settings', 'Points · −10 · −30 · −80')}
      <div style="height:16px"></div>
      ${head('APPEARANCE')}
      ${segmented(['Phone', 'Light', 'Dark'], theme.dark ? 'Dark' : 'Light')}
      <div style="display:flex;align-items:center;gap:10px;margin:14px 0 6px"><span style="font:400 16px/24px 'Roboto'">Theme</span><span style="font:700 10.5px/16px 'Roboto';letter-spacing:0.6px;color:${v('onLeaderContainer')};background:${v('leaderContainer')};padding:1px 8px;border-radius:999px">NEW ROW</span></div>
      ${segmented(families, picked)}
      <div style="height:16px"></div>
      ${head('HELP')}
      ${row('Help & guide', '', 'How each screen works, tricky cases, scoring rules')}
    </div>`;
}

export function switchSheet({ fontPath, gold, clubhouse }) {
  const dots = (t) => `<div class="dots">${['background', 'surface', 'primary', 'secondaryContainer', 'primaryContainer', 'loss'].map((k) => `<i style="background:${valueOf(t, k)}"></i>`).join('')}</div>`;
  const cell = (t, name, sub) => `<div class="cell" style="background:${t.colors.background};color:${t.colors.onSurface}"><b>${esc(name)}</b><span>${esc(sub)}</span>${dots(t)}</div>`;
  const width = 360 + 36 + 560 + 56;
  return {
    width,
    html: page(fontPath, `<div class="sheet" style="${NEUTRAL};width:${width}px">
      <h1>How the switch works</h1>
      <p class="sub">Two choices, both under Profile › Appearance. The first is there today. The second is one new row. Together they pick one set of colours, and every screen reads its colours from that set.</p>
      <div class="switch">
        <div style="width:360px">
          <p class="cap">Profile › Appearance</p>
          <p class="note">Today's row stays. “Theme” is the new one, drawn with the same control. Shown with Light picked, then with Dark picked.</p>
          ${meCard(gold.light, ['Gold', 'Clubhouse'], 'Gold')}
          ${meCard(gold.dark, ['Gold', 'Clubhouse'], 'Gold')}
        </div>
        <div style="width:560px">
          <p class="cap">What the two rows pick</p>
          <p class="note">A theme is a pair: a light set and a dark set. “Phone” follows the phone's own setting.</p>
          <div class="grid2">
            <div></div><div class="h">Light</div><div class="h">Dark</div>
            <div class="h r">Gold<br>(new)</div>${cell(gold.light, gold.light.name, 'cream, peacock teal, gold')}${cell(gold.dark, gold.dark.name, 'near-black brown, gold, emerald')}
            <div class="h r">Clubhouse<br>(today)</div>${cell(clubhouse.light, 'Felt & Brass', 'today\'s light, unchanged')}${cell(clubhouse.dark, 'Green-black', 'today\'s dark, unchanged')}
          </div>
          <div class="flow">
            <div class="box"><b>Theme + Appearance</b>kept on the phone, the way Appearance is kept today</div><div class="arrow">→</div>
            <div class="box"><b>one set of tokens</b>about 80 named colours and 20 seats</div><div class="arrow">→</div>
            <div class="box"><b>every screen</b>no screen names a colour itself</div>
          </div>
        </div>
      </div>
      <p class="foot">A third theme later is one more pair in the same list and one more word in the Theme row (the control holds up to four). Nothing is deleted to add it, and nothing rotates on its own.</p>
    </div>`, SWITCH_CSS),
  };
}

// ─────────────────────────────────────────────────────────────── calibration

export function calibrationSheet({ fontPath, pairs }) {
  const width = 270;
  const cols = pairs.map((p) => `<div style="display:flex;gap:10px">
      <div style="width:${width}px"><p class="cap">${esc(p.title)}</p><p class="note" style="min-height:34px">CI frame, as the phone drew it</p>${framed({ width, device: p.device, img: p.img })}</div>
      <div style="width:${width}px"><p class="cap">&nbsp;</p><p class="note" style="min-height:34px">Our drawing, in today's colours: ${p.near.toFixed(1)}% of pixels the same within 1 dp</p>${framed({ width, device: p.device, img: p.drawn })}</div>
    </div>`).join('');
  const total = pairs.length * (2 * width + 10) + (pairs.length - 1) * 28 + 56;
  return {
    width: total,
    html: page(fontPath, `<div class="sheet" style="${NEUTRAL};width:${total}px">
      <h1>Is the drawing really today's layout? Measured.</h1>
      <p class="sub">The new themes are drawn, not built. To show the drawing can be trusted, the same drawing is first made in today's colours and laid over the real frame from CI. What differs is the system clock, a letter at the end of a cut label, and how Android and Chrome smooth the edges of letters.</p>
      <div style="display:flex;gap:28px;align-items:flex-start">${cols}</div>
    </div>`),
  };
}
