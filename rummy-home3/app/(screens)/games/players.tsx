import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';
import { useGameRoster } from '@/hooks/useGameRoster';
import { useLayout } from '@/hooks/useLayout';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { playerIdentityService } from '@/services/playerIdentity';
import { playersService } from '@/services/players';
import { Player } from '@/types/player';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { addAdminBlockedReason, addAdminPreview, addAdminProblem, PLAYERS_ADMINS_TITLE } from '@/utils/gameAdmins';
import { parsePlayerNo, PendingLink } from '@/utils/playerIdentity';
import { seatRemovalProblem } from '@/utils/seatRemoval';
import { playerIdBadge, registrationLabel, seatMenu, SeatMenuItem, seatRoleLabel, seatSubline } from '@/utils/gamePlayers';
import { visibleRoleTag } from '@/utils/gameAccess';
import { visibleRegistration } from '@/utils/myPlayersList';
import { NON_PLAYING_ADMIN_BUTTON, NON_PLAYING_ADMIN_NOTE, NON_PLAYING_ADMIN_ROW } from '@/utils/addPlayers';
import { LinkRequestOutcome } from '@/utils/linkPlayer';
import { canChangeSeating, SEATING_MENU_ITEM, SEATING_ROW_DESCRIPTION } from '@/utils/seating';
import { isPoolGame, seatOf } from '@/utils/pool';
import { playedRounds } from '@/utils/editRound';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { ListRow } from '@/components/ui/ListRow';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { SettingsGroup } from '@/components/ui/SettingsGroup';
import { SeatingSheet } from '@/components/game/SeatingSheet';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { EditNameDialog } from '@/components/players/EditNameDialog';
import { PlayerActionMenu } from '@/components/players/PlayerActionMenu';
import { LinkPlayerDialog } from '@/components/players/LinkPlayerDialog';
import { LinkRequestSentDialog } from '@/components/players/LinkRequestSentDialog';
import { shareInvite } from '@/utils/invite';
import { seatLabels } from '@/utils/initials';
import { screenTitle } from '@/utils/gameLabel';

type Sheet =
  | { kind: 'edit'; seat: Player }
  | { kind: 'initials'; seat: Player }
  | { kind: 'link'; seat: Player }
  | { kind: 'link_sent'; outcome: LinkRequestOutcome }
  | { kind: 'add_admin' }
  | { kind: 'remove'; seat: Player }
  | { kind: 'remove_blocked'; message: string }
  | null;

/**
 * Players in this game as a full page, in the Size-S grouped list (design-review-2 §10.5): Playing, Admins not
 * playing, Watching. Each seat is one row — the initials disc, the name, one grey line (Player ID, role,
 * registration) — and the unified ⋮ menu for admins (Invite to EZ Score · Link to Player ID · Edit initials ·
 * Make/Remove admin · Remove from game). The order of players changes only in the circle (D138), opened from the
 * last Playing row. Adding happens on the picker screen; Remove from game is confirmed first and works only
 * while every round score the player has is 0.
 */
/** Mini help (PR 11) beside Playing, for admins. */
export const PLAYING_TIP = ['A player added now sits to the dealer\u2019s left and deals last. They get 0 for every round already played.', '**Remove from game** (in a row\u2019s ⋮ menu) works only while every round score they have is 0.', 'Each row\u2019s ⋮ also has Invite, Link, Edit initials, Edit name and Make admin.'];

