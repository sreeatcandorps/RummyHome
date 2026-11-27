import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
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
import { assignInitials, normalizeInitials, splitInitials } from '@/utils/initials';
import {
  ADD_MORE_LABEL,
  ADD_SUBLINE,
  backNeedsDialog,
  DISCARD_LABEL,
  DONE_LABEL,
  hiddenRowsLine,
  initialsChanged,
  isHalf,
  isReady,
  KEYBOARD_SAVE_LABEL,
  needsNewRow,
  oneChar,
  ONE_LETTER_NOTE,
  predictRows,
  readyLine,
  readyRows,
  savedHeading,
  savedNote,
  saveButtonLabel,
  scrollTargetFor,
  seatedLine,
  typedOf,
  typingNote,
  unsavedBody,
  unsavedSaveLabel,
  unsavedTitle,
} from '@/utils/addByInitials';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { playerIdBadge } from '@/utils/myPlayersList';
import { DraftPick, newGameDraft } from '@/utils/newGameDraft';
import { SelectedPlayersStrip } from '@/components/players/SelectedPlayersStrip';
import { BottomBar } from '@/components/ui/BottomBar';
import { HelpButton } from '@/components/ui/HelpButton';
import { InfoTip } from '@/components/ui/InfoTip';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type Row = {
  key: string;
  /** Box 1: one letter. */
  first: string;
  /** Box 2: one letter or digit. */
  last: string;
  error?: string;
};

type Saved = {
  key: string;
  player: Player;
  /** What was typed (SK) and what the database stored (SK, or SK2 on a clash). */
  typed: string;
  initials: string;
  /** Who in My players already had the typed letters. */
  takenBy: string | null;
  error?: string;
};

export const ADD_PLAYERS_TITLE = 'Add by initials';
/** The ⓘ title; the screen itself opens on the one-line subline (D112 picture). */
export const ADD_PLAYERS_HEADING = 'Add new players by initials';
export const EDIT_NOTE = 'After Save, Edit lets you type any free 2–3 characters; the first must be a letter. Remove takes a player out of this game; they stay in My players.';
const BACK_NOTE = 'Back without Save asks once: save the typed players, or discard them. A row with one letter is left out.';

let rowSeq = 0;
const blank = (): Row => ({ key: `row-${Date.now()}-${rowSeq++}`, first: '', last: '' });

const androidKeyboardSave = Platform.OS === 'android' ? { returnKeyLabel: KEYBOARD_SAVE_LABEL } : {};

/**
 * Add players by initials (D112, design-review-2 §8.3a). Rows on top, the keyboard below: one
 * character per box, the cursor moves on by itself and a new row appears when the last fills.
 * One Save (the keyboard's own key, or the bar riding on the keyboard) saves every row with both
 * letters; then a list of who was saved, each with Edit and Remove, and one Done back. A new
 * player shows only its letters; the only name shown is someone in My players with the same ones.
 */
