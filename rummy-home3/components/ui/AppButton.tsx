import React from 'react';
import { StyleSheet } from 'react-native';
import { Button as PaperButton, ButtonProps } from 'react-native-paper';
import { useAppTheme } from '@/constants/theme';

export type AppButtonProps = ButtonProps & {
  /** Marigold Results button: the only non-green filled button in the app. */
  accent?: boolean;
};

/** Filled green buttons carry this bottom edge so they read as pressable. */
export const BUTTON_EDGE = 4;
/** Every button is at least this tall (the standard is 52; dialogs and compact rows use the minimum). */
export const BUTTON_MIN_HEIGHT = 48;

/**
 * The one button standard (docs/design/02-design-system.md §5.1) on top of Paper's Button, so
 * every call site keeps its props: pill shape, 16/800 label, 48 px minimum, a 2 px border on
 * outlined buttons, a 4 px darker edge under filled ones. `mode="text"` is left alone: text
 * buttons only live inside dialogs.
 */
export const Button = React.forwardRef<React.ComponentRef<typeof PaperButton>, AppButtonProps>(function AppButton(
  { mode = 'text', accent = false, style, contentStyle, labelStyle, disabled, buttonColor, textColor, compact, ...rest },
  ref,
) {
  const { colors } = useAppTheme();
  const filled = mode === 'contained';
  const outlined = mode === 'outlined';
  const tonal = mode === 'contained-tonal';

  const edgeColor = disabled
    ? undefined
    : accent
      ? colors.secondaryEdge
      : buttonColor && buttonColor !== colors.primary
        ? undefined
        : colors.primaryEdge;

  const label = disabled
    ? textColor
    : textColor
      ?? (accent ? colors.onSecondaryContainer : outlined ? colors.primary : tonal ? colors.onPrimaryContainer : undefined);

  return (
    <PaperButton
      ref={ref}
      mode={mode}
      compact={compact}
      disabled={disabled}
      buttonColor={accent && !disabled ? colors.secondaryContainer : buttonColor}
      textColor={label}
      style={[
        styles.pill,
        outlined && { borderWidth: 2, borderColor: disabled ? colors.outlineVariant : colors.outline },
        filled && edgeColor ? { borderBottomWidth: BUTTON_EDGE, borderBottomColor: edgeColor } : null,
        tonal && !disabled ? { backgroundColor: colors.primaryContainer } : null,
        style,
      ]}
      contentStyle={[mode !== 'text' && !compact ? styles.content : styles.compactContent, contentStyle]}
      labelStyle={[styles.label, mode !== 'text' && !compact ? (rest.icon ? styles.labelWithIcon : styles.labelNoIcon) : null, labelStyle]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  pill: { borderRadius: 999 },
  content: { minHeight: BUTTON_MIN_HEIGHT },
  compactContent: { minHeight: 40 },
  label: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  // Paper pads labels 24 px a side; two pills must share a phone-width bottom bar. The icon
  // sits with a -16 right margin, so the label keeps 26 on that side for an 10 px gap.
  labelNoIcon: { marginHorizontal: 16 },
  labelWithIcon: { marginLeft: 26, marginRight: 16 },
});
