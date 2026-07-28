import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

/** 4dp baseline grid from Material Design layout guidance. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/** Material accessibility minimum for interactive elements. */
export const MIN_TOUCH_TARGET = 48;

/** Subtle, distinct tints so stake and pool games are recognisable at a glance. */
export const gameTypeColors = {
  stake: {
    container: 'rgb(214, 231, 255)',
    on: 'rgb(0, 42, 79)',
    accent: 'rgb(21, 101, 192)',
  },
  pool: {
    container: 'rgb(255, 231, 204)',
    on: 'rgb(69, 43, 0)',
    accent: 'rgb(184, 117, 0)',
  },
} as const;

const lightColors = {
  ...MD3LightTheme.colors,
  primary: 'rgb(30, 107, 78)',
  onPrimary: 'rgb(255, 255, 255)',
  primaryContainer: 'rgb(168, 242, 200)',
  onPrimaryContainer: 'rgb(0, 33, 21)',
  secondary: 'rgb(76, 99, 88)',
  onSecondary: 'rgb(255, 255, 255)',
  secondaryContainer: 'rgb(206, 233, 218)',
  onSecondaryContainer: 'rgb(8, 31, 22)',
  tertiary: 'rgb(58, 100, 114)',
  onTertiary: 'rgb(255, 255, 255)',
  tertiaryContainer: 'rgb(190, 234, 250)',
  onTertiaryContainer: 'rgb(0, 31, 40)',
  error: 'rgb(186, 26, 26)',
  onError: 'rgb(255, 255, 255)',
  errorContainer: 'rgb(255, 218, 214)',
  onErrorContainer: 'rgb(65, 0, 2)',
  background: 'rgb(251, 253, 249)',
  onBackground: 'rgb(25, 28, 26)',
  surface: 'rgb(251, 253, 249)',
  onSurface: 'rgb(25, 28, 26)',
  surfaceVariant: 'rgb(220, 229, 222)',
  onSurfaceVariant: 'rgb(64, 73, 68)',
  outline: 'rgb(112, 121, 115)',
  outlineVariant: 'rgb(192, 201, 194)',
  elevation: {
    level0: 'transparent',
    level1: 'rgb(240, 246, 240)',
    level2: 'rgb(233, 242, 235)',
    level3: 'rgb(226, 237, 229)',
    level4: 'rgb(224, 236, 228)',
    level5: 'rgb(219, 233, 224)',
  },
};

const darkColors = {
  ...MD3DarkTheme.colors,
  primary: 'rgb(140, 214, 173)',
  onPrimary: 'rgb(0, 57, 38)',
  primaryContainer: 'rgb(0, 82, 57)',
  onPrimaryContainer: 'rgb(168, 242, 200)',
  secondary: 'rgb(179, 204, 190)',
  onSecondary: 'rgb(30, 53, 43)',
  secondaryContainer: 'rgb(53, 75, 65)',
  onSecondaryContainer: 'rgb(206, 233, 218)',
  background: 'rgb(25, 28, 26)',
  onBackground: 'rgb(225, 227, 223)',
  surface: 'rgb(25, 28, 26)',
  onSurface: 'rgb(225, 227, 223)',
  surfaceVariant: 'rgb(64, 73, 68)',
  onSurfaceVariant: 'rgb(192, 201, 194)',
  outline: 'rgb(138, 147, 140)',
  outlineVariant: 'rgb(64, 73, 68)',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: lightColors,
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: darkColors,
};

export type AppTheme = typeof lightTheme;
