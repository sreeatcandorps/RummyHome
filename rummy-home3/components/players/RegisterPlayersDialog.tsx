import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { Player } from '@/types/player';
import { playerIdentityService } from '@/services/playerIdentity';
import { PendingLink } from '@/utils/playerIdentity';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { Tag } from '@/components/ui/Tag';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * Each unregistered player gets a Share button. It opens the phone's share
 * sheet (WhatsApp, SMS, anything) with a single-use claim link that expires in
 * 14 days. Sharing again makes a new link and the old one stops working.
 */
export function RegisterPlayersDialog({ visible, me, gameId, gameNumbers = [], onDismiss }: {
  visible: boolean;
  me: Player | null;
  gameId?: string;
  gameNumbers?: number[];
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  const [players, setPlayers] = useState<Player[]>([]);
  const [open, setOpen] = useState<Record<string, PendingLink>>({});
  const [linked, setLinked] = useState<PendingLink[]>([]);
  const [notes, setNotes] = useState<Record<string, { text: string; message?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    setError(null);
    try {
      const [list, links] = await Promise.all([
        playerIdentityService.listUnregistered(me.id, gameId),
        playerIdentityService.listOpenLinks(me.id),
      ]);
      setPlayers(list);
      setOpen(Object.fromEntries(links.map((l) => [l.playerId, l])));
      setLinked(gameId ? [] : await playerIdentityService.listLinked(me.id));
    } catch (err) {
      setError(formatSupabaseError(err));
    }
  }, [me, gameId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const share = async (player: Player) => {
    if (!me) return;
    setBusy(player.id);
    try {
      const result = await playerIdentityService.shareClaimLink(me, player, gameNumbers);
      setNotes((n) => ({ ...n, [player.id]: { text: result.notice, message: result.shared ? undefined : result.message } }));
      await load();
    } catch (err) {
      setNotes((n) => ({ ...n, [player.id]: { text: formatSupabaseError(err) } }));
    } finally {
      setBusy(null);
    }
  };

  const stop = async (player: Player) => {
    if (!me) return;
    setBusy(player.id);
    try {
      await playerIdentityService.revokeClaimLink(me.id, player.id);
      setNotes((n) => ({ ...n, [player.id]: { text: 'Link turned off. Nobody can use it now.' } }));
      await load();
    } catch (err) { setError(formatSupabaseError(err)); } finally { setBusy(null); }
  };

  const unlink = async (link: PendingLink) => {
    if (!me) return;
    setBusy(link.id);
    try { await playerIdentityService.unlink(me.id, link); await load(); } catch (err) { setError(formatSupabaseError(err)); } finally { setBusy(null); }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: '92%' }}>
        <Dialog.Title>Register players</Dialog.Title>
        <Dialog.ScrollArea style={{ paddingHorizontal: spacing.md }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="bodySmall" style={[styles.lead, { color: colors.onSurfaceVariant }]}>
              Tap Share to send a player their own sign-up link on WhatsApp, text, or anything else. When they sign up with it and tap Yes on “Is this you?”, their scores join their account. Each link works once and lasts 14 days. Sharing again makes a new link and turns off the old one.
            </Text>
            {me ? <ClaimRequestsCard ownerId={me.id} onChanged={load} /> : null}
            {error ? <Text style={{ color: isNotReadyMessage(error) ? colors.onSurfaceVariant : colors.error }}>{error}</Text> : null}
            {players.length === 0 && !error ? <Text variant="bodyMedium" style={styles.lead}>Everyone {gameId ? 'in this game ' : ''}is registered.</Text> : null}
            {players.map((player) => {
              const link = open[player.id];
              const pending = player.status === 'pending';
              return (
                <View key={player.id} style={[styles.card, { borderColor: colors.outlineVariant }]}>
                  <View style={styles.head}>
                    <Text variant="titleSmall" style={{ flex: 1 }}>{player.name} <Text variant="labelMedium">{player.playerCode}</Text></Text>
                    <Tag label={pending ? 'Pending' : 'Unregistered'} icon={pending ? 'clock-outline' : 'account-question-outline'} />
                  </View>
                  {link ? (
                    <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
                      Link sent · expires {new Date(link.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  ) : null}
                  <View style={styles.row}>
                    <Button mode="contained" icon="share-variant" loading={busy === player.id} onPress={() => share(player)} accessibilityLabel={`Share link for ${player.name}`}>
                      {link ? 'Share again' : 'Share'}
                    </Button>
                    {link ? <Button mode="text" textColor={colors.error} onPress={() => stop(player)} accessibilityLabel={`Turn off link for ${player.name}`}>Turn off link</Button> : null}
                  </View>
                  {notes[player.id] ? <Text variant="bodySmall">{notes[player.id].text}</Text> : null}
                  {notes[player.id]?.message ? (
                    <View style={[styles.preview, { backgroundColor: colors.surfaceVariant }]}>
                      <Text variant="bodySmall" selectable>{notes[player.id].message}</Text>
                      <Button compact icon="content-copy" onPress={() => Clipboard.setStringAsync(notes[player.id].message as string)}>Copy</Button>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {linked.length ? <Text variant="titleSmall" style={styles.lead}>Linked players</Text> : null}
            {linked.map((link) => (
              <View key={link.id} style={[styles.card, { borderColor: colors.outlineVariant }]}>
                <View style={styles.head}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>{link.playerName}</Text>
                  <Button compact mode="text" textColor={colors.error} loading={busy === link.id} onPress={() => unlink(link)}>Unlink player</Button>
                </View>
                <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>Wrong person? Unlink moves {link.playerName} back to an unregistered player in My players. No scores are lost.</Text>
              </View>
            ))}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions><Button onPress={onDismiss}>Done</Button></Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  lead: { marginVertical: spacing.sm },
  card: { borderWidth: 1, borderRadius: 10, padding: spacing.sm, marginBottom: spacing.sm, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  preview: { borderRadius: 8, padding: 8, gap: 4 },
});
