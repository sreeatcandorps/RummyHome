// The palette spec: two new token sets, one value for EVERY colour token constants/theme.ts has
// today (Material 3 roles + the app's own), plus 20 seat colours each. Palettes only: nothing here
// is sampled into a picture, a crop or a motif from the reference posters.
//
//   haveli  LIGHT  from the truck painting   cream paper, peacock-teal buttons, gold pills, rust-red minus
//   mehfil  DARK   from the Pushpa pictures  near-black brown, gold buttons, emerald / ruby / saffron jewels
//
// `node docs/themes/build.mjs --check` fails if a token theme.ts has is missing here, or a pair of
// colours that carries text falls under its contrast floor.

const haveliColors = {
  shadow: '#000000',
  scrim: '#000000',
  // Buttons, links, the lit tab: peacock teal. Gold cannot be a 4.5 : 1 label on cream, so in light it is the accent.
  primary: '#0B5E5B',
  onPrimary: '#FFFFFF',
  primaryContainer: '#CFE9E1',
  onPrimaryContainer: '#063F3D',
  // Games and selections (D11): gold.
  secondary: '#825B00',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F2CE74',
  onSecondaryContainer: '#3A2800',
  // One notice per screen, Completed, Admin: indigo.
  tertiary: '#3949A6',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#DFE3FA',
  onTertiaryContainer: '#18225E',
  error: '#A8321A',
  onError: '#FFFFFF',
  errorContainer: '#FBDDD0',
  onErrorContainer: '#571605',
  background: '#F6EEDD',
  onBackground: '#231A12',
  surface: '#FFFCF5',
  onSurface: '#231A12',
  surfaceVariant: '#EDE2CC',
  onSurfaceVariant: '#5C4D3D',
  surfaceDisabled: 'rgba(35, 26, 18, 0.12)',
  onSurfaceDisabled: 'rgba(35, 26, 18, 0.38)',
  outline: '#8E7D67',
  outlineVariant: '#E3D6BC',
  // The toast: espresso with a gold action.
  inverseSurface: '#33271B',
  inverseOnSurface: '#F8EFDD',
  inversePrimary: '#F0C55B',
  backdrop: 'rgba(35, 26, 18, 0.45)',
  elevation: {
    level0: 'transparent',
    level1: '#FBF6EA',
    level2: '#F8F1E2',
    level3: '#F4ECDA',
    level4: '#F2E9D5',
    level5: '#EFE5CF',
  },
  surfaceSunken: '#EDE2CC',
  primaryEdge: '#063F3D',
  secondaryEdge: '#CDA035',
  positive: '#231A12',
  positiveContainer: '#CDEEDD',
  onPositiveContainer: '#231A12',
  win: '#0A6B4E',
  winContainer: '#CDEEDD',
  onWinContainer: '#231A12',
  // The truck's rust, deepened until it reads as the red of a minus.
  negative: '#A8321A',
  loss: '#A8321A',
  lossContainer: '#FBDDD0',
  onLossContainer: '#571605',
  // Crown, Creator, the leading row: saffron.
  leader: '#A14E00',
  leaderContainer: '#FCE2BE',
  onLeaderContainer: '#4A2500',
  focus: '#3949A6',
  // The Sign-in band: the truck's rust-brown body.
  felt: '#6E2C12',
  onFelt: '#FFFFFF',
  onFeltMuted: 'rgba(255, 255, 255, 0.78)',
  cellNeutral: '#F5EEDF',
  tableHeader: '#F3EAD8',
  band: '#F4ECDB',
  bandAlt: '#ECE2CC',
  bandHead: '#D6ECE5',
  bandHeadAlt: '#C8E5DB',
  tableStripe: '#FBF6EA',
  tableLatest: '#E2F3EA',
  hairline: '#E3D6BC',
  reentry: '#3949A6',
  reentryContainer: '#DFE3FA',
};