export default function GamePlayersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { insets } = useLayout();
  const { game, roster, canScore, loading, error, reload } = useGameRoster(typeof id === 'string' ? id : undefined);
  const [viewer, setViewer] = useState<Player | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [seating, setSeating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Open Link to Player ID requests (025) for seats in this game, so those rows read Link pending.
  const [linkRequests, setLinkRequests] = useState<PendingLink[]>([]);

  useEffect(() => {
    if (!game?.id || !viewer) return;
    let alive = true;
    playerIdentityService.listLinkRequests(viewer.id, game.id).then((rows) => { if (alive) setLinkRequests(rows); }).catch(() => {});
    return () => { alive = false; };
  }, [game?.id, viewer, roster]);

  useEffect(() => {
    authService.getCurrentPlayer().then((me) => setViewer(me ?? null)).catch(() => setViewer(null));
  }, []);

  // The share sheet sends the app to the background; refresh the roster when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);

  const playing = useMemo(() => roster.filter((seat) => seat.seatRole !== 'spectator' && seat.seated !== false && seat.id !== 'EX'), [roster]);
  // The scorecard's column letters: stored seat labels (022), or derived in seat order on an older server.
  const labels = useMemo(() => seatLabels(playing), [playing]);
  const unseated = useMemo(() => roster.filter((seat) => seat.seated === false && seat.seatRole === 'game_admin'), [roster]);
  const watching = useMemo(() => roster.filter((seat) => seat.seatRole === 'spectator'), [roster]);

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
    else if (item === 'edit_initials') setSheet({ kind: 'initials', seat });
    else if (item === 'edit_name') setSheet({ kind: 'edit', seat });
    else if (item === 'invite') shareInvite().catch(() => {});
    else if (item === 'link_id') setSheet({ kind: 'link', seat });
    else if (item === 'remove_player') {
      // Same rule as the picker's ×: no scores, or every round score exactly 0 (per round, never the total).
      const problem = seatRemovalProblem(game.scores[seat.id]);
      setSheet(problem ? { kind: 'remove_blocked', message: problem } : { kind: 'remove', seat });
    }
  };


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
  // Exactly when the scorecard ⋮ shows Order of players: an admin, an Active game (mid-game included).
  const canSeat = canChangeSeating(game, canScore);
  const pool = isPoolGame(game);

  const row = (seat: Player, index: number) => {
    const menu = seatMenu(seat, game, viewer?.id, canScore);
    const roleTag = visibleRoleTag(seatRoleLabel(seat, game), canScore);
    const linkRequest = linkRequests.find((l) => l.playerId === seat.id) ?? null;
    const registration = visibleRegistration(registrationLabel(seat, Boolean(linkRequest)));
    return (
      <ListRow
        key={seat.id}
        left={<SeatAvatar name={seat.name} label={labels.get(seat.id)} color={seatColor(index)} size={36} muted={seat.seatRole === 'spectator'} />}
        title={seat.name}
        description={seatSubline(playerIdBadge(seat), roleTag, registration)}
        right={
          <PlayerActionMenu
            name={seat.name}
            items={menu}
            visible={menuFor === seat.id}
            disabled={busy}
            onOpen={() => setMenuFor(seat.id)}
            onDismiss={() => setMenuFor(null)}
            onSelect={(item) => act(item, seat)}
          />
        }
      />
    );
  };
  const rowIcon = (source: string) => (
    <View style={styles.rowIcon}><Icon source={source} size={24} color={colors.onSurfaceVariant} /></View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: screenTitle(PLAYERS_ADMINS_TITLE, game), headerRight: () => <HelpButton topic="players-admins" /> }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
        <SettingsGroup
          title={`Playing · ${playing.length}`}
          tip={canScore ? { title: 'Playing', text: PLAYING_TIP, topic: 'players-admins', testID: 'players-playing-tip' } : undefined}
          testID="players-playing"
        >
          {playing.map((seat, index) => row(seat, index))}
          {canSeat ? (
            <ListRow
              left={rowIcon('seat-outline')}
              title={SEATING_MENU_ITEM}
              description={SEATING_ROW_DESCRIPTION}
              onPress={() => setSeating(true)}
              testID="players-order"
            />
          ) : null}
        </SettingsGroup>
        {canScore || unseated.length > 0 ? (
          <SettingsGroup
            title="Admins not playing"
            tip={canScore ? { text: NON_PLAYING_ADMIN_NOTE, topic: 'players-admins', testID: 'players-admins-tip' } : undefined}
            note={canScore && addAdminBlocked ? addAdminBlocked : undefined}
            testID="players-admins-not-playing"
          >
            {unseated.map((seat, index) => row(seat, playing.length + index))}
            {canScore && !addAdminBlocked ? (
              <ListRow
                left={rowIcon('plus')}
                title={NON_PLAYING_ADMIN_BUTTON}
                description={NON_PLAYING_ADMIN_ROW}
                onPress={() => setSheet({ kind: 'add_admin' })}
                accessibilityLabel="Add admin by Player ID"
                testID="add-admin"
              />
            ) : null}
          </SettingsGroup>
        ) : null}
        {watching.length > 0 ? (
          <SettingsGroup title="Watching" testID="players-watching">
            {watching.map((seat, index) => row(seat, playing.length + unseated.length + index))}
          </SettingsGroup>
        ) : null}
      </ScrollView>
      {/* A05: the page returns through the header arrow; the bar holds the one action admins have here. */}
      {canScore ? (
        <BottomBar>
          <Button mode="contained" icon="account-plus-outline" onPress={openAdd} disabled={busy} style={styles.flex} accessibilityLabel="Add new player" testID="players-add-new">
            Add new player
          </Button>
        </BottomBar>
      ) : null}

      <SeatingSheet
        visible={seating && canSeat}
        players={playing.map((seat) => ({ id: seat.id, name: seat.name, label: labels.get(seat.id) ?? '?', playerCode: seat.playerCode, out: pool && Boolean(seatOf(game, seat.id).outRound), reentered: pool && Boolean(seatOf(game, seat.id).reenteredRound) }))}
        pool={pool}
        dealerIds={game.dealerIds}
        nextDealerOverride={game.nextDealerOverride}
        roundCount={playedRounds(game.scores)}
        onDismiss={() => setSeating(false)}
        onSave={async (order) => {
          await gamesService.setSeatingOrder(game.id, order);
          await reload();
        }}
      />

      <Portal>
        {sheet?.kind === 'edit' ? (
          <EditNameDialog
            seat={sheet.seat}
            busy={busy}
            onDismiss={() => setSheet(null)}
            onSave={(first, last) => viewer && run(() => playerIdentityService.updateNewPlayer(viewer.id, sheet.seat.id, first, last), () => setSheet(null))}
          />
        ) : null}

        {sheet?.kind === 'initials' ? (
          <InitialsDialog
            name={sheet.seat.name}
            current={labels.get(sheet.seat.id)}
            taken={new Map(playing.filter((seat) => seat.id !== sheet.seat.id).map((seat) => [labels.get(seat.id) ?? '', seat.name]))}
            scope="game"
            busy={busy}
            onDismiss={() => setSheet(null)}
            onSave={(value) => viewer && run(() => gamesService.setSeatLabel(game.id, sheet.seat.id, value, viewer.id), () => setSheet(null))}
          />
        ) : null}

        {sheet?.kind === 'link' && viewer ? (
          <LinkPlayerDialog
            player={sheet.seat}
            owner={viewer}
            pending={linkRequests.find((l) => l.playerId === sheet.seat.id) ?? null}
            onDismiss={() => setSheet(null)}
            onRequested={(outcome) => { setSheet({ kind: 'link_sent', outcome }); reload(); }}
            onCancelled={() => { setSheet(null); reload(); }}
          />
        ) : null}

        {sheet?.kind === 'link_sent' ? <LinkRequestSentDialog outcome={sheet.outcome} onDismiss={() => setSheet(null)} /> : null}

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
                Remove from game
              </Button>
            </Dialog.Actions>
          </Dialog>
        ) : null}

        {sheet?.kind === 'remove_blocked' ? (
          <Dialog visible onDismiss={() => setSheet(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <Dialog.Icon icon="alert-circle-outline" />
            <Dialog.Title>Remove from game</Dialog.Title>
            <Dialog.Content><Text variant="bodyMedium">{sheet.message}</Text></Dialog.Content>
            <Dialog.Actions><Button mode="contained" onPress={() => setSheet(null)}>OK</Button></Dialog.Actions>
          </Dialog>
        ) : null}

        <Dialog visible={Boolean(failure)} onDismiss={() => setFailure(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="alert-circle-outline" />
          <Dialog.Title>Something went wrong</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{failure}</Text></Dialog.Content>
          <Dialog.Actions><Button mode="contained" onPress={() => setFailure(null)}>OK</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
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
      <Dialog.Title>{NON_PLAYING_ADMIN_BUTTON}</Dialog.Title>
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
          <Button mode="contained" onPress={lookUp} loading={looking} disabled={looking || !query.trim()} accessibilityLabel="Look up Player ID">Look up</Button>
        </View>
        {problem ? <Text variant="bodyMedium" style={{ color: colors.error }}>{problem}</Text> : null}
        {target ? (
          <View style={[styles.preview, { backgroundColor: colors.positiveContainer }]}>
            <Text variant="titleMedium" style={{ color: colors.onPositiveContainer }}>{target.name}</Text>
            <Text variant="bodySmall" style={{ color: colors.onPositiveContainer }}>{playerIdBadge(target)}</Text>
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
  content: { paddingTop: spacing.xs, paddingBottom: spacing.xl },
  rowIcon: { width: 36, alignItems: 'center' },
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
  gap: { gap: spacing.sm },
  preview: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xxs },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
