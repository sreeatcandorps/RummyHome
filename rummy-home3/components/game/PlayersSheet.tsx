import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Switch, Text, TextInput } from 'react-native-paper';
import { Player } from '@/types/player';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type PlayersSheetProps = {
  visible: boolean;
  seats: Player[];
  canManage: boolean;
  candidates: Player[];
  busy?: boolean;
  onDismiss: () => void;
  onToggleAdmin: (player: Player, makeAdmin: boolean) => void;
  onAddSpectator: (player: Player) => void;
};

export function PlayersSheet({
  visible,
  seats,
  canManage,
  candidates,
  busy,
  onDismiss,
  onToggleAdmin,
  onAddSpectator,
}: PlayersSheetProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const playing = seats.filter((seat) => seat.seatRole !== 'spectator');
  const viewers = seats.filter((seat) => seat.seatRole === 'spectator');
  const taken = new Set(seats.map((seat) => seat.id));
  const q = query.trim().toLowerCase();
  const matches = candidates
    .filter((player) => !taken.has(player.id))
    .filter((player) => !q || player.name.toLowerCase().includes(q) || (player.email ?? '').toLowerCase().includes(q))
    .slice(0, 8);

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title style={styles.title}>Players</Dialog.Title>
      <Dialog.ScrollArea style={styles.scroll}>
        <ScrollView>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {canManage
              ? 'Game admins can enter and undo scores. Everyone else can watch.'
              : 'You can watch this game. A game admin enters the scores.'}
          </Text>
          {playing.map((seat) => (
            <View key={seat.id} style={[styles.row, { borderColor: colors.outlineVariant }]}>
              <View style={styles.text}>
                <Text variant="bodyLarge" numberOfLines={1}>{seat.name}</Text>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                  {seat.seatRole === 'game_admin' ? 'Game admin' : 'Player'}
                </Text>
              </View>
              {canManage ? (
                <Switch
                  value={seat.seatRole === 'game_admin'}
                  disabled={busy}
                  onValueChange={(value) => onToggleAdmin(seat, value)}
                  accessibilityLabel={`Make ${seat.name} a game admin`}
                />
              ) : null}
            </View>
          ))}

          {viewers.length > 0 ? (
            <Text variant="titleSmall" style={styles.section}>View only</Text>
          ) : null}
          {viewers.map((seat) => (
            <Text key={seat.id} variant="bodyMedium" style={styles.viewer}>
              {seat.name}
            </Text>
          ))}

          {canManage ? (
            <View style={styles.add}>
              <Text variant="titleSmall">Add view-only</Text>
              <TextInput
                mode="outlined"
                placeholder="Name or email"
                value={query}
                onChangeText={setQuery}
                dense
              />
              {matches.map((player) => (
                <Button
                  key={player.id}
                  mode="text"
                  icon="eye-outline"
                  disabled={busy}
                  onPress={() => onAddSpectator(player)}
                  style={styles.addButton}
                >
                  {player.name}
                </Button>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Close</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 520,
    width: '92%',
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 420,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
  },
  section: {
    marginTop: spacing.md,
    fontWeight: '700',
  },
  viewer: {
    paddingVertical: spacing.xs,
  },
  add: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  addButton: {
    alignSelf: 'flex-start',
  },
});
