import { MD3DarkTheme, MD3LightTheme, useTheme } from 'react-native-paper';

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

/** Brand felt green and card-stock cream, taken from the app icon. */
export const brand = {
  felt: '#17402F',
  feltLight: '#225A43',
  cream: '#FBF1E1',
  gold: '#E3B341',
} as const;

/** Tabular digits keep score columns aligned. */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

type GameTint = { container: string; on: string; accent: string };

const lightGameTypes: Record<'stake' | 'pool', GameTint> = {
  stake: { container: '#DCE8F7', on: '#0D2F55', accent: '#2563A8' },
  pool: { container: '#FBE6C8', on: '#4A2D00', accent: '#B9770E' },
};

const darkGameTypes: Record<'stake' | 'pool', GameTint> = {
  stake: { container: '#1E3550', on: '#CFE2FA', accent: '#7FB0EA' },
  pool: { container: '#4A3410', on: '#FBE3BF', accent: '#E9B25A' },
};

/** Light tints kept for callers that do not have a theme handy. */
export const gameTypeColors = lightGameTypes;

/**
 * Seat colours distinguish players across the scoreboard, standings and score
 * entry. Ordered so neighbouring seats contrast; cycles past ten players.
 */
const SEAT_COLORS = [
  '#2E7D5B',
  '#C2410C',
  '#2563EB',
  '#B4237A',
  '#7C3AED',
  '#0E7490',
  '#A16207',
  '#BE123C',
  '#4D7C0F',
  '#475569',
];

export const seatColor = (index: number) => SEAT_COLORS[((index % SEAT_COLORS.length) + SEAT_COLORS.length) % SEAT_COLORS.length];

const lightColors = {
  ...MD3LightTheme.colors,
  primary: '#1F5C46',
  onPrimary: '#FFFFFF',
  primaryContainer: '#CDEBD9',
  onPrimaryContainer: '#002113',
  secondary: '#8A6100',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#FFE2A0',
  onSecondaryContainer: '#2B1E00',
  tertiary: '#3A6472',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#C6E8F4',
  onTertiaryContainer: '#001F28',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  background: '#F6F2E9',
  onBackground: '#1B1F1C',
  surface: '#FFFDF8',
  onSurface: '#1B1F1C',
  surfaceVariant: '#ECE6D9',
  onSurfaceVariant: '#4A524D',
  surfaceDisabled: 'rgba(27, 31, 28, 0.12)',
  onSurfaceDisabled: 'rgba(27, 31, 28, 0.38)',
  outline: '#79807B',
  outlineVariant: '#DCD5C7',
  inverseSurface: '#2F3330',
  inverseOnSurface: '#F0F1EC',
  inversePrimary: '#8FD5B0',
  backdrop: 'rgba(23, 33, 28, 0.45)',
  elevation: {
    level0: 'transparent',
    level1: '#FBF8F1',
    level2: '#F3EEE3',
    level3: '#EEE8DB',
    level4: '#ECE5D7',
    level5: '#E8E1D2',
  },
  // App-specific roles.
  positive: '#1E7A4C',
  positiveContainer: '#D5F0E0',
  onPositiveContainer: '#00391F',
  negative: '#B3261E',
  leader: '#8A6100',
  leaderContainer: '#FFE7AE',
  onLeaderContainer: '#2B1E00',
  felt: brand.felt as string,
  onFelt: brand.cream as string,
  onFeltMuted: 'rgba(251, 241, 225, 0.72)',
  tableHeader: '#EFE9DC',
  tableStripe: '#FAF7F0',
  tableLatest: '#EAF5EE',
  hairline: '#E4DED1',
};

const darkColors: typeof lightColors = {
  ...MD3DarkTheme.colors,
  primary: '#8FD5B0',
  onPrimary: '#00391F',
  primaryContainer: '#1D4E3A',
  onPrimaryContainer: '#CDEBD9',
  secondary: '#F2C45A',
  onSecondary: '#402D00',
  secondaryContainer: '#5C4300',
  onSecondaryContainer: '#FFE2A0',
  tertiary: '#A2CDDC',
  onTertiary: '#033541',
  tertiaryContainer: '#214C59',
  onTertiaryContainer: '#C6E8F4',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  background: '#0E1512',
  onBackground: '#E2E6E2',
  surface: '#151D19',
  onSurface: '#E2E6E2',
  surfaceVariant: '#26302B',
  onSurfaceVariant: '#BEC8C1',
  surfaceDisabled: 'rgba(226, 230, 226, 0.12)',
  onSurfaceDisabled: 'rgba(226, 230, 226, 0.38)',
  outline: '#89938C',
  outlineVariant: '#34403A',
  inverseSurface: '#E2E6E2',
  inverseOnSurface: '#2C312E',
  inversePrimary: '#1F5C46',
  backdrop: 'rgba(0, 0, 0, 0.6)',
  elevation: {
    level0: 'transparent',
    level1: '#18211D',
    level2: '#1C2621',
    level3: '#202B26',
    level4: '#222D28',
    level5: '#25312B',
  },
  positive: '#7FD8A6',
  positiveContainer: '#164430',
  onPositiveContainer: '#C8F2D9',
  negative: '#F2A29C',
  leader: '#F2C45A',
  leaderContainer: '#4D3900',
  onLeaderContainer: '#FFE7AE',
  felt: '#123326',
  onFelt: brand.cream,
  onFeltMuted: 'rgba(251, 241, 225, 0.7)',
  tableHeader: '#1F2924',
  tableStripe: '#18211D',
  tableLatest: '#1A3327',
  hairline: '#2A3530',
};

export const lightTheme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: lightColors,
  gameTypes: lightGameTypes,
};

export const darkTheme: typeof lightTheme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: darkColors,
  gameTypes: darkGameTypes,
};

export type AppTheme = typeof lightTheme;

export const useAppTheme = () => useTheme<AppTheme>();
