import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { Player } from '@/types/player';
import { playerIdentityService } from '@/services/playerIdentity';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { spacing, useAppTheme } from '@/constants/theme';

type Row = { key: string; first: string; last: string; player?: Player; editing: boolean; busy: boolean; error?: string };

const blank = (i: number): Row => ({ key: `r${Date.now()}-${i}`, first: '', last: '', editing: true, busy: false });

export const ADD_PLAYERS_HEADING = 'Initials: Please type the name or just the initials.';

/**
 * Each row saves on its own, so a mistake on the third player never loses the
 * first two. Save turns green and says Saved; Edit reopens it; Delete removes it.
 */
export function AddPlayersDialog({ visible, count, ownerId, onClose, onSaved, onDeleted }: {
  visible: boolean;
  count: number;
  ownerId: string;
  onClose: () => void;
  onSaved: (player: Player) => void;
  onDeleted: (playerId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (visible) setRows(Array.from({ length: count }, (_, i) => blank(i)));
  }, [visible, count]);

  const patch = (key: string, next: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...next } : r)));

  const save = async (row: Row) => {
    if (!row.first.trim() && !row.last.trim()) {
      patch(row.key, { error: 'Type a name or initials.' });
      return;
    }
    patch(row.key, { busy: true, error: undefined });
    try {
      const player = row.player
        ? await playerIdentityService.updateNewPlayer(ownerId, row.player.id, row.first, row.last)
        : await playerIdentityService.createNewPlayer(ownerId, row.first, row.last);
      patch(row.key, { player, editing: false, busy: false });
      onSaved(player);
    } catch (err) {
      patch(row.key, { busy: false, error: formatSupabaseError(err) });
    }
  };

  const remove = async (row: Row) => {
    if (row.player) {
      patch(row.key, { busy: true });
      try {
        await playerIdentityService.deleteNewPlayer(ownerId, row.player.id);
        onDeleted(row.player.id);
      } catch (err) {
        patch(row.key, { busy: false, error: formatSupabaseError(err) });
        return;
      }
    }
    setRows((all) => all.filter((r) => r.key !== row.key));
  };

  const savedCount = rows.filter((r) => r.player && !r.editing).length;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Add new players</Dialog.Title>
        <Dialog.ScrollArea style={styles.area}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="titleSmall" style={styles.heading}>{ADD_PLAYERS_HEADING}</Text>
            {rows.map((row, i) => {
              const saved = Boolean(row.player) && !row.editing;
              return (
                <View key={row.key} style={[styles.row, { borderColor: saved ? '#2E7D32' : colors.outlineVariant }]}>
                  <Text variant="labelLarge" style={styles.num}>{i + 1}</Text>
                  <TextInput dense mode="outlined" label="First name" value={row.first} disabled={saved || row.busy}
                    onChangeText={(first) => patch(row.key, { first })} style={styles.input} autoCapitalize="characters" />
                  <TextInput dense mode="outlined" label="Last name" value={row.last} disabled={saved || row.busy}
                    onChangeText={(last) => patch(row.key, { last })} style={styles.input} autoCapitalize="characters" />
                  <View style={styles.actions}>
                    {saved ? (
                      <>
                        <Button compact mode="contained" buttonColor="#2E7D32" icon="check" accessibilityLabel={`Saved ${row.player?.name}`}>Saved</Button>
                        <IconButton icon="pencil" size={18} onPress={() => patch(row.key, { editing: true })} accessibilityLabel="Edit" />
                      </>
                    ) : (
                      <Button compact mode="contained" loading={row.busy} onPress={() => save(row)} accessibilityLabel="Save">Save</Button>
                    )}
                    <IconButton icon="delete-outline" size={18} iconColor={colors.error} onPress={() => remove(row)} accessibilityLabel="Delete" />
                  </View>
                  {row.player ? <Text variant="labelSmall" style={styles.meta}>Player ID {row.player.playerCode ?? '—'} · Unregistered</Text> : null}
                  {row.error ? <Text variant="labelSmall" style={[styles.meta, { color: isNotReadyMessage(row.error) ? colors.onSurfaceVariant : colors.error }]}>{row.error}</Text> : null}
                </View>
              );
            })}
            <Text variant="bodySmall" style={[styles.note, { color: colors.onSurfaceVariant }]}>
              Saved players go into My players right away with their own player ID. After you start the game, open the ⋮ menu and tap Register players so they can download the app and see their games.
            </Text>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Text variant="labelMedium" style={styles.flex}>{savedCount} saved</Text>
          <Button onPress={onClose}>Done</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '92%' },
  title: { marginBottom: 0 },
  area: { paddingHorizontal: spacing.md },
  heading: { marginVertical: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, padding: 6, marginBottom: spacing.sm },
  num: { width: 14 },
  input: { flex: 1, minWidth: 90 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  meta: { width: '100%', paddingLeft: 20 },
  note: { marginVertical: spacing.sm },
  flex: { flex: 1, paddingLeft: spacing.md },
});
