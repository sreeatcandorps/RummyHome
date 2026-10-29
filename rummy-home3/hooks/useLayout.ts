import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/constants/theme';

/**
 * Orientation-aware layout helpers. Phones in landscape are short, so
 * `isShort` drives the compact chrome; `isWide` unlocks two-column layouts.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  const isShort = height < 520;
  const isWide = width >= 700;

  return {
    width,
    height,
    insets,
    isLandscape,
    isShort,
    isWide,
    /** Horizontal page padding that also clears side notches / nav bars in landscape. */
    gutterLeft: Math.max(insets.left, 0) + (isShort ? spacing.md : spacing.lg),
    gutterRight: Math.max(insets.right, 0) + (isShort ? spacing.md : spacing.lg),
  };
}
