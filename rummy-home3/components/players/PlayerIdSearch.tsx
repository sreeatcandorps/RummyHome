import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { listInitials, playerIdResultLine } from '@/utils/playerSearch';
import { PLAYER_ID_CHECK, PLAYER_ID_HINT, PLAYER_ID_PLACEHOLDER, PLAYER_ID_SEARCH } from '@/utils/addPlayers';

/**
 * The Find in database box (D113): a number keypad, a Search button (the keypad's action key does the
 * same), and the hint. Nothing is looked up while typing; the caller searches on onSearch.
 */
export function PlayerIdBox({ value, onChangeText, onSearch, searching, accessibilityLabel, autoFocus }: {
  value: string;
  onChangeText: (text: string) => void;
  onSearch: () => void;
  searching: boolean;
  accessibilityLabel?: string;
  autoFocus?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <TextInput
          mode="outlined"
          value={value}
          onChangeText={onChangeText}
          placeholder={PLAYER_ID_PLACEHOLDER}
          left={<TextInput.Affix text="#" />}
          keyboardType="number-pad"
          returnKeyType="search"
          onSubmitEditing={onSearch}
          autoFocus={autoFocus}
          maxLength={13}
          accessibilityLabel={accessibilityLabel ?? PLAYER_ID_PLACEHOLDER}
          style={styles.input}
          testID="player-id-input"
        />
        <Button
          mode="contained"
          onPress={onSearch}
          loading={searching}
          disabled={searching || !value.trim()}
          accessibilityLabel="Search Player ID"
          testID="player-id-search"
        >
          {PLAYER_ID_SEARCH}
        </Button>
      </View>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{PLAYER_ID_HINT}</Text>
    </View>
  );
}

/** The one result: "#57 · Ravi K.", the check line, and the caller's action (Add to game, or a status chip). */
export function PlayerIdResultCard({ playerNo, name, children }: { playerNo: number; name: string; children?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]} testID="player-id-result">
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: colors.positiveContainer }]}>
          <Text variant="labelLarge" style={{ color: colors.onPositiveContainer, fontWeight: '700' }}>{listInitials(name)}</Text>
        </View>
        <Text variant="titleMedium" style={styles.flex} numberOfLines={2}>{playerIdResultLine(playerNo, name)}</Text>
      </View>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{PLAYER_ID_CHECK}</Text>
      {children ? <View style={styles.action}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  action: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
