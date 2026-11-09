import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
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
import { parsePlayerNo } from '@/utils/playerIdentity';
import {
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
  | null;

/**
 * Players in this game as a full page (no stacked popups). Each seat shows the
 * name, Player ID, role and registration, and a ⋮ menu for admins. Adding (and
 * removing a player who has no scores yet) happens on the picker screen.
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

  useEffect(() => {
    authService.getCurrentPlayer().then((me) => setViewer(me ?? null)).catch(() => setViewer(null));
  }, []);

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
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!game) {
    return <EmptyState icon="alert-circle-outline" title="Game not available" message={error ?? 'Try again from the scorecard.'} />;
  }

  const row = (seat: Player, index: number, list: Player[]) => {
    const menu = seatMenu(seat, game, viewer?.id, canScore);
    const role = seatRoleLabel(seat, game);
    const registration = registrationLabel(seat);
    const badge = playerIdBadge(seat);
    return (
      <View key={seat.id} style={[styles.row, { borderBottomColor: colors.hairline }]}>
        <SeatAvatar name={seat.name} color={seatColor(index)} size={36} muted={seat.seatRole === 'spectator'} />
        <View style={styles.text}>
          <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>{seat.name}</Text>
          <View style={styles.tags}>
            {badge ? <Tag small label={badge} /> : null}
            <Tag small label={role} tone={role === 'Creator' || role === 'Admin' ? 'positive' : 'neutral'} icon={role === 'Creator' ? 'crown-outline' : role === 'Admin' ? 'shield-account-outline' : role === 'View only' ? 'eye-outline' : 'account-outline'} />
            <Tag small label={registration} tone={registration === 'Registered' ? 'info' : registration === 'Pending' ? 'results' : 'neutral'} icon={registration === 'Registered' ? 'check-circle-outline' : registration === 'Pending' ? 'clock-outline' : 'account-question-outline'} />
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
      <Stack.Screen options={{ title: 'Players in this game', headerRight: () => <HelpButton text={HELP.playersSheet} /> }} />
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
            A player added now gets 0 for every round already played. A player can be removed (× on Add a player) only while every round score they have is 0.
          </Text>
        ) : null}
      </ScrollView>
      <BottomBar>
        <Button mode="outlined" onPress={back}>Back to scorecard</Button>
        {canScore ? (
          <Button mode="contained" icon="account-plus-outline" onPress={openAdd} disabled={busy} style={styles.flex} accessibilityLabel="Add a player">
            Add a player
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
              {`${seat.name}'s seat and scores in this game become ${target.name}'s.`}
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
  flex: { flex: 1 },
});
