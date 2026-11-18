import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Button } from '@/components/ui/AppButton';
import { BottomBar } from '@/components/ui/BottomBar';

export type ActionBarAction = {
  label: string;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

type ActionBarProps = {
  /** The filled button on the right. When disabled, `disabledLabel` says why ("Next · pick 2+ players"). */
  primary: ActionBarAction & { disabledLabel?: string };
  /** The outlined button on the left: Cancel, or the lesser of two actions. */
  secondary?: ActionBarAction;
  /** Tab screens: the tab bar already clears the gesture bar. */
  insetBottom?: boolean;
  style?: ViewStyle;
};

/**
 * The one bottom action bar (design audit A08): at most two actions, the primary filled on the
 * right, the secondary outlined on the left, a disabled primary saying why in its own label, always
 * above the tab bar with its own inset. Page-level returns are the header arrow, not a bar button (A05).
 */
export function ActionBar({ primary, secondary, insetBottom = true, style }: ActionBarProps) {
  const primaryLabel = primary.disabled && primary.disabledLabel ? primary.disabledLabel : primary.label;
  return (
    <BottomBar style={style} insetBottom={insetBottom}>
      {secondary ? (
        <Button
          mode="outlined"
          icon={secondary.icon}
          onPress={secondary.onPress}
          disabled={secondary.disabled}
          loading={secondary.loading}
          style={styles.secondary}
          accessibilityLabel={secondary.accessibilityLabel ?? secondary.label}
          testID={secondary.testID}
        >
          {secondary.label}
        </Button>
      ) : null}
      <Button
        mode="contained"
        icon={primary.icon}
        onPress={primary.onPress}
        disabled={primary.disabled}
        loading={primary.loading}
        style={styles.primary}
        accessibilityLabel={primary.accessibilityLabel ?? primary.label}
        testID={primary.testID}
      >
        {primaryLabel}
      </Button>
    </BottomBar>
  );
}

const styles = StyleSheet.create({
  secondary: { flex: 1 },
  primary: { flex: 1.4 },
});
