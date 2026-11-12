import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput as NativeTextInput, View } from 'react-native';
import { Icon, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playerIdentityService } from '@/services/playerIdentity';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { validateInitials } from '@/utils/playerIdentity';
import { playersService } from '@/services/players';
import { assignInitials, defaultInitials } from '@/utils/initials';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { playerIdBadge } from '@/utils/myPlayersList';
import { DraftPick, newGameDraft } from '@/utils/newGameDraft';
import { SelectedPlayersStrip } from '@/components/players/SelectedPlayersStrip';
import { HELP } from '@/constants/help';
import { HelpButton } from '@/components/ui/HelpButton';
import { BottomBar } from '@/components/ui/BottomBar';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type Row = { key: string; first: string; last: string; player?: Player; editing: boolean; busy: boolean; error?: string };

export const DEFAULT_NEW_PLAYER_ROWS = 3;
let rowSeq = 0;
const blank = (): Row => ({ key: `row-${Date.now()}-${rowSeq++}`, first: '', last: '', editing: true, busy: false });

/**
 * A full screen, not a sheet: nothing behind it can be tapped and the only way
 * out is Done. Each row saves on its own; saved people are already in My players
 * (and seated in the new game when we came from there).
 */
export default function AddPlayersScreen() {
  const { colors } = useAppTheme();
  const { gutterLeft, gutterRight } = useLayout();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromNewGame = params.from === 'new-game';
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: DEFAULT_NEW_PLAYER_ROWS }, blank));
  const [seated, setSeated] = useState<DraftPick[]>(() => (fromNewGame ? newGameDraft.get() : []));
  /** The owner's My players after each save: stored initials (022) for the saved rows, and who has which letters. */
  const [mine, setMine] = useState<Player[]>([]);
  const [editInitials, setEditInitials] = useState<Player | null>(null);
  const [savingInitials, setSavingInitials] = useState(false);

  // The New game behind us owns the seats; we show and edit the same list.
  useEffect(() => {
    if (!fromNewGame) return;
    setSeated(newGameDraft.get());
    return newGameDraft.subscribe(setSeated);
  }, [fromNewGame]);
  const leaving = useRef(false);
  const firstInputs = useRef<Record<string, NativeTextInput | null>>({});
  const lastInputs = useRef<Record<string, NativeTextInput | null>>({});

  // The cursor starts in row 1's first initial. Android ignores autoFocus on a screen that mounts mid-transition.
  useEffect(() => {
    const timer = setTimeout(() => firstInputs.current[rows[0]?.key]?.focus(), Platform.OS === 'web' ? 0 : 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMine = useCallback(async (id: string) => {
    const list = await playersService.listMyPlayers(id, { fresh: true }).catch(() => null);
    if (list) setMine(list);
  }, []);

  useEffect(() => {
    (async () => {
      const id = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      setOwnerId(id);
      if (id) await refreshMine(id);
    })().catch(() => {});
  }, [refreshMine]);

  // Back gestures, the hardware back button, and header taps all come through here.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (leaving.current) return;
      event.preventDefault();
    });
    return unsubscribe;
  }, [navigation]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Add New Players by Initials',
      headerBackVisible: false,
      headerLeft: () => null,
      gestureEnabled: false,
      headerRight: () => <HelpButton text={HELP.addPlayers} />,
    });
  }, [navigation]);

  const patch = useCallback((key: string, next: Partial<Row>) => {
    setRows((all) => all.map((row) => (row.key === key ? { ...row, ...next } : row)));
  }, []);

  // Digits are refused the moment they are typed, not only on Save.
  const typed = (row: Row, next: { first?: string; last?: string }) => {
    const first = next.first ?? row.first;
    const last = next.last ?? row.last;
    const digit = /^\d/.test(first.trim()) || /^\d/.test(last.trim());
    patch(row.key, { ...next, error: digit ? validateInitials(first.trim() || 'x', last.trim() || 'x') ?? undefined : undefined });
  };

  const save = async (row: Row) => {
    const problem = validateInitials(row.first, row.last);
    if (problem) {
      patch(row.key, { error: problem });
      return;
    }
    if (!ownerId) {
      patch(row.key, { error: 'Not signed in.' });
      return;
    }
    patch(row.key, { busy: true, error: undefined });
    try {
      const player = row.player
        ? await playerIdentityService.updateNewPlayer(ownerId, row.player.id, row.first, row.last)
        : await playerIdentityService.createNewPlayer(ownerId, row.first, row.last);
      if (fromNewGame) newGameDraft.add({ id: player.id, name: player.name, playerCode: player.playerCode });
      refreshMine(ownerId).catch(() => {});
      // Keep typing: the cursor moves to the next open row, and a new row appears when every row is saved.
      setRows((all) => {
        const next = all.map((item) => (item.key === row.key ? { ...item, player, editing: false, busy: false } : item));
        const open = next.find((item) => !item.player || item.editing);
        if (open) {
          setTimeout(() => firstInputs.current[open.key]?.focus(), 50);
          return next;
        }
        const fresh = blank();
        setTimeout(() => firstInputs.current[fresh.key]?.focus(), 50);
        return [...next, fresh];
      });
    } catch (err) {
      patch(row.key, { busy: false, error: formatSupabaseError(err) });
    }
  };

  const remove = async (row: Row) => {
    if (row.player && ownerId) {
      patch(row.key, { busy: true, error: undefined });
      try {
        await playerIdentityService.deleteNewPlayer(ownerId, row.player.id);
        if (fromNewGame) newGameDraft.remove(row.player.id);
      } catch (err) {
        patch(row.key, { busy: false, error: formatSupabaseError(err) });
        return;
      }
    }
    setRows((all) => (all.length === 1 ? [blank()] : all.filter((item) => item.key !== row.key)));
  };

  const done = () => {
    leaving.current = true;
    router.back();
  };

  const savedRows = rows.filter((row) => row.player && !row.editing);
  // Stored initials from My players (the database picked a unique default); derived the same way until the list arrives.
  const initialsOf = assignInitials(mine.map((player) => ({ id: player.id, name: player.name, initials: player.initials, addedAt: player.addedAt })));
  const labelFor = (key: string) => {
    const row = savedRows.find((item) => item.key === key);
    return row?.player ? initialsOf.get(row.player.id) ?? defaultInitials(row.player.name) : '';
  };
  /** Three letters instead of two: someone already in My players has the short form. */
  const clashNote = (player: Player) => {
    const label = initialsOf.get(player.id);
    const short = defaultInitials(player.name);
    if (!label || label === short) return null;
    const holder = mine.find((other) => other.id !== player.id && initialsOf.get(other.id) === short);
    return holder ? `${short} is ${holder.name}, so ${player.name.split(' ')[0]} is ${label}.` : `${player.name.split(' ')[0]} is ${label}.`;
  };
  const takenFor = (except: Player) => new Map(mine.filter((player) => player.id !== except.id).map((player) => [initialsOf.get(player.id) ?? '', player.name] as const).filter(([label]) => label));
  const savedCount = savedRows.length;

  const saveInitials = async (value: string) => {
    if (!editInitials || !ownerId) return;
    setSavingInitials(true);
    try {
      await playersService.setInitials(ownerId, editInitials.id, value);
      await refreshMine(ownerId);
      setEditInitials(null);
    } catch (err) {
      setRows((all) => all.map((row) => (row.player?.id === editInitials.id ? { ...row, error: err instanceof Error ? err.message : formatSupabaseError(err) } : row)));
      setEditInitials(null);
    } finally {
      setSavingInitials(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}
      >
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Type the first initial and the last initial for each person, then Save. More letters are fine. The last initial cannot be a number. A new row appears when these are saved.
        </Text>

        {rows.map((row, index) => {
          const saved = Boolean(row.player) && !row.editing;
          const badge = row.player ? playerIdBadge(row.player) : null;
          return (
            <View
              key={row.key}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: saved ? colors.win : colors.outlineVariant },
              ]}
            >
              <View style={styles.line}>
                <Text variant="labelLarge" style={[styles.num, { color: colors.onSurfaceVariant }]}>{index + 1}</Text>
                <TextInput
                  mode="outlined"
                  dense
                  value={row.first}
                  placeholder="A"
                  placeholderTextColor={colors.outlineVariant}
                  disabled={saved || row.busy}
                  onChangeText={(first) => typed(row, { first })}
                  style={styles.input}
                  contentStyle={styles.inputText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => lastInputs.current[row.key]?.focus()}
                  ref={(ref: NativeTextInput | null) => { firstInputs.current[row.key] = ref; }}
                  accessibilityLabel={`Row ${index + 1} first initial`}
                />
                <TextInput
                  mode="outlined"
                  dense
                  value={row.last}
                  placeholder="B"
                  placeholderTextColor={colors.outlineVariant}
                  disabled={saved || row.busy}
                  onChangeText={(last) => typed(row, { last })}
                  style={styles.input}
                  contentStyle={styles.inputText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                  returnKeyType="done"
                  onSubmitEditing={() => save(row)}
                  ref={(ref: NativeTextInput | null) => { lastInputs.current[row.key] = ref; }}
                  accessibilityLabel={`Row ${index + 1} last initial`}
                />
                <View style={styles.actions}>
                  {saved ? (
                    <>
                      <View style={[styles.savedPill, { backgroundColor: colors.positiveContainer }]} accessibilityLabel={`Saved ${labelFor(row.key)}`}>
                        <Icon source="check" size={16} color={colors.onPositiveContainer} />
                        <Text variant="labelMedium" style={{ color: colors.onPositiveContainer }}>Saved</Text>
                      </View>
                      <IconButton icon="pencil-outline" size={18} style={styles.iconButton} onPress={() => patch(row.key, { editing: true })} accessibilityLabel={`Edit row ${index + 1}`} />
                    </>
                  ) : (
                    <Button
                      mode="contained"
                      compact
                      loading={row.busy}
                      disabled={row.busy}
                      onPress={() => save(row)}
                      style={styles.saveButton}
                      accessibilityLabel={`Save row ${index + 1}`}
                    >
                      Save
                    </Button>
                  )}
                  <IconButton icon="delete-outline" size={18} style={styles.iconButton} iconColor={colors.error} disabled={row.busy} onPress={() => remove(row)} accessibilityLabel={`Delete row ${index + 1}`} />
                </View>
              </View>
              {row.player ? (
                <Text variant="labelSmall" style={[styles.meta, { color: colors.onSurfaceVariant }]}>
                  {[saved ? labelFor(row.key) : null, badge ?? 'Player ID pending', 'Unregistered'].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {row.player && saved && clashNote(row.player) ? (
                <View style={styles.clash}>
                  <Icon source="information-outline" size={14} color={colors.onSurfaceVariant} />
                  <Text variant="labelSmall" style={[styles.flex, { color: colors.onSurfaceVariant }]}>{clashNote(row.player)}</Text>
                  <Button compact mode="text" onPress={() => setEditInitials(row.player!)} accessibilityLabel={`Edit initials for ${row.player.name}`}>Edit</Button>
                </View>
              ) : null}
              {row.error ? (
                <Text variant="labelSmall" style={[styles.meta, { color: isNotReadyMessage(row.error) ? colors.onSurfaceVariant : colors.error }]}>
                  {row.error}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Portal>
        {editInitials ? (
          <InitialsDialog
            name={editInitials.name}
            current={initialsOf.get(editInitials.id)}
            taken={takenFor(editInitials)}
            scope="my-players"
            busy={savingInitials}
            onDismiss={() => setEditInitials(null)}
            onSave={saveInitials}
          />
        ) : null}
      </Portal>

      <BottomBar>
        <View style={styles.footer}>
          {fromNewGame ? (
            <SelectedPlayersStrip
              picks={seated}
              meId={ownerId}
              onRemove={(id) => newGameDraft.remove(id)}
              title="Playing in this game"
              emptyText="Nobody seated yet. Saved players are seated as you go."
            />
          ) : (
            <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>
              {savedCount === 0 ? 'Nothing saved yet' : `${savedCount} saved`}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={done}
            style={styles.done}
            contentStyle={styles.doneContent}
            labelStyle={styles.doneLabel}
            accessibilityLabel="Done adding players"
          >
            Done
          </Button>
        </View>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  num: { width: 18, textAlign: 'center' },
  input: { width: 64, height: 44, backgroundColor: 'transparent' },
  inputText: { textAlign: 'center', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  actions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  saveButton: { minWidth: 72 },
  savedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: radius.full },
  iconButton: { margin: 0 },
  meta: { paddingLeft: 22 },
  clash: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 22 },
  flex: { flex: 1 },
  footer: { flex: 1, gap: spacing.sm },
  done: { borderRadius: radius.full },
  doneContent: { height: 60 },
  doneLabel: { fontSize: 18, fontWeight: '800' },
});
