import { MD3DarkTheme, MD3LightTheme, configureFonts, useTheme } from 'react-native-paper';

/** 4dp baseline grid from Material Design layout guidance. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** Material accessibility minimum for interactive elements. */
export const MIN_TOUCH_TARGET = 48;

/** Content stops growing past this width so landscape and tablets stay readable. */
export const MAX_CONTENT_WIDTH = 760;

/**
 * Felt & Brass palette (D65, Sree Nov 23: "Palette B"; docs/design-review-2.md §9). A deeper felt
 * green than the Clubhouse set (text on it 8.9 : 1 instead of 4.6 : 1), brass where the lemon
 * yellow was, warmer paper and hairlines. `felt` is the auth band; `cream` is kept for the share
 * sheets, which print on card stock; `gold` is the brass accent. Seat colours and red are untouched.
 */
export const brand = {
  felt: '#0B3B1F',
  feltLight: '#0E4D2A',
  cream: '#F6F6F1',
  gold: '#F0DFAE',
} as const;

/** Tabular digits keep score columns aligned. */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

type GameTint = { container: string; on: string; accent: string };

/**
 * PR 13 (D11): every game, Points or Pool, is yellow — the game number badge, the list tint and
 * the column heads in a result. Green is for results only. Blue is kept for a re-entered pool player.
 */
const lightGameTypes: Record<'stake' | 'pool', GameTint> = {
  stake: { container: '#F0DFAE', on: '#3E2E07', accent: '#8A6A1E' },
  pool: { container: '#F0DFAE', on: '#3E2E07', accent: '#8A6A1E' },
};

const darkGameTypes: Record<'stake' | 'pool', GameTint> = {
  stake: { container: '#4A3A10', on: '#F5E3B0', accent: '#E3BE63' },
  pool: { container: '#4A3A10', on: '#F5E3B0', accent: '#E3BE63' },
};

/** Light tints kept for callers that do not have a theme handy. */
export const gameTypeColors = lightGameTypes;

/**
 * Seat colours distinguish players across the scoreboard, standings and score
 * entry. Ordered so neighbouring seats contrast; cycles past ten players.
 * Seat 1 is teal, never the button green: an avatar must not look tappable.
 */
const SEAT_COLORS = [
  '#0F766E',
  '#C2410C',
  '#1D4ED8',
  '#A21CAF',
  '#6D28D9',
  '#0E7490',
  '#92400E',
  '#BE123C',
  '#3F6212',
  '#475569',
];

/** The same seats as text on a dark surface (column labels, legends). */
const SEAT_COLORS_ON_DARK = [
  '#2DD4BF',
  '#FB923C',
  '#7DB4FF',
  '#F0ABFC',
  '#C4B5FD',
  '#22D3EE',
  '#FBBF24',
  '#FDA4AF',
  '#BEF264',
  '#CBD5E1',
];

const seatIndex = (index: number) => ((index % SEAT_COLORS.length) + SEAT_COLORS.length) % SEAT_COLORS.length;

/** Avatar fill (both modes) or, with `onDark`, the readable text variant for dark surfaces. */
export const seatColor = (index: number, options?: { onDark?: boolean }) =>
  (options?.onDark ? SEAT_COLORS_ON_DARK : SEAT_COLORS)[seatIndex(index)];

const lightColors = {
  ...MD3LightTheme.colors,
  primary: '#0E4D2A',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D8ECDD',
  onPrimaryContainer: '#0B3B1F',
  secondary: '#8A6A1E',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F0DFAE',
  onSecondaryContainer: '#3E2E07',
  tertiary: '#2B5FBF',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#DCE8FF',
  onTertiaryContainer: '#0F2B63',
  error: '#B4231B',
  onError: '#FFFFFF',
  errorContainer: '#FFE1DD',
  onErrorContainer: '#5C0F0A',
  background: '#F5F2E8',
  onBackground: '#1A1F1B',
  surface: '#FFFFFF',
  onSurface: '#1A1F1B',
  surfaceVariant: '#ECE7DA',
  onSurfaceVariant: '#5A615B',
  surfaceDisabled: 'rgba(23, 32, 27, 0.12)',
  onSurfaceDisabled: 'rgba(23, 32, 27, 0.38)',
  outline: '#8E928A',
  outlineVariant: '#E6E1D3',
  inverseSurface: '#2C332F',
  inverseOnSurface: '#F1F2EE',
  inversePrimary: '#7FD39F',
  backdrop: 'rgba(23, 32, 27, 0.45)',
  elevation: {
    level0: 'transparent',
    level1: '#FAF8F2',
    level2: '#F5F2E8',
    level3: '#F0ECE0',
    level4: '#EEE9DC',
    level5: '#EAE5D6',
  },
  // App-specific roles.
  /** Search field, keypad well, empty cells, skeletons. */
  surfaceSunken: '#ECE7DA',
  /** 4 px bottom edge of a filled green button; the Results button has its own. */
  primaryEdge: '#083820',
  secondaryEdge: '#CDB56F',
  /** Positive scores are near-black; the tint sits behind a winning cell. */
  positive: '#17201B',
  positiveContainer: '#D6F5DF',
  onPositiveContainer: '#17201B',
  win: '#0C6331',
  winContainer: '#D6F5DF',
  onWinContainer: '#17201B',
  negative: '#A8201A',
  loss: '#A8201A',
  lossContainer: '#FFE1DD',
  onLossContainer: '#5C0F0A',
  leader: '#9A6700',
  leaderContainer: '#FFF0BF',
  onLeaderContainer: '#3F2D00',
  focus: '#2B5FBF',
  felt: brand.felt as string,
  onFelt: '#FFFFFF',
  onFeltMuted: 'rgba(255, 255, 255, 0.72)',
  // Add round cells: neutral before anything is entered, white once a score is confirmed.
  cellNeutral: '#F3F3ED',
  tableHeader: '#F1F1EA',
  /** Results game bands (V4): gray rows, a shade darker for every second band; header bands green-tinted. */
  band: '#F1F1EB',
  bandAlt: '#E9EAE2',
  bandHead: '#DDEFE2',
  bandHeadAlt: '#D2E9DA',
  tableStripe: '#F9F9F5',
  tableLatest: '#EAF7EE',
  hairline: '#E6E1D3',
  /** Pool: a re-entered player's header and standings row (D5). */
  reentry: '#2B5FBF',
  reentryContainer: '#DCE8FF',
};

