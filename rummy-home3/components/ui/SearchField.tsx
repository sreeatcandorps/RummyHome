import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Searchbar } from 'react-native-paper';
import { radius, useAppTheme } from '@/constants/theme';
import { SEARCH_PLACEHOLDER } from '@/utils/addPlayers';

type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Defaults to the My players placeholder, "Search name, initials or #ID" (A03 / A21). Find in database is a Player ID box instead (D113). */
  placeholder?: string;
  accessibilityLabel?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The one search field (design audit A07): white, the standard border and input radius, the one
 * placeholder. Filters and sort controls go in the row below it, never inside it.
 */
export function SearchField({ value, onChangeText, placeholder = SEARCH_PLACEHOLDER, accessibilityLabel, autoFocus, style, testID }: SearchFieldProps) {
  const { colors } = useAppTheme();
  return (
    <Searchbar
      mode="bar"
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.outline }, style]}
      inputStyle={styles.input}
      iconColor={colors.onSurfaceVariant}
      placeholderTextColor={colors.onSurfaceVariant}
      accessibilityLabel={accessibilityLabel ?? placeholder}
      autoFocus={autoFocus}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  field: { borderWidth: 1, borderRadius: radius.sm, elevation: 0, shadowOpacity: 0 },
  input: { fontSize: 15, minHeight: 0 },
});
