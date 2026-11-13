import React from 'react';
import { FlatList, FlatListProps, NativeScrollEvent, NativeSyntheticEvent, RefreshControlProps, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { MAX_CONTENT_WIDTH, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type ScreenProps = {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: ViewStyle;
  /** Pad for the gesture/nav bar. Off for tab screens, whose tab bar already does. */
  safeBottom?: boolean;
  /** Let content use the full width instead of the centred reading column. */
  fullWidth?: boolean;
  /** Scroll events, e.g. to load more rows near the bottom. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The scroller, for callers that jump to a section (e.g. the result History). */
  scrollRef?: React.RefObject<ScrollView | null>;
};

/** The page padding every screen variant shares: gutters, top, and the gesture/nav bar. */
function useScreenPadding(safeBottom: boolean): ViewStyle {
  const { insets, gutterLeft, gutterRight, isShort } = useLayout();
  return {
    paddingLeft: gutterLeft,
    paddingRight: gutterRight,
    paddingTop: isShort ? spacing.md : spacing.lg,
    paddingBottom: (safeBottom ? insets.bottom : 0) + spacing.xxl,
  };
}

/** Consistent page padding, safe areas and background across screens. */
export function Screen({
  children,
  scrollable = true,
  refreshControl,
  contentStyle,
  safeBottom = true,
  fullWidth = false,
  onScroll,
  scrollRef,
}: ScreenProps) {
  const theme = useAppTheme();
  const padding = useScreenPadding(safeBottom);

  const column: ViewStyle = fullWidth ? styles.fill : styles.column;

  if (!scrollable) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }, padding]}>
        <View style={[column, styles.gap, styles.flex, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={padding}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 200 : undefined}
    >
      <View style={[column, styles.gap, contentStyle]}>{children}</View>
    </ScrollView>
  );
}

type ScreenListProps<T> = Pick<FlatListProps<T>, 'data' | 'renderItem' | 'keyExtractor' | 'refreshControl' | 'initialNumToRender' | 'windowSize' | 'extraData'> & {
  safeBottom?: boolean;
  /** Everything above the rows; its children are spaced like Screen's. */
  header?: React.ReactNode;
  /** Everything below the rows. */
  footer?: React.ReactNode;
};

/**
 * The same page as Screen, but the scroller is a FlatList so a long list draws only
 * what is on screen. Header and footer carry everything that is not a row; rows,
 * header and footer share the centred reading column, so the page looks like Screen.
 */
export function ScreenList<T>({ safeBottom = true, header, footer, renderItem, ...rest }: ScreenListProps<T>) {
  const theme = useAppTheme();
  const padding = useScreenPadding(safeBottom);

  return (
    <FlatList
      {...rest}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header ? <View style={[styles.column, styles.gap]}>{header}</View> : null}
      ListFooterComponent={footer ? <View style={styles.column}>{footer}</View> : null}
      renderItem={(info) => <View style={styles.column}>{renderItem?.(info)}</View>}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  fill: {
    width: '100%',
  },
  gap: {
    gap: spacing.lg,
  },
});