const darkColors: typeof lightColors = {
  ...MD3DarkTheme.colors,
  primary: '#7FD39F',
  onPrimary: '#063019',
  primaryContainer: '#1A3F29',
  onPrimaryContainer: '#CDEFD8',
  secondary: '#E3BE63',
  onSecondary: '#3E2E07',
  secondaryContainer: '#4A3A10',
  onSecondaryContainer: '#F5E3B0',
  tertiary: '#9DBCFF',
  onTertiary: '#0F2B63',
  tertiaryContainer: '#22406E',
  onTertiaryContainer: '#DCE8FF',
  error: '#FF978E',
  onError: '#4A0B07',
  errorContainer: '#7A1F1A',
  onErrorContainer: '#FFDAD6',
  background: '#0C120E',
  onBackground: '#ECEBE4',
  surface: '#141B16',
  onSurface: '#ECEBE4',
  surfaceVariant: '#1B231D',
  onSurfaceVariant: '#B6BDB4',
  surfaceDisabled: 'rgba(234, 237, 233, 0.12)',
  onSurfaceDisabled: 'rgba(234, 237, 233, 0.38)',
  outline: '#848C84',
  outlineVariant: '#2A322C',
  inverseSurface: '#ECEBE4',
  inverseOnSurface: '#2C332F',
  inversePrimary: '#0E4D2A',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  elevation: {
    level0: 'transparent',
    level1: '#1B211E',
    level2: '#1F2622',
    level3: '#232A26',
    level4: '#252C28',
    level5: '#283029',
  },
  surfaceSunken: '#101712',
  primaryEdge: '#3FAF6E',
  secondaryEdge: '#3E2E07',
  positive: '#EAEDE9',
  positiveContainer: '#1A4A2E',
  onPositiveContainer: '#EAEDE9',
  win: '#73DF9D',
  winContainer: '#1A4A2E',
  onWinContainer: '#EAEDE9',
  negative: '#FFA19A',
  loss: '#FFA19A',
  lossContainer: '#7A1F1A',
  onLossContainer: '#FFDAD6',
  leader: '#FFD45E',
  leaderContainer: '#4D3900',
  onLeaderContainer: '#FFE8AE',
  focus: '#9DBCFF',
  felt: '#0B3B1F',
  onFelt: '#EAEDE9',
  onFeltMuted: 'rgba(234, 237, 233, 0.72)',
  cellNeutral: '#1C2320',
  tableHeader: '#1F2622',
  band: '#1B211D',
  bandAlt: '#232A25',
  bandHead: '#1A3A26',
  bandHeadAlt: '#214A30',
  tableStripe: '#1B211E',
  tableLatest: '#1B3326',
  hairline: '#2A322C',
  reentry: '#9DBCFF',
  reentryContainer: '#22406E',
};

/**
 * Bigger Material type for older players: body 16, nothing under 13. Paper variants keep
 * their names so no call site changes; headings go ExtraBold.
 */
const fontOverrides = {
  headlineMedium: { ...MD3LightTheme.fonts.headlineMedium, fontWeight: '800' as const },
  headlineSmall: { ...MD3LightTheme.fonts.headlineSmall, fontWeight: '800' as const },
  titleLarge: { ...MD3LightTheme.fonts.titleLarge, fontWeight: '800' as const },
  titleMedium: { ...MD3LightTheme.fonts.titleMedium, fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  bodyMedium: { ...MD3LightTheme.fonts.bodyMedium, fontSize: 16, lineHeight: 24 },
  bodySmall: { ...MD3LightTheme.fonts.bodySmall, fontSize: 14, lineHeight: 20 },
  labelLarge: { ...MD3LightTheme.fonts.labelLarge, fontSize: 16, lineHeight: 20, fontWeight: '700' as const },
  labelMedium: { ...MD3LightTheme.fonts.labelMedium, fontSize: 14, lineHeight: 18, fontWeight: '700' as const },
  labelSmall: { ...MD3LightTheme.fonts.labelSmall, fontSize: 13, lineHeight: 16, fontWeight: '600' as const },
};

const fonts = configureFonts({ config: fontOverrides });

export const lightTheme = {
  ...MD3LightTheme,
  roundness: 4,
  fonts,
  colors: lightColors,
  gameTypes: lightGameTypes,
};

export const darkTheme: typeof lightTheme = {
  ...MD3DarkTheme,
  roundness: 4,
  fonts,
  colors: darkColors,
  gameTypes: darkGameTypes,
};

export type AppTheme = typeof lightTheme;

export const useAppTheme = () => useTheme<AppTheme>();
