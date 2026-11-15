import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Icon, Text, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';

export type ShareOption = {
  key: string;
  /** Icons differ by target on purpose (A18): link, image, PDF. */
  icon: string;
  label: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

type ShareSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  options: ShareOption[];
  title?: string;
};

/**
 * The one share sheet (design audit A04): opened from the header share icon on every shareable
 * screen, it lists what applies — live link, final-scores picture, full-details PDF. An info sheet,
 * so it closes with Close (A05).
 */
export function ShareSheet({ visible, onDismiss, options, title = 'Share' }: ShareSheetProps) {
  const { colors } = useAppTheme();
  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]} testID="share-sheet">
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Content style={styles.content}>
        {options.map((option) => (
          <TouchableRipple
            key={option.key}
            onPress={() => { onDismiss(); option.onPress(); }}
            disabled={option.disabled}
            borderless
            style={[styles.row, { borderRadius: radius.md }]}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            testID={option.testID}
          >
            <View style={styles.inner}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceVariant }]}>
                <Icon source={option.icon} size={22} color={option.disabled ? colors.onSurfaceDisabled : colors.onSurfaceVariant} />
              </View>
              <View style={styles.text}>
                <Text variant="bodyLarge" style={{ color: option.disabled ? colors.onSurfaceDisabled : colors.onSurface }}>{option.label}</Text>
                {option.detail ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{option.detail}</Text> : null}
              </View>
              <Icon source="chevron-right" size={22} color={colors.onSurfaceVariant} />
            </View>
          </TouchableRipple>
        ))}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} accessibilityLabel="Close">Close</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 480, width: '90%', alignSelf: 'center' },
  content: { gap: spacing.xs, paddingHorizontal: spacing.sm },
  row: { minHeight: MIN_TOUCH_TARGET },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
