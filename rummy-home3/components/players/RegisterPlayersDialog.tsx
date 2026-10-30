import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { Player } from '@/types/player';
import { playerIdentityService } from '@/services/playerIdentity';
import { INVITE_MESSAGE, isValidEmail, normalizeEmail, PendingLink } from '@/utils/playerIdentity';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { Tag } from '@/components/ui/Tag';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * Lists unregistered players (one game, or all of My players) and asks only
 * for an email. Share sends: INVITE_MESSAGE. Pending players can Change email
 * or Resend. Linked players can be Unlinked if the link was wrong.
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
  const [linked, setLinked] = useState<PendingLink[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    setError(null);
    try {
      const list = await playerIdentityService.listUnregistered(me.id, gameId);
      setPlayers(list);
      setEmails(Object.fromEntries(list.map((p) => [p.id, p.inviteEmail ?? ''])));
      setLinked(gameId ? [] : await playerIdentityService.listLinked(me.id));
    } catch (err) {
      setError(formatSupabaseError(err));
    }
  }, [me, gameId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const share = async (player: Player, resend = false) => {
    if (!me) return;
    const email = emails[player.id] ?? '';
    if (!isValidEmail(email)) { setNotes((n) => ({ ...n, [player.id]: 'Enter a full email address.' })); return; }
    setBusy(player.id);
    try {
      const result = player.status === 'pending'
        ? await playerIdentityService.changeEmail(me, player, email, gameNumbers)
        : await playerIdentityService.invite(me, player, email, gameNumbers);
      setNotes((n) => ({ ...n, [player.id]: resend && result.notice === 'Sent again.' ? 'Request sent again.' : result.notice }));
      setEditing((e) => ({ ...e, [player.id]: false }));
      setEmails((e) => ({ ...e, [player.id]: normalizeEmail(email) }));
      const list = await playerIdentityService.listUnregistered(me.id, gameId);
      setPlayers(list);
    } catch (err) {
      setNotes((n) => ({ ...n, [player.id]: formatSupabaseError(err) }));
    } finally {
      setBusy(null);
    }
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
              Type each player’s email and tap Share. The message says: “{INVITE_MESSAGE}” When they sign up with that exact email, their scores join their account after they confirm it’s them.
            </Text>
            {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
            {players.length === 0 && !error ? <Text variant="bodyMedium" style={styles.lead}>Everyone {gameId ? 'in this game ' : ''}is registered.</Text> : null}
            {players.map((player) => {
              const pending = player.status === 'pending';
              const locked = pending && !editing[player.id];
              return (
                <View key={player.id} style={[styles.card, { borderColor: colors.outlineVariant }]}>
                  <View style={styles.head}>
                    <Text variant="titleSmall" style={{ flex: 1 }}>{player.name} <Text variant="labelSmall">{player.playerCode}</Text></Text>
                    <Tag label={pending ? 'Pending' : 'Unregistered'} icon={pending ? 'clock-outline' : 'account-question-outline'} />
                  </View>
                  <View style={styles.row}>
                    <TextInput dense mode="outlined" label="Email" accessibilityLabel={`Email for ${player.name}`} autoCapitalize="none" keyboardType="email-address" style={{ flex: 1 }}
                      value={emails[player.id] ?? ''} disabled={locked} onChangeText={(t) => setEmails((e) => ({ ...e, [player.id]: t }))} />
                    {!pending || editing[player.id] ? (
                      <Button mode="contained" icon="share-variant" loading={busy === player.id} onPress={() => share(player)} accessibilityLabel={`Share invite for ${player.name}`}>Share</Button>
                    ) : null}
                  </View>
                  {pending && !editing[player.id] ? (
                    <View style={styles.row}>
                      <Button compact mode="outlined" icon="pencil" onPress={() => setEditing((e) => ({ ...e, [player.id]: true }))}>Change email</Button>
                      <Button compact mode="outlined" icon="send" loading={busy === player.id} onPress={() => share(player, true)}>Resend</Button>
                    </View>
                  ) : null}
                  {notes[player.id] ? <Text variant="bodySmall">{notes[player.id]}</Text> : null}
                </View>
              );
            })}
            {linked.length ? <Text variant="titleSmall" style={styles.lead}>Linked players</Text> : null}
            {linked.map((link) => (
              <View key={link.id} style={[styles.card, { borderColor: colors.outlineVariant }]}>
                <View style={styles.head}>
                  <Text variant="bodyMedium" style={{ flex: 1 }}>{link.playerName} · {link.email}</Text>
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
});