export default function AddPlayersScreen() {
  const { colors } = useAppTheme();
  const { gutterLeft, gutterRight } = useLayout();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromNewGame = params.from === 'new-game';
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(() => [blank()]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [phase, setPhase] = useState<'typing' | 'saved'>('typing');
  const [saving, setSaving] = useState(false);
  const [seated, setSeated] = useState<DraftPick[]>(() => (fromNewGame ? newGameDraft.get() : []));
  /** The owner's My players after each save: who has which initials, for the clash line and the editor. */
  const [mine, setMine] = useState<Player[]>([]);
  const [editEntry, setEditEntry] = useState<Saved | null>(null);
  const [savingInitials, setSavingInitials] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [hiddenLine, setHiddenLine] = useState<string | null>(null);
  const [topY, setTopY] = useState(0);

  // The New game behind us owns the seats; we show and edit the same list.
  useEffect(() => {
    if (!fromNewGame) return;
    setSeated(newGameDraft.get());
    return newGameDraft.subscribe(setSeated);
  }, [fromNewGame]);

  const leaving = useRef(false);
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const firstInputs = useRef<Record<string, NativeTextInput | null>>({});
  const lastInputs = useRef<Record<string, NativeTextInput | null>>({});
  const pendingFocus = useRef<string | null>(null);
  const rowLayouts = useRef<Record<string, { y: number; h: number }>>({});
  const cardY = useRef(0);
  const viewport = useRef(0);
  const offset = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const focusedRef = useRef(focusedKey);
  focusedRef.current = focusedKey;

  // The cursor starts in row 1's first box. Android ignores autoFocus on a screen that mounts mid-transition.
  useEffect(() => {
    const timer = setTimeout(() => firstInputs.current[rows[0]?.key]?.focus(), Platform.OS === 'web' ? 0 : 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The cursor moves on by itself: a filled box hands focus to the next one, once it is on screen.
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key || phase !== 'typing') return;
    pendingFocus.current = null;
    firstInputs.current[key]?.focus();
  }, [rows, phase]);

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

  const initialsOf = useMemo(
    () => assignInitials(mine.map((player) => ({ id: player.id, name: player.name, initials: player.initials, addedAt: player.addedAt }))),
    [mine],
  );
  const taken = useMemo(
    () => new Map(mine.map((player) => [initialsOf.get(player.id) ?? '', player.name] as const).filter(([label]) => label)),
    [mine, initialsOf],
  );
  const takenFor = (except: Player) => new Map(mine.filter((player) => player.id !== except.id).map((player) => [initialsOf.get(player.id) ?? '', player.name] as const).filter(([label]) => label));

  const leave = useCallback(() => {
    leaving.current = true;
    if (ownerId) playersService.listMyPlayers(ownerId, { fresh: true }).catch(() => {});
    router.back();
  }, [ownerId]);

  // ← and Android back ask once, only while typed rows are unsaved (D112; D97's dialog is superseded).
  const shouldAsk = () => phaseRef.current === 'typing' && backNeedsDialog(rowsRef.current);
  const backRef = useRef<() => void>(() => {});
  backRef.current = () => (shouldAsk() ? setUnsavedOpen(true) : leave());
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (leaving.current) return;
      if (!shouldAsk()) {
        leaving.current = true;
        return;
      }
      event.preventDefault();
      Keyboard.dismiss();
      setUnsavedOpen(true);
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: ADD_PLAYERS_TITLE,
      headerBackVisible: false,
      headerLeft: () => <IconButton icon="arrow-left" onPress={() => backRef.current()} accessibilityLabel="Back" testID="add-players-back" />,
      gestureEnabled: true,
      headerRight: () => <HelpButton topic="add-players" />,
    });
  }, [navigation]);

  const patch = useCallback((key: string, next: Partial<Row>) => {
    setRows((all) => all.map((row) => (row.key === key ? { ...row, ...next } : row)));
  }, []);

  // ---- Keep the row being typed just above the Save bar; say when earlier rows are out of view ----
  const keepInView = useCallback((key: string | null) => {
    const layout = key ? rowLayouts.current[key] : undefined;
    if (!layout || !viewport.current) return;
    const target = scrollTargetFor(cardY.current + layout.y + layout.h + spacing.sm, viewport.current, offset.current);
    if (target != null) scrollRef.current?.scrollTo({ y: target, animated: true });
  }, []);
  const updateHidden = useCallback(() => {
    const hidden: string[] = [];
    for (const row of rowsRef.current) {
      const layout = rowLayouts.current[row.key];
      if (!layout || cardY.current + layout.y + layout.h > offset.current + 1) break;
      hidden.push(typedOf(row) || '·');
    }
    setHiddenLine(hiddenRowsLine(hidden));
  }, []);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    updateHidden();
  };
  const onRowLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    rowLayouts.current[key] = { y, h: height };
    if (key === focusedRef.current || key === pendingFocus.current) keepInView(key);
  };

  // ---- Typing ----
  const typedFirst = (row: Row, text: string) => {
    const first = oneChar(text);
    if (first && !/^[A-Z]$/.test(first)) {
      patch(row.key, { first: '', error: 'The first character must be a letter, A to Z.' });
      return;
    }
    patch(row.key, { first, error: undefined });
    if (first) lastInputs.current[row.key]?.focus();
  };
  const typedLast = (row: Row, text: string) => {
    const last = oneChar(text);
    if (last && !/^[A-Z0-9]$/.test(last)) {
      patch(row.key, { last: '', error: 'Letters and digits only.' });
      return;
    }
    setRows((all) => {
      let next = all.map((item) => (item.key === row.key ? { ...item, last, error: undefined } : item));
      if (needsNewRow(next)) next = [...next, blank()];
      if (last) {
        const after = next[next.findIndex((item) => item.key === row.key) + 1];
        if (after) pendingFocus.current = after.key;
      }
      return next;
    });
  };

  // Backspace in an empty box walks back: box 2 → box 1 (cleared); row n box 1 → row n−1 box 2.
  const backspaceFrom = (row: Row, cell: 'first' | 'last', index: number) => (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key !== 'Backspace') return;
    if (cell === 'last') {
      if (row.last) return;
      patch(row.key, { first: '', error: undefined });
      firstInputs.current[row.key]?.focus();
      return;
    }
    if (row.first || index === 0) return;
    const above = rows[index - 1];
    if (above) lastInputs.current[above.key]?.focus();
  };

  const focusOpenRow = () => {
    const open = rowsRef.current.find((row) => !isReady(row));
    if (open) setTimeout(() => (open.first ? lastInputs : firstInputs).current[open.key]?.focus(), 100);
  };

  // ---- Save: every ready row, one after another, so two SKs in one batch become SK and SK2 ----
  const saveAll = async (): Promise<boolean> => {
    if (saving) return false;
    const ready = readyRows(rowsRef.current);
    if (ready.length === 0) return false;
    if (!ownerId) {
      setRows((all) => all.map((row) => (isReady(row) ? { ...row, error: 'Not signed in.' } : row)));
      return false;
    }
    setSaving(true);
    const made: Saved[] = [];
    const failed = new Map<string, string>();
    for (const row of ready) {
      try {
        const result = await playerIdentityService.createPlayerByInitials(ownerId, typedOf(row));
        if (fromNewGame) newGameDraft.add({ id: result.player.id, name: result.player.name, playerCode: result.player.playerCode });
        made.push({ key: row.key, player: result.player, typed: result.typed, initials: result.initials, takenBy: result.takenBy });
      } catch (err) {
        failed.set(row.key, formatSupabaseError(err));
      }
    }
    const madeKeys = new Set(made.map((entry) => entry.key));
    setMine((cur) => [...cur, ...made.filter((entry) => !cur.some((p) => p.id === entry.player.id)).map((entry) => ({ ...entry.player, initials: entry.initials }))]);
    setSaved((cur) => [...cur, ...made]);
    setRows((all) => {
      let next = all.filter((row) => !madeKeys.has(row.key)).map((row) => (failed.has(row.key) ? { ...row, error: failed.get(row.key) } : row));
      if (next.length === 0 || needsNewRow(next)) next = [...next, blank()];
      return next;
    });
    setSaving(false);
    if (failed.size > 0) return false;
    Keyboard.dismiss();
    setHiddenLine(null);
    setPhase('saved');
    return true;
  };

  const addMore = () => {
    setPhase('typing');
    focusOpenRow();
  };

  // ---- After Save: Edit and Remove ----
  const removeSaved = async (entry: Saved) => {
    const drop = () => {
      setSaved((cur) => cur.filter((item) => item.key !== entry.key));
      if (saved.every((item) => item.key === entry.key)) addMore();
    };
    // From a game, Remove only takes the seat back; the player stays in My players.
    if (fromNewGame) {
      newGameDraft.remove(entry.player.id);
      drop();
      return;
    }
    if (!ownerId) return;
    setRemovingKey(entry.key);
    try {
      await playersService.removeMyPlayer(ownerId, entry.player.id);
      setMine((cur) => cur.filter((item) => item.id !== entry.player.id));
      drop();
    } catch (err) {
      setSaved((cur) => cur.map((item) => (item.key === entry.key ? { ...item, error: err instanceof Error ? err.message : formatSupabaseError(err) } : item)));
    } finally {
      setRemovingKey(null);
    }
  };

  const saveInitials = async (value: string) => {
    if (!editEntry || !ownerId) return;
    const { player } = editEntry;
    setSavingInitials(true);
    try {
      const stored = await playerIdentityService.setInitialsAndName(ownerId, player, editEntry.initials, value);
      await refreshMine(ownerId);
      const renamed = player.name === editEntry.initials ? { ...player, name: stored, firstName: stored } : player;
      if (fromNewGame && renamed !== player) newGameDraft.add({ id: renamed.id, name: renamed.name, playerCode: renamed.playerCode });
      setSaved((cur) => cur.map((item) => (item.key === editEntry.key ? { ...item, player: renamed, typed: stored, initials: stored, takenBy: null, error: undefined } : item)));
      setEditEntry(null);
    } catch (err) {
      setSaved((cur) => cur.map((item) => (item.key === editEntry.key ? { ...item, error: err instanceof Error ? err.message : formatSupabaseError(err) } : item)));
      setEditEntry(null);
    } finally {
      setSavingInitials(false);
    }
  };

  const predictions = predictRows(rows, taken);
  const ready = readyRows(rows);
  const readyLabels = ready.map(typedOf);
  const halfLabels = rows.filter(isHalf).map((row) => normalizeInitials(row.first || row.last));
  const savedIds = new Set(saved.map((entry) => entry.player.id));
  const freshSeated = seated.filter((pick) => savedIds.has(pick.id)).length;

  const cell = (row: Row, which: 'first' | 'last', index: number) => {
    const border = row.error ? colors.error : colors.leader;
    return (
      <TextInput
        mode="outlined"
        dense
        value={which === 'first' ? row.first : row.last}
        disabled={saving}
        onChangeText={(text) => (which === 'first' ? typedFirst(row, text) : typedLast(row, text))}
        onKeyPress={backspaceFrom(row, which, index)}
        onFocus={() => { setFocusedKey(row.key); keepInView(row.key); }}
        style={[styles.cell, { backgroundColor: colors.leaderContainer }]}
        outlineStyle={{ borderColor: border, borderWidth: 2 }}
        contentStyle={styles.cellText}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={1}
        returnKeyType="done"
        {...androidKeyboardSave}
        blurOnSubmit={false}
        onSubmitEditing={() => { saveAll().catch(() => {}); }}
        ref={(ref: NativeTextInput | null) => { (which === 'first' ? firstInputs : lastInputs).current[row.key] = ref; }}
        accessibilityLabel={`Row ${index + 1} ${which} initial`}
      />
    );
  };

  return (
    <View
      ref={rootRef}
      onLayout={() => rootRef.current?.measureInWindow((_x, y) => setTopY(y))}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={topY}>
        {phase === 'typing' ? (
          <>
            {hiddenLine ? (
              <View style={[styles.hiddenLine, { backgroundColor: colors.winContainer, marginLeft: gutterLeft, marginRight: gutterRight }]} testID="add-players-hidden-rows">
                <Text variant="labelMedium" style={{ color: colors.win }}>{hiddenLine}</Text>
              </View>
            ) : null}
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={32}
              onLayout={(event) => { viewport.current = event.nativeEvent.layout.height; keepInView(focusedRef.current); }}
              contentContainerStyle={[styles.content, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}
            >
              <View style={styles.headingRow}>
                <Text variant="bodyMedium" style={[styles.subline, { color: colors.onSurfaceVariant }]}>{ADD_SUBLINE}</Text>
                <InfoTip title={ADD_PLAYERS_HEADING} text={[EDIT_NOTE, BACK_NOTE]} topic="add-players" anchor="add-by-initials" testID="add-players-tip" />
              </View>
              <View onLayout={(event) => { cardY.current = event.nativeEvent.layout.y; }} style={styles.typingRows}>
                {rows.map((row, index) => {
                  const prediction = predictions[index];
                  const changed = prediction ? prediction.stored !== prediction.typed : false;
                  const note = prediction ? typingNote(prediction) : isHalf(row) && row.key !== focusedKey ? ONE_LETTER_NOTE : null;
                  return (
                    <View key={row.key} onLayout={onRowLayout(row.key)} style={styles.row}>
                      <View style={styles.line}>
                        {cell(row, 'first', index)}
                        {cell(row, 'last', index)}
                        <View style={styles.middle}>
                          {note ? (
                            <Text variant="bodySmall" style={{ color: changed ? colors.leader : colors.onSurfaceVariant }} testID={`add-players-note-${index + 1}`}>
                              {note}
                            </Text>
                          ) : null}
                        </View>
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
            </ScrollView>
            <BottomBar testID="add-players-save-bar">
              <Text variant="titleSmall" style={styles.count} testID="add-players-count">{readyLine(ready.length, halfLabels.length)}</Text>
              <Button
                mode="contained"
                onPress={() => { saveAll().catch(() => {}); }}
                loading={saving}
                disabled={saving || ready.length === 0}
                style={styles.primary}
                contentStyle={styles.primaryContent}
                labelStyle={styles.primaryLabel}
                accessibilityLabel={saveButtonLabel(ready.length)}
                testID="add-players-save"
              >
                {saveButtonLabel(ready.length)}
              </Button>
            </BottomBar>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={[styles.content, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
              <Text variant="titleMedium" style={[styles.heading, { color: colors.win }]} accessibilityRole="header" testID="add-players-saved-heading">
                ✓ {savedHeading(saved.length, fromNewGame)}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]} testID="add-players-saved-list">
                {saved.map((entry, index) => {
                  const changed = initialsChanged(entry);
                  const label = splitInitials(entry.initials);
                  const badge = playerIdBadge(entry.player);
                  return (
                    <View key={entry.key} style={[styles.savedRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineVariant }]}>
                      <View style={styles.line}>
                        <View style={[styles.mark, { backgroundColor: changed ? colors.leaderContainer : colors.winContainer }]}>
                          <Text style={[styles.markText, { color: changed ? colors.leader : colors.win }]}>{changed ? '!' : '✓'}</Text>
                        </View>
                        <View accessible accessibilityLabel={`Saved ${entry.initials}`} style={styles.savedLabel}>
                          <Text variant="titleMedium" style={styles.label}>
                            {label.letters}
                            {label.digits ? <Text variant="titleMedium" style={[styles.label, { color: colors.error }]}>{label.digits}</Text> : null}
                          </Text>
                        </View>
                        <View style={styles.middle}>
                          <Text variant="bodySmall" style={{ color: changed ? colors.leader : colors.onSurfaceVariant }}>{savedNote(entry)}</Text>
                          {badge ? <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>{badge}</Text> : null}
                        </View>
                        <Button mode="text" compact onPress={() => setEditEntry(entry)} disabled={removingKey === entry.key} accessibilityLabel={`Edit initials for ${entry.initials}`}>
                          Edit
                        </Button>
                        <Button
                          mode="text"
                          compact
                          textColor={colors.error}
                          loading={removingKey === entry.key}
                          disabled={removingKey === entry.key}
                          onPress={() => { removeSaved(entry).catch(() => {}); }}
                          accessibilityLabel={`Remove ${entry.initials} from ${fromNewGame ? 'this game' : 'My players'}`}
                        >
                          Remove
                        </Button>
                      </View>
                      {entry.error ? <Text variant="labelSmall" style={{ color: colors.error }}>{entry.error}</Text> : null}
                    </View>
                  );
                })}
              </View>
              {fromNewGame ? (
                <>
                  <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="add-players-seated-line">{seatedLine(seated.length, freshSeated)}</Text>
                  <SelectedPlayersStrip
                    picks={seated}
                    meId={ownerId}
                    newIds={savedIds}
                    onRemove={(id) => {
                      const entry = saved.find((item) => item.player.id === id);
                      if (entry) removeSaved(entry).catch(() => {});
                      else newGameDraft.remove(id);
                    }}
                  />
                </>
              ) : null}
            </ScrollView>
            <BottomBar testID="add-players-done-bar">
              <Button mode="text" onPress={addMore} accessibilityLabel="Add more players by initials" testID="add-players-add-more">
                {ADD_MORE_LABEL}
              </Button>
              <View style={styles.spacer} />
              <Button
                mode="contained"
                onPress={leave}
                disabled={removingKey != null}
                style={styles.primary}
                contentStyle={styles.primaryContent}
                labelStyle={styles.primaryLabel}
                accessibilityLabel="Done adding players"
                testID="add-players-done"
              >
                {DONE_LABEL}
              </Button>
            </BottomBar>
          </>
        )}
      </KeyboardAvoidingView>

      <Portal>
        {editEntry ? (
          <InitialsDialog
            name={editEntry.player.name}
            current={editEntry.initials ?? initialsOf.get(editEntry.player.id)}
            taken={takenFor(editEntry.player)}
            scope="my-players"
            busy={savingInitials}
            onDismiss={() => setEditEntry(null)}
            onSave={saveInitials}
          />
        ) : null}
        <Dialog visible={unsavedOpen} onDismiss={() => setUnsavedOpen(false)} style={{ backgroundColor: colors.surface }}>
          <Dialog.Title testID="add-players-unsaved-title">{unsavedTitle(readyLabels)}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" testID="add-players-unsaved">{unsavedBody(halfLabels)}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              textColor={colors.error}
              disabled={saving}
              onPress={() => { setUnsavedOpen(false); leave(); }}
              accessibilityLabel="Discard the typed players and go back"
              testID="add-players-discard"
            >
              {DISCARD_LABEL}
            </Button>
            <Button
              mode="contained"
              loading={saving}
              disabled={saving || readyLabels.length === 0}
              onPress={async () => {
                const ok = await saveAll();
                setUnsavedOpen(false);
                if (ok) leave();
              }}
              accessibilityLabel={unsavedSaveLabel(readyLabels)}
              testID="add-players-unsaved-save"
            >
              {unsavedSaveLabel(readyLabels)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  subline: { flex: 1 },
  heading: { fontWeight: '800' },
  hiddenLine: { marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg },
  typingRows: { gap: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
  row: { paddingVertical: spacing.xs, gap: 4 },
  savedRow: { paddingVertical: spacing.xs, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cell: { width: 56, height: 56 },
  cellText: { textAlign: 'center', fontSize: 24, fontWeight: '700', letterSpacing: 1 },
  middle: { flex: 1, minWidth: 0, paddingLeft: spacing.sm },
  mark: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 15, fontWeight: '800' },
  savedLabel: { minWidth: 48, paddingLeft: spacing.xs },
  label: { fontWeight: '800', letterSpacing: 1 },
  count: { flex: 1, fontWeight: '700' },
  spacer: { flex: 1 },
  primary: { borderRadius: radius.full },
  primaryContent: { height: 52, paddingHorizontal: spacing.sm },
  primaryLabel: { fontSize: 17, fontWeight: '800' },
});
