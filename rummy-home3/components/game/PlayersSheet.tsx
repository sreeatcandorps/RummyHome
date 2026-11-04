import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Switch, Text } from 'react-native-paper';
import { HelpButton } from '@/components/ui/HelpButton';
import { FIND_HANDOFF, HELP } from '@/constants/help';
import { Player } from '@/types/player';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type Picker = 'seat' | 'view' | 'admin' | null;

type PlayersSheetProps = {
  visible: boolean;
  seats: Player[];
  canManage: boolean;
  /** My players only. Name and player ID. */
  candidates: Player[];
  busy?: boolean;
  canReorder?: boolean;
  onDismiss: () => void;
  onToggleAdmin: (player: Player, makeAdmin: boolean) => void;
  onAddPlayer: (player: Player) => void;
  onAddSpectator: (player: Player) => void;
  onAddNonPlayerAdmin: (player: Player) => void;
  onFindPlayers: () => void;
  onMove?: (player: Player, direction: -1 | 1) => void;
};

export function PlayersSheet({
  visible,
  seats,
  canManage,
  candidates,
  busy,
  canReorder,
  onDismiss,
  onToggleAdmin,
  onAddPlayer,
  onAddSpectator,
  onAddNonPlayerAdmin,
  onFindPlayers,
  onMove,
}: PlayersSheetProps) {
  const { colors } = useAppTheme();
  const [picker, setPicker] = useState<Picker>(null);
  const playing = seats.filter((seat) => seat.seatRole !== 'spectator' && seat.seated !== false);
  const viewers = seats.filter((seat) => seat.seatRole === 'spectator');
  const unseated = seats.filter((seat) => seat.seated === false && seat.seatRole === 'game_admin');
  const taken = new Set(seats.map((seat) => seat.id));
  const available = candidates.filter((player) => !taken.has(player.id));

  const add = (player: Player) => {
    if (picker === 'seat') onAddPlayer(player);
    else if (picker === 'view') onAddSpectator(player);
    else if (picker === 'admin') onAddNonPlayerAdmin(player);
    setPicker(null);
  };

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>
        <View style={styles.titleRow}>
          <Text variant="titleLarge" style={styles.title}>Players in this game</Text>
          <HelpButton text={HELP.playersSheet} />
        </View>
      </Dialog.Title>
      <Dialog.ScrollArea style={styles.scroll}>
        <ScrollView>
          {playing.map((seat, index) => (
            <View key={seat.id} style={[styles.row, { borderColor: colors.outlineVariant }]}>
              <View style={styles.text}>
                <Text variant="bodyLarge" numberOfLines={1}>{seat.name}</Text>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                  {seat.playerCode ? `${seat.playerCode} · ` : ''}
                  {seat.seatRole === 'game_admin' ? 'Admin' : 'Player'}
                </Text>
              </View>
              {canManage && canReorder && onMove ? (
                <View style={styles.reorder}>
                  <Button compact disabled={busy || index === 0} onPress={() => onMove(seat, -1)}>Up</Button>
                  <Button compact disabled={busy || index === playing.length - 1} onPress={() => onMove(seat, 1)}>Down</Button>
                </View>
              ) : null}
              {canManage ? (
                <Switch
                  value={seat.seatRole === 'game_admin'}
                  disabled={busy}
                  onValueChange={(value) => onToggleAdmin(seat, value)}
                  accessibilityLabel={`Make ${seat.name} an admin`}
                />
              ) : null}
            </View>
          ))}

          {viewers.length > 0 ? <Text variant="titleSmall" style={styles.section}>Watching</Text> : null}
          {viewers.map((seat) => (
            <Text key={seat.id} variant="bodyMedium" style={styles.viewer}>
              {seat.name}{seat.playerCode ? ` · ${seat.playerCode}` : ''} · View only
            </Text>
          ))}

          {unseated.length > 0 ? <Text variant="titleSmall" style={styles.section}>Admins not playing</Text> : null}
          {unseated.map((seat) => (
            <Text key={seat.id} variant="bodyMedium" style={styles.viewer}>
              {seat.name}{seat.playerCode ? ` · ${seat.playerCode}` : ''} · Admin
            </Text>
          ))}

          {canManage && picker ? (
            <View style={styles.add}>
              <Text variant="titleSmall">
                {picker === 'seat' ? 'Add a player' : picker === 'view' ? 'Add view only' : 'Add non-player admin'}
              </Text>
              {available.length === 0 ? (
                <View>
                  <Text variant="bodyMedium">{FIND_HANDOFF}</Text>
                  <Button mode="contained" onPress={onFindPlayers} style={styles.find}>Find Players</Button>
                </View>
              ) : (
                available.map((player) => (
                  <Button
                    key={player.id}
                    mode="text"
                    disabled={busy}
                    onPress={() => add(player)}
                    style={styles.addButton}
                  >
                    {player.name}{player.playerCode ? ` · ${player.playerCode}` : ''}
                  </Button>
                ))
              )}
              {available.length > 0 ? (
                <View>
                  <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{FIND_HANDOFF}</Text>
                  <Button mode="text" onPress={onFindPlayers}>Find Players</Button>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions style={styles.actions}>
        {canManage && !picker ? (
          <>
            <Button onPress={() => setPicker('seat')} disabled={busy}>Add a player</Button>
            <Button onPress={() => setPicker('view')} disabled={busy}>Add view only</Button>
            <Button onPress={() => setPicker('admin')} disabled={busy}>Add non-player admin</Button>
          </>
        ) : null}
        <Button onPress={onDismiss}>Close</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 560,
    width: '94%',
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '700',
    flex: 1,
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
  reorder: {
    flexDirection: 'row',
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
  find: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  actions: {
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
