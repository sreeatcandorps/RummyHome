import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput as NativeInput, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type PasscodeFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  label?: string;
  autoFocus?: boolean;
};

/**
 * Six large cells, digits visible by default, with an eye toggle to hide them and a clear button.
 * The real TextInput sits invisibly on top of the cells, so a tap lands on the input itself and
 * the OS opens the keyboard on the first tap. (Focusing a hidden input from a Pressable needed a
 * second tap on Android.)
 */
export function PasscodeField({ value, onChangeText, disabled, label = '6-digit passcode', autoFocus }: PasscodeFieldProps) {
  const { colors } = useAppTheme();
  const [revealed, setRevealed] = useState(true);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<NativeInput>(null);
  const digits = value.replace(/\D/g, '').slice(0, 6);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="titleSmall" style={styles.label}>
          {label}
        </Text>
        <View style={styles.actions}>
          {digits.length > 0 ? (
            <IconButton
              icon="close-circle"
              size={22}
              onPress={() => {
                onChangeText('');
                inputRef.current?.focus();
              }}
              disabled={disabled}
              accessibilityLabel={`Clear ${label}`}
              style={styles.action}
            />
          ) : null}
          <IconButton
            icon={revealed ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            onPress={() => setRevealed((current) => !current)}
            disabled={disabled}
            accessibilityLabel={revealed ? 'Hide passcode' : 'Show passcode'}
            style={styles.action}
          />
        </View>
      </View>
      <View style={styles.cells}>
        {Array.from({ length: 6 }, (_, index) => {
          const filled = Boolean(digits[index]);
          const active = focused && digits.length === index;
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
        <NativeInput
          ref={inputRef}
          value={digits}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 6))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          editable={!disabled}
          autoFocus={autoFocus}
          caretHidden
          contextMenuHidden
          autoComplete="off"
          autoCorrect={false}
          importantForAutofill="no"
          style={styles.overlay}
          accessibilityLabel={label}
          accessibilityHint="Six digits"
        />
      </View>
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
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
  // Covers the cells; text and background are transparent so only the cells show.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 1,
    padding: 0,
    // The cells draw their own focus ring; hide the browser's rectangle on web.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
});
