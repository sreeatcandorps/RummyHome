import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput as NativeInput, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';

type PasscodeFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  label?: string;
};

/** Six large cells so each digit is obvious, with an eye toggle to reveal them. */
export function PasscodeField({ value, onChangeText, disabled, label = '6-digit passcode' }: PasscodeFieldProps) {
  const { colors } = useAppTheme();
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<NativeInput>(null);
  const digits = value.replace(/\D/g, '').slice(0, 6);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="titleSmall" style={styles.label}>
          {label}
        </Text>
        <IconButton
          icon={revealed ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          onPress={() => setRevealed((current) => !current)}
          disabled={disabled}
          accessibilityLabel={revealed ? 'Hide passcode' : 'Show passcode'}
          style={styles.eye}
        />
      </View>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
      >
        <View style={styles.cells}>
          {Array.from({ length: 6 }, (_, index) => {
            const filled = Boolean(digits[index]);
            const active = digits.length === index;
            return (
              <View
                key={index}
                style={[
                  styles.cell,
                  {
                    borderColor: active ? colors.primary : colors.outline,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={[styles.glyph, { color: filled ? colors.onSurface : colors.outline }]}>
                  {filled ? (revealed ? digits[index] : '●') : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>
      <NativeInput
        ref={inputRef}
        value={digits}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        editable={!disabled}
        caretHidden
        autoComplete="off"
        importantForAutofill="no"
        style={styles.hidden}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontWeight: '700',
  },
  eye: {
    margin: 0,
  },
  cells: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    height: 56,
    minWidth: 0,
    borderWidth: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: MIN_TOUCH_TARGET,
    width: '100%',
  },
});
