import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, TextInput as NativeInput } from 'react-native';
import { TextInput } from 'react-native-paper';
import { digitsOnly, EMAIL_CODE_LENGTH } from '@/utils/passcode';

type OtpFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  /** Focus and open the keyboard as soon as the field appears. */
  autoFocus?: boolean;
  label?: string;
  placeholder?: string;
  /** The icon in the box: the envelope for an email code, WhatsApp's for a WhatsApp code. */
  icon?: string;
  testID?: string;
};

/**
 * The one-time code typed back from the email: a single, obvious numeric box.
 * One real TextInput (no per-digit cells), so the keyboard opens on the first tap and the
 * OS can offer the code from SMS/mail autofill. Pasted text is reduced to its digits.
 */
export function OtpField({ value, onChangeText, disabled, autoFocus, label = 'OTP', placeholder = '6-digit OTP', icon = 'email-check-outline', testID }: OtpFieldProps) {
  const inputRef = useRef<NativeInput>(null);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    // Android ignores autoFocus on a view that mounts mid-animation; focus once laid out.
    const timer = setTimeout(() => inputRef.current?.focus(), Platform.OS === 'web' ? 0 : 120);
    return () => clearTimeout(timer);
  }, [autoFocus, disabled]);

  return (
    <TextInput
      ref={inputRef}
      label={label}
      placeholder={placeholder}
      value={value}
      onChangeText={(text) => onChangeText(digitsOnly(text, EMAIL_CODE_LENGTH))}
      mode="outlined"
      keyboardType="number-pad"
      inputMode="numeric"
      // No raw maxLength: it truncates a pasted "482 913" to "48291" before digitsOnly runs.
      // The six-digit cap is applied in onChangeText instead, so paste keeps all six digits.
      autoComplete="sms-otp"
      textContentType="oneTimeCode"
      importantForAutofill="yes"
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="done"
      disabled={disabled}
      left={<TextInput.Icon icon={icon} />}
      right={
        value && !disabled ? (
          <TextInput.Icon icon="close-circle" onPress={() => onChangeText('')} accessibilityLabel={`Clear ${label}`} forceTextInputFocus />
        ) : null
      }
      accessibilityLabel={label}
      testID={testID}
      style={styles.input}
      contentStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 26, fontWeight: '800' },
  content: { letterSpacing: 8 },
});
