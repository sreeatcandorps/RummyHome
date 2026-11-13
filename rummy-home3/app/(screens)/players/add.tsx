import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput as NativeTextInput, View } from 'react-native';
import { Portal, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playerIdentityService } from '@/services/playerIdentity';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { playersService } from '@/services/players';
import {
  assignInitials,
  clashSentence,
  initialsCellsProblem,
  NEW_PLAYER_ROWS_MAX,
  normalizeInitials,
  splitInitials,
} from '@/utils/initials';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { playerIdBadge } from '@/utils/myPlayersList';
import { DraftPick, newGameDraft } from '@/utils/newGameDraft';
import { SelectedPlayersStrip } from '@/components/players/SelectedPlayersStrip';
import { HELP } from '@/constants/help';
import { HelpButton } from '@/components/ui/HelpButton';
import { BottomBar } from '@/components/ui/BottomBar';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type Row = {
  key: string;
  /** Cell 1: one letter. */
  first: string;
  /** Cell 2: one or two letters or digits. */
  last: string;
  player?: Player;
  /** What the database stored (SK, or SK2 on a clash). */
  initials?: string;
  /** Who already had the typed letters, for the sentence under the row. */
  takenBy?: string | null;
  busy: boolean;
  error?: string;
};

export const DEFAULT_NEW_PLAYER_ROWS = NEW_PLAYER_ROWS_MAX;
export const ADD_PLAYERS_TITLE = 'Add new players';
export const ADD_PLAYERS_HEADING = `Add new players by initials, ${NEW_PLAYER_ROWS_MAX} at a time`;
export const CELL_HINT = 'Cell 1: one letter, jumps on. Cell 2: one or two letters.';
export const NO_DELETE_NOTE = 'No delete here — remove a player from the previous screen. Edit lets you type any free 2–3 characters; the first must be a letter.';

let rowSeq = 0;
const blank = (): Row => ({ key: `row-${Date.now()}-${rowSeq++}`, first: '', last: '', busy: false });

/**
 * Add new players by initials (PR 6). Three rows per visit, no more: cell 1 takes one
 * letter and jumps on, cell 2 one or two letters or digits; the initials are the player's
 * name (D6.2). When the letters are already someone's in My players the database stores
 * the first free digit form (SK → SK2) and the row says so. One Edit per row opens the
 * shared initials editor. Nothing behind this screen can be tapped; Done is the only exit.
 */
