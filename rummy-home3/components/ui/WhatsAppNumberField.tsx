import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Menu, Text, TextInput } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { splitPlusNumber, WHATSAPP_COUNTRIES, WhatsAppCountry } from '@/utils/countries';

/**
 * "WhatsApp number": the country picker (the six countries of Q26 only) beside the number. The picker starts on
 * the phone's country (D125). A number pasted with its own "+" code moves the picker to that country and keeps
 * only the rest in the box.
 */
export function WhatsAppNumberField({ country, onCountryChange, value, onChangeText, label = 'WhatsApp number', disabled, autoFocus, onSubmitEditing, testID }: {
  country: WhatsAppCountry;
  onCountryChange: (country: WhatsAppCountry) => void;
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  testID: string;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  const change = (text: string) => {
    const plus = splitPlusNumber(text, country);
    if (plus) {
      if (plus.country.code !== country.code) onCountryChange(plus.country);
      onChangeText(plus.national);
      return;
    }
    onChangeText(text.replace(/[^\d +()-]/g, ''));
  };

  return (
    <View style={styles.row}>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={(
          <Pressable
            onPress={() => setOpen(true)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Country code, ${country.name} +${country.callingCode}. Change`}
            testID={`${testID}-country`}
            style={[styles.picker, { borderColor: colors.outline, opacity: disabled ? 0.5 : 1 }]}
          >
            <Text variant="titleMedium">{country.flag}</Text>
            <Text variant="titleMedium" style={styles.code}>+{country.callingCode}</Text>
            <Icon source="menu-down" size={20} color={colors.onSurfaceVariant} />
          </Pressable>
        )}
      >
        {WHATSAPP_COUNTRIES.map((item) => (
          <Menu.Item
            key={item.code}
            title={`${item.flag} ${item.name} (+${item.callingCode})`}
            onPress={() => { onCountryChange(item); setOpen(false); }}
            testID={`${testID}-country-${item.code}`}
          />
        ))}
      </Menu>
      <TextInput
        label={label}
        placeholder={country.example}
        value={value}
        onChangeText={change}
        mode="outlined"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        disabled={disabled}
        accessibilityLabel={label}
        testID={testID}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 50,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginBottom: 1,
  },
  code: { fontWeight: '700' },
  input: { flex: 1 },
});
