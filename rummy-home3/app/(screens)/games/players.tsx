import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Menu, Portal, Text, TextInput } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';
import { HELP } from '@/constants/help';
import { useGameRoster } from '@/hooks/useGameRoster';
import { useLayout } from '@/hooks/useLayout';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { playerIdentityService } from '@/services/playerIdentity';
import { playersService } from '@/services/players';
import { Player } from '@/types/player';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { addAdminBlockedReason, addAdminPreview, addAdminProblem, PLAYERS_ADMINS_TITLE } from '@/utils/gameAdmins';
import { parsePlayerNo } from '@/utils/playerIdentity';
import { seatRemovalProblem } from '@/utils/seatRemoval';
import {
  linkLanding,
  linkTargetProblem,
  playerIdBadge,
  registrationLabel,
  SEAT_MENU_LABEL,
  seatMenu,
  SeatMenuItem,
  seatRoleLabel,
} from '@/utils/gamePlayers';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { Tag } from '@/components/ui/Tag';

type Sheet =
  | { kind: 'edit'; seat: Player }
  | { kind: 'invite'; seat: Player; message?: string; notice?: string }
  | { kind: 'link'; seat: Player }
  | { kind: 'add_admin' }
  | { kind: 'remove'; seat: Player }
  | { kind: 'remove_blocked'; message: string }
  | null;

/**
 * Players in this game as a full page (no stacked popups). Each seat shows the
 * name, Player ID, role and registration, and a ⋮ menu for admins. Adding happens
 * on the picker screen; removing is in the ⋮ menu (confirmed first, and only while
 * every round score the player has is 0).
 */