const mehfilColors = {
  shadow: '#000000',
  scrim: '#000000',
  // Buttons, links, the lit tab: gold, with near-black brown lettering.
  primary: '#E7B549',
  onPrimary: '#2B1A00',
  // Live, results, the dealer's column: emerald.
  primaryContainer: '#123F2E',
  onPrimaryContainer: '#C2ECD6',
  secondary: '#EBC870',
  onSecondary: '#3A2800',
  secondaryContainer: '#4A3611',
  onSecondaryContainer: '#F7E2A8',
  tertiary: '#B4BEFF',
  onTertiary: '#141C5C',
  tertiaryContainer: '#2B3068',
  onTertiaryContainer: '#E0E3FF',
  error: '#FF9A93',
  onError: '#4A0A12',
  errorContainer: '#7A1622',
  onErrorContainer: '#FFDADB',
  background: '#140D09',
  onBackground: '#F4E9D4',
  surface: '#20160F',
  onSurface: '#F4E9D4',
  surfaceVariant: '#2E2118',
  onSurfaceVariant: '#C9B79C',
  surfaceDisabled: 'rgba(244, 233, 212, 0.12)',
  onSurfaceDisabled: 'rgba(244, 233, 212, 0.38)',
  outline: '#93806A',
  outlineVariant: '#3A2C20',
  inverseSurface: '#F4E9D4',
  inverseOnSurface: '#33271B',
  inversePrimary: '#0B5E5B',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  elevation: {
    level0: 'transparent',
    level1: '#251A12',
    level2: '#2A1E15',
    level3: '#2F2218',
    level4: '#32251A',
    level5: '#36281D',
  },
  surfaceSunken: '#1A110B',
  primaryEdge: '#A97C1C',
  secondaryEdge: '#33250A',
  positive: '#F4E9D4',
  positiveContainer: '#124A33',
  onPositiveContainer: '#F4E9D4',
  win: '#6EDDA9',
  winContainer: '#124A33',
  onWinContainer: '#F4E9D4',
  // Ruby, lifted until it reads on brown.
  negative: '#FF9A93',
  loss: '#FF9A93',
  lossContainer: '#7A1622',
  onLossContainer: '#FFDADB',
  leader: '#FFB65C',
  leaderContainer: '#55330B',
  onLeaderContainer: '#FFDFB5',
  focus: '#B4BEFF',
  // The Sign-in band: the maroon of the third picture.
  felt: '#4A0E11',
  onFelt: '#F4E9D4',
  onFeltMuted: 'rgba(244, 233, 212, 0.78)',
  cellNeutral: '#261B13',
  tableHeader: '#2A1E15',
  band: '#241910',
  bandAlt: '#2D2117',
  bandHead: '#143A2B',
  bandHeadAlt: '#1A4A36',
  tableStripe: '#251A12',
  tableLatest: '#17352A',
  hairline: '#3A2C20',
  reentry: '#B4BEFF',
  reentryContainer: '#2B3068',
};

const gold = (colors) => ({ container: colors.secondaryContainer, on: colors.onSecondaryContainer, accent: colors.secondary });

/**
 * Seat colours: `fill` is the avatar, `on` its initials, `text` the same seat as lettering on the
 * scorecard header. Twenty, so a 20-player table never repeats a colour (today: ten, repeating).
 * The first ten are the jewel set most tables use; 11 to 20 are ordered so neighbours stay far apart.
 * No seat sits near the button colour, the re-entry indigo or the minus red.
 */
const seats = (on, fills) => fills.map((fill) => ({ fill, on, text: fill }));

const haveliSeats = seats('#FFFFFF', [
  '#A5195D', // 1  rani pink
  '#1468A3', // 2  peacock blue
  '#895618', // 3  kesar brown
  '#6D3093', // 4  jamun purple
  '#2F6F0F', // 5  mehndi green
  '#5A3A1F', // 6  teak
  '#386B7B', // 7  slate teal
  '#7B242E', // 8  maroon
  '#4F3DE6', // 9  neel violet
  '#5F6932', // 10 olive
  '#5B004B', '#5B1A03', '#5B4F80', '#384833', '#422A36', '#574603', '#675061', '#0002A0', '#7C5149', '#023869',
]);

const mehfilSeats = seats('#1B120B', [
  '#F983C3', // 1  rose
  '#82C6F9', // 2  sky
  '#F99532', // 3  kesar
  '#CE9FFE', // 4  lilac
  '#A8DF68', // 5  leaf
  '#D4AF90', // 6  sand
  '#6ED9D2', // 7  turquoise
  '#F7E785', // 8  lemon
  '#9DA1CA', // 9  periwinkle
  '#A9F2C0', // 10 mint
  '#78C5D7', '#5EB567', '#E0D0A5', '#8CAABA', '#B6B857', '#CAEEE3', '#D3B4C1', '#BEC9AD', '#E2E1FF', '#8EAD9F',
]);

export const haveli = {
  id: 'haveli',
  name: 'Haveli',
  altName: 'Peacock & Gold',
  dark: false,
  from: 'the truck painting',
  colors: haveliColors,
  gameTypes: { stake: gold(haveliColors), pool: gold(haveliColors) },
  brand: { felt: haveliColors.felt, feltLight: haveliColors.primary, cream: haveliColors.background, gold: haveliColors.secondaryContainer },
  seats: haveliSeats,
};

export const mehfil = {
  id: 'mehfil',
  name: 'Mehfil',
  altName: 'Midnight Gold',
  dark: true,
  from: 'the three Pushpa pictures',
  colors: mehfilColors,
  gameTypes: { stake: gold(mehfilColors), pool: gold(mehfilColors) },
  brand: { felt: mehfilColors.felt, feltLight: mehfilColors.primaryContainer, cream: mehfilColors.onBackground, gold: mehfilColors.primary },
  seats: mehfilSeats,
};

/** The registry the app would carry: a theme is a light set and a dark set; Appearance picks which. */
export const NEW_THEME = { id: 'gold', label: 'Gold', light: haveli, dark: mehfil };
