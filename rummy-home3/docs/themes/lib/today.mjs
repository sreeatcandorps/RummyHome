// Reads today's tokens straight out of constants/theme.ts, so the sheets and the "every token is
// mapped" check follow the app, not a copy of it. (theme.ts imports react-native-paper, which Node
// cannot load, hence the text read.)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = join(HERE, '..', '..', '..');
const SOURCE = readFileSync(join(APP_ROOT, 'constants', 'theme.ts'), 'utf8');

function block(name, open = '{', close = '}') {
  const start = SOURCE.search(new RegExp(`(const|export const) ${name}\\b[^=]*= \\${open}`));
  if (start < 0) throw new Error(`theme.ts: ${name} not found`);
  const from = SOURCE.indexOf(open, SOURCE.indexOf('=', start));
  let depth = 0;
  for (let i = from; i < SOURCE.length; i++) {
    if (SOURCE[i] === open) depth++;
    else if (SOURCE[i] === close && --depth === 0) return SOURCE.slice(from + 1, i);
  }
  throw new Error(`theme.ts: ${name} is not closed`);
}

const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function objectOf(text, refs = {}) {
  const out = {};
  const body = strip(text);
  const re = /(\w+):\s*(\{[^}]*\}|'[^']*'|[\w.]+(?: as string)?)\s*,/g;
  let m;
  while ((m = re.exec(body))) {
    const [, key, raw] = m;
    if (raw.startsWith('{')) out[key] = objectOf(raw.slice(1, -1) + ',', refs);
    else if (raw.startsWith("'")) out[key] = raw.slice(1, -1);
    else {
      const ref = raw.replace(' as string', '');
      if (!(ref in refs)) throw new Error(`theme.ts: cannot resolve ${ref}`);
      out[key] = refs[ref];
    }
  }
  return out;
}

const listOf = (name) => [...strip(block(name, '[', ']')).matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);

const brand = objectOf(block('brand'));
const refs = Object.fromEntries(Object.entries(brand).map(([k, v]) => [`brand.${k}`, v]));
// Paper's Material 3 defaults for the two roles theme.ts does not override.
const MD3 = { shadow: '#000000', scrim: '#000000' };

const seats = listOf('SEAT_COLORS');
const seatsOnDark = listOf('SEAT_COLORS_ON_DARK');

/** Today's look (D65 Felt & Brass, D71 green-black dark), in the same shape as palettes.mjs. */
export const today = {
  light: {
    id: 'clubhouse-light',
    name: 'Today · light',
    dark: false,
    colors: { ...MD3, ...objectOf(block('lightColors'), refs) },
    gameTypes: objectOf(block('lightGameTypes')),
    brand,
    // Today: ten seat colours that repeat from seat 11; white initials on every avatar.
    seats: seats.map((fill) => ({ fill, on: '#FFFFFF', text: fill })),
  },
  dark: {
    id: 'clubhouse-dark',
    name: 'Today · dark',
    dark: true,
    colors: { ...MD3, ...objectOf(block('darkColors'), refs) },
    gameTypes: objectOf(block('darkGameTypes')),
    brand,
    // On dark the header lettering and the tab-bar avatar use the lighter set; the avatar's initials stay white.
    seats: seatsOnDark.map((fill) => ({ fill, on: '#FFFFFF', text: fill })),
  },
};

/** Every colour key a theme must define, flattened ("elevation.level1", "gameTypes.pool.on", ...). */
export function tokenKeys(theme) {
  const keys = [];
  const walk = (prefix, obj) => Object.entries(obj).forEach(([k, v]) => (typeof v === 'object' ? walk(`${prefix}${k}.`, v) : keys.push(`${prefix}${k}`)));
  walk('', theme.colors);
  walk('gameTypes.', theme.gameTypes);
  walk('brand.', theme.brand);
  return keys;
}

/** The value of a flattened key ("surface", "elevation.level3", "gameTypes.pool.on", "brand.gold"). */
export function valueOf(theme, key) {
  const [head, ...rest] = key.split('.');
  const root = head === 'gameTypes' ? theme.gameTypes : head === 'brand' ? theme.brand : theme.colors;
  const path = head === 'gameTypes' || head === 'brand' ? rest : [head, ...rest];
  return path.reduce((o, k) => o?.[k], root);
}