export default function GamePlayersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { insets } = useLayout();
  const { game, roster, canScore, loading, error, reload } = useGameRoster(typeof id === 'string' ? id : undefined);
  const [viewer, setViewer] = useState<Player | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Seats whose invite link was just made: shown as Pending registration at once, before the refetch lands.
  const [invited, setInvited] = useState<Set<string>>(new Set());

  useEffect(() => {
    authService.getCurrentPlayer().then((me) => setViewer(me ?? null)).catch(() => setViewer(null));
  }, []);

  // The share sheet sends the app to the background; refresh the roster when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);

  const playing = useMemo(() => roster.filter((seat) => seat.seatRole !== 'spectator' && seat.seated !== false && seat.id !== 'EX'), [roster]);
  const unseated = useMemo(() => roster.filter((seat) => seat.seated === false && seat.seatRole === 'game_admin'), [roster]);
  const watching = useMemo(() => roster.filter((seat) => seat.seatRole === 'spectator'), [roster]);
  const canReorder = Boolean(game) && Object.values(game?.scores ?? {}).every((column) => (column?.length ?? 0) === 0);

  const run = async (work: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    try {
      await work();
      await reload();
      after?.();
    } catch (caught) {
      setFailure(formatSupabaseError(caught));
    } finally {
      setBusy(false);
    }
  };

  /** The New game picker in add mode: current seats in the strip, Return to game seats the new ones. */
  const openAdd = () => game && router.push({ pathname: '/(screens)/games/new', params: { gameId: game.id } });

  const act = (item: SeatMenuItem, seat: Player) => {
    setMenuFor(null);
    if (!game) return;
    if (item === 'make_admin') run(() => gamesService.setSeatRole(game.id, seat.id, 'game_admin'));
    else if (item === 'remove_admin') run(() => gamesService.setSeatRole(game.id, seat.id, 'player'));
    else if (item === 'edit_name') setSheet({ kind: 'edit', seat });
    else if (item === 'invite') setSheet({ kind: 'invite', seat });
    else if (item === 'link_id') setSheet({ kind: 'link', seat });
    else if (item === 'remove_player') {
      // Same rule as the picker's ×: no scores, or every round score exactly 0 (per round, never the total).
      const problem = seatRemovalProblem(game.scores[seat.id]);
      setSheet(problem ? { kind: 'remove_blocked', message: problem } : { kind: 'remove', seat });
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!game) {
    // A slow network used to land here as "Game not available"; it is a load failure, so offer Retry.
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={error ? "Couldn't load the players" : 'Game not available'}
        message={error ?? 'Try again from the scorecard.'}
        actionLabel="Retry"
        onAction={reload}
      />
    );
  }
  const addAdminBlocked = addAdminBlockedReason(game, canScore);

  const row = (seat: Player, index: number, list: Player[]) => {
    const menu = seatMenu(seat, game, viewer?.id, canScore);
    const role = seatRoleLabel(seat, game);
    const registration = registrationLabel(invited.has(seat.id) && seat.status === 'unregistered' ? { status: 'pending' } : seat);
    const badge = playerIdBadge(seat);
    return (
      <View key={seat.id} style={[styles.row, { borderBottomColor: colors.hairline }]}>
        <SeatAvatar name={seat.name} color={seatColor(index)} size={36} muted={seat.seatRole === 'spectator'} />
        <View style={styles.text}>
          <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>{seat.name}</Text>
          <View style={styles.tags}>
            {badge ? <Tag small label={badge} /> : null}
            <Tag small label={role} tone={role === 'Creator' || role === 'Admin' ? 'positive' : 'neutral'} icon={role === 'Creator' ? 'crown-outline' : role === 'Admin' ? 'shield-account-outline' : role === 'View only' ? 'eye-outline' : 'account-outline'} />
            <Tag small label={registration} tone={registration === 'Registered' ? 'info' : registration === 'Pending registration' ? 'results' : 'neutral'} icon={registration === 'Registered' ? 'check-circle-outline' : registration === 'Pending registration' ? 'clock-outline' : 'account-question-outline'} />
          </View>
        </View>
        {canScore && canReorder && seat.seatRole !== 'spectator' && seat.seated !== false ? (
          <View style={styles.reorder}>
            <IconButton icon="chevron-up" size={18} disabled={busy || index === 0} onPress={() => run(() => gamesService.moveSeat(game.id, seat.id, -1))} accessibilityLabel={`Move ${seat.name} up`} />
            <IconButton icon="chevron-down" size={18} disabled={busy || index === list.length - 1} onPress={() => run(() => gamesService.moveSeat(game.id, seat.id, 1))} accessibilityLabel={`Move ${seat.name} down`} />
          </View>
        ) : null}
        {menu.length > 0 ? (
          <Menu
            visible={menuFor === seat.id}
            onDismiss={() => setMenuFor(null)}
            anchor={<IconButton icon="dots-vertical" onPress={() => setMenuFor(seat.id)} disabled={busy} accessibilityLabel={`Options for ${seat.name}`} />}
          >
            {menu.map((entry) => (
              <Menu.Item
                key={entry.item}
                title={entry.enabled || !entry.reason ? SEAT_MENU_LABEL[entry.item] : `${SEAT_MENU_LABEL[entry.item]} · ${entry.reason}`}
                disabled={!entry.enabled}
                leadingIcon={
                  entry.item === 'make_admin' ? 'shield-plus-outline'
                    : entry.item === 'remove_admin' ? 'shield-off-outline'
                      : entry.item === 'edit_name' ? 'pencil-outline'
                        : entry.item === 'invite' ? 'send-outline'
                          : entry.item === 'remove_player' ? 'account-remove-outline'
                            : 'link-variant'
                }
                onPress={() => act(entry.item, seat)}
              />
            ))}
          </Menu>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: PLAYERS_ADMINS_TITLE, headerRight: () => <HelpButton text={HELP.playersSheet} /> }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
        <Text variant="titleSmall" style={styles.section}>Playing · {playing.length}</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          {playing.map((seat, index) => row(seat, index, playing))}
        </View>
        {unseated.length > 0 ? (
          <>
            <Text variant="titleSmall" style={styles.section}>Admins not playing</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              {unseated.map((seat, index) => row(seat, playing.length + index, unseated))}
            </View>
          </>
        ) : null}
        {watching.length > 0 ? (
          <>
            <Text variant="titleSmall" style={styles.section}>Watching</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              {watching.map((seat, index) => row(seat, playing.length + unseated.length + index, watching))}
            </View>
          </>
        ) : null}
        {canScore ? (
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            A player added now gets 0 for every round already played. Remove player (in a row's ⋮ menu) works only while every round score they have is 0.
          </Text>
        ) : null}
        {canScore ? (
          <View style={styles.adminAdd}>
            <Button
              mode="outlined"
              icon="shield-plus-outline"
              onPress={() => setSheet({ kind: 'add_admin' })}
              disabled={busy || Boolean(addAdminBlocked)}
              accessibilityLabel="Add admin by Player ID"
              testID="add-admin"
            >
              Add admin
            </Button>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, flex: 1 }}>
              {addAdminBlocked ?? 'Type a Player ID to let someone score and manage this game without playing in it.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <BottomBar>
        <Button mode="outlined" onPress={back}>Back to scorecard</Button>
        {canScore ? (
          <Button mode="contained" icon="account-plus-outline" onPress={openAdd} disabled={busy} style={styles.flex} accessibilityLabel="Add new player">
            Add new player
          </Button>
        ) : null}
      </BottomBar>

      <Portal>
        {sheet?.kind === 'edit' ? (
          <EditNameDialog
            seat={sheet.seat}
            busy={busy}
            onDismiss={() => setSheet(null)}
            onSave={(first, last) => viewer && run(() => playerIdentityService.updateNewPlayer(viewer.id, sheet.seat.id, first, last), () => setSheet(null))}
          />
        ) : null}

        {sheet?.kind === 'invite' ? (
          <Dialog visible onDismiss={() => setSheet(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <Dialog.Title>Invite {sheet.seat.name} to register</Dialog.Title>
            <Dialog.Content style={styles.gap}>
              <Text variant="bodyMedium">
                Prepares a one-time sign-up link and opens your share sheet so you can send it on WhatsApp, text, or anything else. Nothing is sent until you pick where. The link works once and lasts 14 days.
              </Text>
              {sheet.notice ? <Text variant="bodyMedium" style={{ fontWeight: '700' }}>{sheet.notice}</Text> : null}
              {sheet.message ? (
                <View style={[styles.preview, { backgroundColor: colors.surfaceVariant }]}>
                  <Text variant="bodySmall" selectable>{sheet.message}</Text>
                  <Button compact icon="content-copy" onPress={() => Clipboard.setStringAsync(sheet.message as string)}>Copy</Button>
                </View>
              ) : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setSheet(null)}>Close</Button>
              <Button
                mode="contained"
                icon="share-variant"
                loading={busy}
                disabled={busy || !viewer}
                onPress={async () => {
                  if (!viewer) return;
                  setBusy(true);
                  try {
                    const result = await playerIdentityService.shareClaimLink(viewer, sheet.seat, game.gameNumber != null ? [game.gameNumber] : []);
                    // The link exists now, so the seat is Pending registration whether or not the sheet was used.
                    setInvited((current) => new Set([...current, sheet.seat.id]));
                    setSheet({ kind: 'invite', seat: sheet.seat, notice: result.notice, message: result.shared ? undefined : result.message });
                    await reload();
                  } catch (caught) {
                    setFailure(formatSupabaseError(caught));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Prepare link
              </Button>
            </Dialog.Actions>
          </Dialog>
        ) : null}

        {sheet?.kind === 'link' ? (
          <LinkPlayerDialog
            seat={sheet.seat}
            game={game}
            busy={busy}
            onDismiss={() => setSheet(null)}
            onConfirm={(target) => viewer && run(() => playerIdentityService.linkSeatToPlayer(game.id, sheet.seat, target, viewer.id), () => setSheet(null))}
          />
        ) : null}

        {sheet?.kind === 'add_admin' ? (
          <AddAdminDialog
            game={game}
            busy={busy}
            onDismiss={() => setSheet(null)}
            onConfirm={(target) => run(() => gamesService.addNonPlayerAdmin(game.id, target.id), () => setSheet(null))}
          />
        ) : null}

        {sheet?.kind === 'remove' ? (
          <Dialog visible onDismiss={() => setSheet(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <Dialog.Icon icon="account-remove-outline" />
            <Dialog.Title>Remove {sheet.seat.name}?</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">
                {sheet.seat.name} leaves this game and their column disappears from the scorecard. You can add them again later from Add new player.
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setSheet(null)} disabled={busy}>Cancel</Button>
              <Button
                mode="contained"
                loading={busy}
                disabled={busy}
                accessibilityLabel={`Confirm remove ${sheet.seat.name}`}
                onPress={() => run(() => gamesService.removeSeatIfNoScores(game.id, sheet.seat.id), () => setSheet(null))}
              >
                Remove player
              </Button>
            </Dialog.Actions>
          </Dialog>
        ) : null}

        {sheet?.kind === 'remove_blocked' ? (
          <Dialog visible onDismiss={() => setSheet(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <Dialog.Icon icon="alert-circle-outline" />
            <Dialog.Title>Remove player</Dialog.Title>
            <Dialog.Content><Text variant="bodyMedium">{sheet.message}</Text></Dialog.Content>
            <Dialog.Actions><Button mode="contained" onPress={() => setSheet(null)}>Got it</Button></Dialog.Actions>
          </Dialog>
        ) : null}

        <Dialog visible={Boolean(failure)} onDismiss={() => setFailure(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="alert-circle-outline" />
          <Dialog.Title>Something went wrong</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{failure}</Text></Dialog.Content>
          <Dialog.Actions><Button mode="contained" onPress={() => setFailure(null)}>Got it</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function EditNameDialog({ seat, busy, onDismiss, onSave }: { seat: Player; busy: boolean; onDismiss: () => void; onSave: (first: string, last: string) => void }) {
  const { colors } = useAppTheme();
  const [first, setFirst] = useState(seat.firstName ?? seat.name.split(' ')[0] ?? '');
  const [last, setLast] = useState(seat.lastName ?? seat.name.split(' ').slice(1).join(' '));
  return (
    <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>Edit name</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Changes this player's name everywhere they appear. Only works until they register; after that the name is theirs.
        </Text>
        <TextInput label="First name" value={first} onChangeText={setFirst} mode="outlined" accessibilityLabel="First name" autoCapitalize="words" />
        <TextInput label="Last name" value={last} onChangeText={setLast} mode="outlined" accessibilityLabel="Last name" autoCapitalize="words" />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
        <Button mode="contained" onPress={() => onSave(first, last)} loading={busy} disabled={busy || !first.trim() || !last.trim()} accessibilityLabel="Save name">Save</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function LinkPlayerDialog({ seat, game, busy, onDismiss, onConfirm }: {
  seat: Player;
  game: { players: string[]; spectators?: string[]; unseatedAdminIds?: string[] };
  busy: boolean;
  onDismiss: () => void;
  onConfirm: (target: Player) => void;
}) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState(false);
  const [target, setTarget] = useState<Player | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const lookUp = async () => {
    const no = parsePlayerNo(query);
    if (no === null) {
      setProblem('Type the Player ID number, like #42.');
      setTarget(null);
      return;
    }
    setLooking(true);
    setSearched(true);
    try {
      const found = (await playersService.searchPlayers(`#${no}`)).find((player) => player.playerNo === no || player.playerCode === `#${no}`) ?? null;
      const why = linkTargetProblem(found, game, seat.id);
      setTarget(why ? null : found);
      setProblem(why);
    } catch (caught) {
      setProblem(formatSupabaseError(caught));
      setTarget(null);
    } finally {
      setLooking(false);
    }
  };

  return (
    <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>Link {seat.name} to a Player ID</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          If this person already has an account, type their Player ID. Their seat and scores in this game move to that account. Nothing else changes.
        </Text>
        <View style={styles.lookupRow}>
          <TextInput
            label="Player ID"
            value={query}
            onChangeText={(text) => { setQuery(text); setTarget(null); setProblem(null); setSearched(false); }}
            mode="outlined"
            keyboardType="number-pad"
            accessibilityLabel="Player ID to link"
            style={styles.flex}
            onSubmitEditing={lookUp}
          />
          <Button mode="contained-tonal" onPress={lookUp} loading={looking} disabled={looking || !query.trim()} accessibilityLabel="Look up Player ID">Look up</Button>
        </View>
        {problem ? <Text variant="bodyMedium" style={{ color: colors.error }}>{problem}</Text> : null}
        {target ? (
          <View style={[styles.preview, { backgroundColor: colors.positiveContainer }]}>
            <Text variant="titleMedium" style={{ color: colors.onPositiveContainer }}>{target.name}</Text>
            <Text variant="bodySmall" style={{ color: colors.onPositiveContainer }}>{playerIdBadge(target)} · Registered</Text>
            <Text variant="bodySmall" style={{ color: colors.onPositiveContainer, marginTop: spacing.xs }}>
              {linkLanding(target, game) === 'admin_takes_seat'
                ? `${target.name} is an admin here but not playing. They take ${seat.name}'s seat and scores and stay admin.`
                : linkLanding(target, game) === 'viewer_takes_seat'
                  ? `${target.name} is watching this game. They take ${seat.name}'s seat and scores.`
                  : `${seat.name}'s seat and scores in this game become ${target.name}'s.`}
            </Text>
          </View>
        ) : searched && !problem ? <Text variant="bodyMedium">No registered player has that Player ID.</Text> : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
        <Button mode="contained" onPress={() => target && onConfirm(target)} loading={busy} disabled={busy || !target} accessibilityLabel="Confirm link">Link</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

/** Add admin: a registered Player ID becomes a game admin without a seat (not counted as a player). */
function AddAdminDialog({ game, busy, onDismiss, onConfirm }: {
  game: { createdBy?: string; players: string[]; spectators?: string[]; adminIds?: string[]; unseatedAdminIds?: string[]; closedAt?: string | null };
  busy: boolean;
  onDismiss: () => void;
  onConfirm: (target: Player) => void;
}) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState(false);
  const [target, setTarget] = useState<Player | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const lookUp = async () => {
    const no = parsePlayerNo(query);
    if (no === null) {
      setProblem('Type the Player ID number, like #42.');
      setTarget(null);
      return;
    }
    setLooking(true);
    try {
      const found = (await playersService.searchPlayers(`#${no}`)).find((player) => player.playerNo === no || player.playerCode === `#${no}`) ?? null;
      const why = addAdminProblem(found, game);
      setTarget(why ? null : found);
      setProblem(why);
    } catch (caught) {
      setProblem(formatSupabaseError(caught));
      setTarget(null);
    } finally {
      setLooking(false);
    }
  };

  return (
    <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>Add admin</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Type the Player ID of a registered player. They can score and manage this game but are not a player in it.
        </Text>
        <View style={styles.lookupRow}>
          <TextInput
            label="Player ID"
            value={query}
            onChangeText={(text) => { setQuery(text); setTarget(null); setProblem(null); }}
            mode="outlined"
            keyboardType="number-pad"
            accessibilityLabel="Player ID to make admin"
            style={styles.flex}
            onSubmitEditing={lookUp}
          />
          <Button mode="contained-tonal" onPress={lookUp} loading={looking} disabled={looking || !query.trim()} accessibilityLabel="Look up Player ID">Look up</Button>
        </View>
        {problem ? <Text variant="bodyMedium" style={{ color: colors.error }}>{problem}</Text> : null}
        {target ? (
          <View style={[styles.preview, { backgroundColor: colors.positiveContainer }]}>
            <Text variant="titleMedium" style={{ color: colors.onPositiveContainer }}>{target.name}</Text>
            <Text variant="bodySmall" style={{ color: colors.onPositiveContainer }}>{playerIdBadge(target)} · Registered</Text>
            <Text variant="bodySmall" style={{ color: colors.onPositiveContainer, marginTop: spacing.xs }}>{addAdminPreview(target)}</Text>
          </View>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
        <Button mode="contained" onPress={() => target && onConfirm(target)} loading={busy} disabled={busy || !target} accessibilityLabel="Confirm add admin">Add admin</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  section: { fontWeight: '700', marginTop: spacing.sm },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: spacing.xs },
  name: { fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reorder: { flexDirection: 'row' },
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
  gap: { gap: spacing.sm },
  preview: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xxs },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adminAdd: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
