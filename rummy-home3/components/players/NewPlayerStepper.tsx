import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { clampNewPlayerCount, MAX_NEW_PLAYERS_AT_ONCE } from '@/utils/playerIdentity';
import { spacing, useAppTheme } from '@/constants/theme';

/** "−  Add 2 new players  +". Starts at 1, up to 5 at a time. */
export function NewPlayerStepper({ count, onChange, onAdd }: { count: number; onChange: (n: number) => void; onAdd: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.row, { borderColor: colors.outlineVariant }]}>
      <IconButton icon="minus" mode="outlined" size={18} disabled={count <= 1} onPress={() => onChange(clampNewPlayerCount(count - 1))} accessibilityLabel="Fewer new players" />
      <Button mode="contained-tonal" icon="account-plus" onPress={onAdd} style={styles.flex} accessibilityLabel={`Add ${count} new players`}>
        {count === 1 ? 'Add new player' : `Add ${count} new players`}
      </Button>
      <IconButton icon="plus" mode="outlined" size={18} disabled={count >= MAX_NEW_PLAYERS_AT_ONCE} onPress={() => onChange(clampNewPlayerCount(count + 1))} accessibilityLabel="More new players" />
      <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>max {MAX_NEW_PLAYERS_AT_ONCE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.xs },
  flex: { flex: 1 },
});
