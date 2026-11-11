// WCAG 2.x contrast helper + token tables for the EZ Score design proposal.
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = (h) => { const [r, g, b] = hex2rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const cr = (a, b) => { const x = L(a), y = L(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };
const fmt = (r) => r.toFixed(2) + ':1';
const grade = (r, large = false) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? (large ? 'AA (large)' : 'fail*') : 'fail');

const current = {
  light: { bg: '#F6F2E9', surface: '#FFFDF8', onSurface: '#1B1F1C', onSurfaceVariant: '#4A524D', primary: '#1F5C46', onPrimary: '#FFFFFF', primaryContainer: '#CDEBD9', onPrimaryContainer: '#002113', secondaryContainer: '#FFE2A0', onSecondaryContainer: '#2B1E00', tertiaryContainer: '#C6E8F4', onTertiaryContainer: '#001F28', error: '#B3261E', errorContainer: '#F9DEDC', onErrorContainer: '#410E0B', positive: '#1E7A4C', positiveContainer: '#D5F0E0', onPositiveContainer: '#00391F', negative: '#B3261E', leader: '#8A6100', leaderContainer: '#FFE7AE', onLeaderContainer: '#2B1E00', outline: '#79807B', outlineVariant: '#DCD5C7', surfaceVariant: '#ECE6D9', felt: '#17402F', onFelt: '#FBF1E1', stakeC: '#DCE8F7', stakeOn: '#0D2F55', poolC: '#FBE6C8', poolOn: '#4A2D00', tableHeader: '#EFE9DC', tableLatest: '#EAF5EE', cellNeutral: '#F3EEE3' },
  dark: { bg: '#0E1512', surface: '#151D19', onSurface: '#E2E6E2', onSurfaceVariant: '#BEC8C1', primary: '#8FD5B0', onPrimary: '#00391F', primaryContainer: '#1D4E3A', onPrimaryContainer: '#CDEBD9', secondaryContainer: '#5C4300', onSecondaryContainer: '#FFE2A0', tertiaryContainer: '#214C59', onTertiaryContainer: '#C6E8F4', error: '#F2B8B5', errorContainer: '#8C1D18', onErrorContainer: '#F9DEDC', positive: '#7FD8A6', positiveContainer: '#164430', onPositiveContainer: '#C8F2D9', negative: '#F2A29C', leader: '#F2C45A', leaderContainer: '#4D3900', onLeaderContainer: '#FFE7AE', outline: '#89938C', outlineVariant: '#34403A', surfaceVariant: '#26302B', felt: '#123326', onFelt: '#FBF1E1', stakeC: '#1E3550', stakeOn: '#CFE2FA', poolC: '#4A3410', poolOn: '#FBE3BF', tableHeader: '#1F2924', tableLatest: '#1A3327', cellNeutral: '#1B2420' },
};

const seatsCurrent = ['#2E7D5B', '#C2410C', '#2563EB', '#B4237A', '#7C3AED', '#0E7490', '#A16207', '#BE123C', '#4D7C0F', '#475569'];

// ---- Proposed: Direction A "Clubhouse" (recommended) ----
const A = {
  light: {
    bg: '#F6F6F1', surface: '#FFFFFF', surfaceSunken: '#EEEEE7', surfaceVariant: '#EEEEE7',
    onSurface: '#17201B', onSurfaceVariant: '#4E5752', outline: '#8A918C', outlineVariant: '#DCDDD5', hairline: '#E8E8E1',
    primary: '#15803D', onPrimary: '#FFFFFF', primaryHover: '#126B33', primaryEdge: '#0E5A2A',
    primaryContainer: '#D6F5DF', onPrimaryContainer: '#0B3B1F',
    secondary: '#8A5A00', onSecondary: '#FFFFFF', secondaryContainer: '#FFE38A', onSecondaryContainer: '#3F2D00', secondaryEdge: '#E0B33A',
    tertiary: '#2B5FBF', onTertiary: '#FFFFFF', tertiaryContainer: '#DCE8FF', onTertiaryContainer: '#0F2B63',
    error: '#B4231B', onError: '#FFFFFF', errorContainer: '#FFE1DD', onErrorContainer: '#5C0F0A',
    win: '#0C6331', winContainer: '#D6F5DF', onWinContainer: '#0B3B1F',
    loss: '#A8201A', lossContainer: '#FFE1DD', onLossContainer: '#5C0F0A',
    leader: '#9A6700', leaderContainer: '#FFF0BF', onLeaderContainer: '#3F2D00',
    felt: '#15803D', onFelt: '#FFFFFF',
    stakeC: '#DCE8FF', stakeOn: '#0F2B63', poolC: '#FFE38A', poolOn: '#3F2D00',
    tableHeader: '#F1F1EA', tableLatest: '#EAF7EE', cellNeutral: '#F3F3ED',
    focus: '#2B5FBF',
  },
  dark: {
    bg: '#0F1412', surface: '#181E1B', surfaceSunken: '#11161. '.slice(0, 7) === '#11161.' ? '#11161'.padEnd(7, '4') : '#111614', surfaceVariant: '#242B27',
    onSurface: '#EAEDE9', onSurfaceVariant: '#BAC2BC', outline: '#8A938D', outlineVariant: '#343C38', hairline: '#2A312D',
    primary: '#5FD68E', onPrimary: '#04301A', primaryHover: '#4CC67C', primaryEdge: '#2E9E5C',
    primaryContainer: '#1A4A2E', onPrimaryContainer: '#CFF4DB',
    secondary: '#FFD45E', onSecondary: '#3F2D00', secondaryContainer: '#5C4300', onSecondaryContainer: '#FFE8AE', secondaryEdge: '#3F2D00',
    tertiary: '#9DBCFF', onTertiary: '#0A2459', tertiaryContainer: '#22406E', onTertiaryContainer: '#DCE8FF',
    error: '#FF978E', onError: '#4A0B07', errorContainer: '#7A1F1A', onErrorContainer: '#FFDAD6',
    win: '#73DF9D', winContainer: '#1A4A2E', onWinContainer: '#CFF4DB',
    loss: '#FFA19A', lossContainer: '#7A1F1A', onLossContainer: '#FFDAD6',
    leader: '#FFD45E', leaderContainer: '#4D3900', onLeaderContainer: '#FFE8AE',
    felt: '#123B25', onFelt: '#EAEDE9',
    stakeC: '#22406E', stakeOn: '#DCE8FF', poolC: '#5C4300', poolOn: '#FFE8AE',
    tableHeader: '#1F2622', tableLatest: '#1B3326', cellNeutral: '#1C2320',
    focus: '#9DBCFF',
  },
};
A.dark.surfaceSunken = '#111614';

// ---- Direction B "Indigo & Marigold" ----
const B = {
  light: { ...A.light, bg: '#F6F6FA', primary: '#4338CA', primaryHover: '#3730A3', primaryEdge: '#312E81', primaryContainer: '#E0E0FF', onPrimaryContainer: '#1E1B5C', felt: '#4338CA', tertiary: '#0E7490', tertiaryContainer: '#CFF4FA', onTertiaryContainer: '#0A3A45', stakeC: '#E0E0FF', stakeOn: '#1E1B5C', focus: '#4338CA' },
  dark: { ...A.dark, bg: '#0F0F16', surface: '#181824', surfaceVariant: '#24243A', primary: '#A5B4FC', onPrimary: '#1E1B5C', primaryHover: '#8E9DFB', primaryEdge: '#6366F1', primaryContainer: '#312E81', onPrimaryContainer: '#E0E0FF', felt: '#1E1B5C', tertiary: '#67E8F9', tertiaryContainer: '#164E63', onTertiaryContainer: '#CFF4FA', stakeC: '#312E81', stakeOn: '#E0E0FF', focus: '#A5B4FC' },
};

// ---- Direction C "Teal & Coral" ----
const C = {
  light: { ...A.light, bg: '#F3F8F7', primary: '#0F766E', primaryHover: '#0D6560', primaryEdge: '#0A5450', primaryContainer: '#CCF1EC', onPrimaryContainer: '#073B37', felt: '#0F766E', secondary: '#B23A2B', secondaryContainer: '#FFD9D0', onSecondaryContainer: '#4A1309', secondaryEdge: '#F2A08F', leader: '#9A6700', stakeC: '#CCF1EC', stakeOn: '#073B37', poolC: '#FFD9D0', poolOn: '#4A1309', focus: '#0F766E' },
  dark: { ...A.dark, bg: '#0E1515', surface: '#171F1F', surfaceVariant: '#232D2D', primary: '#5EEAD4', onPrimary: '#03302C', primaryHover: '#45D9C2', primaryEdge: '#14B8A6', primaryContainer: '#134E4A', onPrimaryContainer: '#CCF1EC', felt: '#0F3D39', secondary: '#FFB4A5', secondaryContainer: '#6B2415', onSecondaryContainer: '#FFD9D0', stakeC: '#134E4A', stakeOn: '#CCF1EC', poolC: '#6B2415', poolOn: '#FFD9D0', focus: '#5EEAD4' },
};

const seatsProposed = ['#15803D', '#C2410C', '#1D4ED8', '#A21CAF', '#6D28D9', '#0E7490', '#92400E', '#BE123C', '#3F6212', '#475569'];
const seatsProposedDark = ['#4ADE80', '#FB923C', '#7DB4FF', '#F0ABFC', '#C4B5FD', '#22D3EE', '#FBBF24', '#FDA4AF', '#BEF264', '#CBD5E1'];

const pairsFor = (t) => [
  ['Body text', 'onSurface', 'surface', false],
  ['Body text on background', 'onSurface', 'bg', false],
  ['Secondary text', 'onSurfaceVariant', 'surface', false],
  ['Primary button label', 'onPrimary', 'primary', false],
  ['Primary as text/icon on surface', 'primary', 'surface', false],
  ['Tonal (primaryContainer) label', 'onPrimaryContainer', 'primaryContainer', false],
  ['Marigold chip / button label', 'onSecondaryContainer', 'secondaryContainer', false],
  ['Info / Pool chip label', 'onTertiaryContainer', 'tertiaryContainer', false],
  ['Danger chip label', 'onErrorContainer', 'errorContainer', false],
  ['Error / loss text on surface', 'error', 'surface', false],
  ['Win score on surface', 'win', 'surface', false],
  ['Loss score on surface', 'loss', 'surface', false],
  ['Win score in win pill', 'onWinContainer', 'winContainer', false],
  ['Loss score in loss pill', 'onLossContainer', 'lossContainer', false],
  ['Leader chip label', 'onLeaderContainer', 'leaderContainer', false],
  ['Outline (border) vs surface', 'outline', 'surface', true],
  ['OutlineVariant (card border) vs surface', 'outlineVariant', 'surface', true],
  ['Points chip label', 'stakeOn', 'stakeC', false],
  ['Pool chip label', 'poolOn', 'poolC', false],
  ['Brand band text', 'onFelt', 'felt', false],
];

const pairsCurrent = (t) => [
  ['Body text', 'onSurface', 'surface', false],
  ['Secondary text', 'onSurfaceVariant', 'surface', false],
  ['Primary button label', 'onPrimary', 'primary', false],
  ['Primary as text/icon on surface', 'primary', 'surface', false],
  ['Tonal (primaryContainer) label', 'onPrimaryContainer', 'primaryContainer', false],
  ['Yellow chip / Results button label', 'onSecondaryContainer', 'secondaryContainer', false],
  ['Info chip label', 'onTertiaryContainer', 'tertiaryContainer', false],
  ['Danger chip label', 'onErrorContainer', 'errorContainer', false],
  ['Win score on surface', 'positive', 'surface', false],
  ['Loss score on surface', 'negative', 'surface', false],
  ['Win score in green pill', 'onPositiveContainer', 'positiveContainer', false],
  ['Loss score in red pill', 'negative', 'errorContainer', false],
  ['Leader chip label', 'onLeaderContainer', 'leaderContainer', false],
  ['Outline (border) vs surface', 'outline', 'surface', true],
  ['OutlineVariant (card border) vs surface', 'outlineVariant', 'surface', true],
  ['Points chip label', 'stakeOn', 'stakeC', false],
  ['Pool chip label', 'poolOn', 'poolC', false],
  ['Brand band text', 'onFelt', 'felt', false],
];

function table(theme, pairs) {
  const rows = pairs.map(([what, fgKey, bgKey, large]) => {
    const r = cr(theme[fgKey], theme[bgKey]);
    return `| ${what} | \`${theme[fgKey]}\` on \`${theme[bgKey]}\` | ${fmt(r)} | ${grade(r, large)} |`;
  });
  return ['| Use | Pair | Ratio | WCAG |', '|---|---|---|---|', ...rows].join('\n');
}

function seatTable(list, surfaceLight, surfaceDark) {
  const rows = list.map((c, i) => `| ${i + 1} | \`${c}\` | ${fmt(cr('#FFFFFF', c))} ${grade(cr('#FFFFFF', c))} | ${fmt(cr(c, surfaceLight))} ${grade(cr(c, surfaceLight))} | ${fmt(cr(c, surfaceDark))} ${grade(cr(c, surfaceDark), true)} |`);
  return ['| Seat | Hex | White initials on it | As text on light surface | As text on dark surface |', '|---|---|---|---|---|', ...rows].join('\n');
}

if (require.main === module) {
  const which = process.argv[2] || 'all';
  const out = [];
  if (which === 'all' || which === 'current') {
    out.push('### Current light\n', table(current.light, pairsCurrent(current.light)), '\n### Current dark\n', table(current.dark, pairsCurrent(current.dark)));
    out.push('\n### Current seat colours\n', seatTable(seatsCurrent, '#FFFDF8', '#151D19'));
  }
  for (const [name, t] of [['A', A], ['B', B], ['C', C]]) {
    if (which === 'all' || which === name) {
      out.push(`\n### Direction ${name} light\n`, table(t.light, pairsFor(t.light)), `\n### Direction ${name} dark\n`, table(t.dark, pairsFor(t.dark)));
    }
  }
  if (which === 'all' || which === 'seats') { out.push('\n### Proposed seat colours (light mode / avatar fills)\n', seatTable(seatsProposed, '#FFFFFF', '#181E1B')); out.push('\n### Proposed seat colours, dark-mode text variants\n', ['| Seat | Hex | As text on dark surface `#181E1B` | Dark initials `#04301A` on it |','|---|---|---|---|', ...seatsProposedDark.map((c,i)=>`| ${i+1} | \`${c}\` | ${fmt(cr(c,'#181E1B'))} ${grade(cr(c,'#181E1B'))} | ${fmt(cr('#04301A',c))} ${grade(cr('#04301A',c))} |`)].join('\n')); }
  console.log(out.join('\n'));
}

module.exports = { A, B, C, current, seatsCurrent, seatsProposed, seatsProposedDark, cr, fmt, grade };