export default function AddPlayersScreen() {
  const { colors } = useAppTheme();
  const { gutterLeft, gutterRight } = useLayout();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromNewGame = params.from === 'new-game';
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: NEW_PLAYER_ROWS_MAX }, blank));
  const [seated, setSeated] = useState<DraftPick[]>(() => (fromNewGame ? newGameDraft.get() : []));
  /** The owner's My players after each save: who has which initials, for the editor. */
  const [mine, setMine] = useState<Player[]>([]);
  const [editRow, setEditRow] = useState<Row | null>(null);
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

  // The cursor starts in row 1's first cell. Android ignores autoFocus on a screen that mounts mid-transition.
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
      title: ADD_PLAYERS_TITLE,
      headerBackVisible: false,
      headerLeft: () => null,
      gestureEnabled: false,
      headerRight: () => <HelpButton text={HELP.addPlayers} />,
    });
  }, [navigation]);

  const patch = useCallback((key: string, next: Partial<Row>) => {
    setRows((all) => all.map((row) => (row.key === key ? { ...row, ...next } : row)));
  }, []);

  // Cell 1 keeps one character and jumps to cell 2 when it is a letter; a digit is refused at once.
  const typedFirst = (row: Row, text: string) => {
    const first = normalizeInitials(text).slice(-1);
    const error = first && !/^[A-Z]$/.test(first) ? initialsCellsProblem(first, row.last) ?? undefined : undefined;
    patch(row.key, { first, error });
    if (first && /^[A-Z]$/.test(first)) lastInputs.current[row.key]?.focus();
  };
  const typedLast = (row: Row, text: string) => {
    const last = normalizeInitials(text).slice(0, 2);
    const error = last && !/^[A-Z0-9]{1,2}$/.test(last) ? initialsCellsProblem(row.first || 'X', last) ?? undefined : undefined;
    patch(row.key, { last, error });
  };

  const save = async (row: Row) => {
    const problem = initialsCellsProblem(row.first, row.last);
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
      const made = await playerIdentityService.createPlayerByInitials(ownerId, row.first + row.last);
      if (fromNewGame) newGameDraft.add({ id: made.player.id, name: made.player.name, playerCode: made.player.playerCode });
      refreshMine(ownerId).catch(() => {});
      // Keep typing: the cursor moves to the next open row; there is no fourth row (3 at a time).
      setRows((all) => {
        const next = all.map((item) => (item.key === row.key ? { ...item, player: made.player, initials: made.initials, takenBy: made.takenBy, busy: false } : item));
        const open = next.find((item) => !item.player);
        if (open) setTimeout(() => firstInputs.current[open.key]?.focus(), 50);
        return next;
      });
    } catch (err) {
      patch(row.key, { busy: false, error: formatSupabaseError(err) });
    }
  };

  const done = () => {
    leaving.current = true;
    router.back();
  };

  const savedRows = rows.filter((row) => row.player);
  const savedCount = savedRows.length;
  const initialsOf = assignInitials(mine.map((player) => ({ id: player.id, name: player.name, initials: player.initials, addedAt: player.addedAt })));
  const takenFor = (except: Player) => new Map(mine.filter((player) => player.id !== except.id).map((player) => [initialsOf.get(player.id) ?? '', player.name] as const).filter(([label]) => label));

  const saveInitials = async (value: string) => {
    if (!editRow?.player || !ownerId) return;
    const { player } = editRow;
    setSavingInitials(true);
    try {
      const stored = await playerIdentityService.setInitialsAndName(ownerId, player, editRow.initials, value);
      await refreshMine(ownerId);
      const renamed = player.name === editRow.initials ? { ...player, name: stored, firstName: stored } : player;
      if (fromNewGame && renamed !== player) newGameDraft.add({ id: renamed.id, name: renamed.name, playerCode: renamed.playerCode });
      patch(editRow.key, { player: renamed, initials: stored, takenBy: null, error: undefined });
      setEditRow(null);
    } catch (err) {
      patch(editRow.key, { error: err instanceof Error ? err.message : formatSupabaseError(err) });
      setEditRow(null);
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
        <Text variant="titleMedium" style={styles.heading} accessibilityRole="header">{ADD_PLAYERS_HEADING}</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          {rows.map((row, index) => {
            const saved = Boolean(row.player);
            const label = row.initials ? splitInitials(row.initials) : null;
            const badge = row.player ? playerIdBadge(row.player) : null;
            const cellBorder = saved ? colors.outlineVariant : row.error ? colors.error : colors.leader;
            return (
              <View key={row.key} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant }]}>
                <View style={styles.line}>
                  <TextInput
                    mode="outlined"
                    dense
                    value={row.first}
                    disabled={saved || row.busy}
                    onChangeText={(text) => typedFirst(row, text)}
                    style={[styles.cell, !saved && { backgroundColor: colors.leaderContainer }]}
                    outlineStyle={{ borderColor: cellBorder, borderWidth: saved ? 1 : 2 }}
                    contentStyle={styles.cellText}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={1}
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
                    disabled={saved || row.busy}
                    onChangeText={(text) => typedLast(row, text)}
                    style={[styles.cell, styles.cellWide, !saved && { backgroundColor: colors.leaderContainer }]}
                    outlineStyle={{ borderColor: cellBorder, borderWidth: saved ? 1 : 2 }}
                    contentStyle={styles.cellText}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={2}
                    returnKeyType="done"
                    onSubmitEditing={() => save(row)}
                    ref={(ref: NativeTextInput | null) => { lastInputs.current[row.key] = ref; }}
                    accessibilityLabel={`Row ${index + 1} last initial`}
                  />
                  <View style={styles.middle}>
                    {saved && label ? (
                      <View accessibilityLabel={`Saved ${row.initials}`} accessible>
                        <Text variant="headlineSmall" style={styles.label}>
                          <Text variant="headlineSmall" style={[styles.label, { color: colors.win }]}>{label.letters}</Text>
                          {label.digits ? <Text variant="headlineSmall" style={[styles.label, { color: colors.error }]}>{label.digits}</Text> : null}
                        </Text>
                        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                          {row.takenBy ? clashSentence(row.first + row.last, row.takenBy, row.initials!) : 'Saved'}
                        </Text>
                        {badge ? <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>{badge} · Unregistered</Text> : null}
                      </View>
                    ) : (
                      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{CELL_HINT}</Text>
                    )}
                  </View>
                  {saved ? (
                    <Button mode="outlined" compact onPress={() => setEditRow(row)} style={styles.rowButton} accessibilityLabel={`Edit initials for ${row.player!.name}`}>
                      Edit
                    </Button>
                  ) : (
                    <Button
                      mode="contained"
                      compact
                      loading={row.busy}
                      disabled={row.busy}
                      onPress={() => save(row)}
                      style={styles.rowButton}
                      accessibilityLabel={`Save row ${index + 1}`}
                    >
                      Save
                    </Button>
                  )}
                </View>
                {row.error ? (
                  <Text variant="labelSmall" style={{ color: isNotReadyMessage(row.error) ? colors.onSurfaceVariant : colors.error }}>
                    {row.error}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{NO_DELETE_NOTE}</Text>
      </ScrollView>

      <Portal>
        {editRow?.player ? (
          <InitialsDialog
            name={editRow.player.name}
            current={editRow.initials ?? initialsOf.get(editRow.player.id)}
            taken={takenFor(editRow.player)}
            scope="my-players"
            busy={savingInitials}
            onDismiss={() => setEditRow(null)}
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
          ) : null}
          <Button
            mode="contained"
            onPress={done}
            style={styles.done}
            contentStyle={styles.doneContent}
            labelStyle={styles.doneLabel}
            accessibilityLabel="Done adding players"
          >
            {savedCount === 0 ? 'Done' : `Done · ${savedCount} added`}
          </Button>
        </View>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  heading: { fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
  row: { paddingVertical: spacing.sm, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cell: { width: 56, height: 56 },
  cellWide: { width: 72 },
  cellText: { textAlign: 'center', fontSize: 24, fontWeight: '700', letterSpacing: 1 },
  middle: { flex: 1, minWidth: 0, paddingLeft: spacing.xs },
  label: { fontWeight: '800', letterSpacing: 1 },
  rowButton: { minWidth: 72, borderRadius: radius.full },
  footer: { flex: 1, gap: spacing.sm },
  done: { borderRadius: radius.full },
  doneContent: { height: 60 },
  doneLabel: { fontSize: 18, fontWeight: '800' },
});
