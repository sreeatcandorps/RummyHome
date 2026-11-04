import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { Player } from '@/types/player';
import { playerIdentityService } from '@/services/playerIdentity';
import { chipInitials } from '@/utils/playerIdentity';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { spacing, useAppTheme } from '@/constants/theme';

type Row = { key: string; first: string; last: string; player?: Player; editing: boolean; busy: boolean; error?: string };

const blank = (i: number): Row => ({ key: `r${Date.now()}-${i}`, first: '', last: '', editing: true, busy: false });

/**
 * Sits at the top of the screen so the keyboard does not cover the rows.
 * Each row saves on its own. Done can be tapped at any time.
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
    if (!row.first.trim() || !row.last.trim()) {
      patch(row.key, { error: 'Type a first and last name.' });
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
      <Modal visible={visible} onDismiss={onClose} style={styles.overlay} contentContainerStyle={[styles.sheet, { backgroundColor: colors.surface }]}>
        <Text variant="titleLarge" style={styles.title}>Add new players</Text>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
          {rows.map((row, i) => {
            const saved = Boolean(row.player) && !row.editing;
            const shown = row.player ? chipInitials(row.player.name) : '';
            return (
              <View key={row.key} style={[styles.row, { borderColor: saved ? '#2E7D32' : colors.outlineVariant }]}>
                <Text variant="labelLarge" style={styles.num}>{i + 1}</Text>
                <TextInput dense mode="outlined" label="First name" value={row.first} disabled={saved || row.busy}
                  onChangeText={(first) => patch(row.key, { first })} style={styles.input} autoCapitalize="words" />
                <TextInput dense mode="outlined" label="Last name" value={row.last} disabled={saved || row.busy}
                  onChangeText={(last) => patch(row.key, { last })} style={styles.input} autoCapitalize="words" />
                <View style={styles.actions}>
                  {saved ? (
                    <>
                      <Button compact mode="contained" buttonColor="#2E7D32" icon="check" accessibilityLabel={`Saved ${shown}`}>Saved</Button>
                      <IconButton icon="pencil" size={18} onPress={() => patch(row.key, { editing: true })} accessibilityLabel="Edit" />
                    </>
                  ) : (
                    <Button compact mode="contained" loading={row.busy} onPress={() => save(row)} accessibilityLabel="Save">Save</Button>
                  )}
                  <IconButton icon="delete-outline" size={18} iconColor={colors.error} onPress={() => remove(row)} accessibilityLabel="Delete" />
                </View>
                {row.player ? <Text variant="labelSmall" style={styles.meta}>{shown} · Player ID {row.player.playerCode ?? '—'}</Text> : null}
                {row.error ? <Text variant="labelSmall" style={[styles.meta, { color: isNotReadyMessage(row.error) ? colors.onSurfaceVariant : colors.error }]}>{row.error}</Text> : null}
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <Text variant="labelMedium" style={styles.flex}>{savedCount} saved</Text>
          <Button onPress={onClose}>Done</Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: 'flex-start' },
  sheet: { marginTop: 12, marginHorizontal: 12, borderRadius: 16, maxHeight: '72%', paddingTop: spacing.sm },
  title: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  scroll: { paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, padding: 6, marginBottom: spacing.sm },
  num: { width: 14 },
  input: { flex: 1, minWidth: 90 },
  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  meta: { width: '100%', paddingLeft: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  flex: { flex: 1, paddingLeft: spacing.md },
});
