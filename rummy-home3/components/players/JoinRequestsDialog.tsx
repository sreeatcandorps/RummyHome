import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { Player } from '@/types/player';
import { playerIdentityService } from '@/services/playerIdentity';
import { claimPrompt, joinRequestPrompt, PendingLink } from '@/utils/playerIdentity';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * First login after sign-up, or any time a creator adds you with your email:
 * "Is this you?" Yes links those scores to you. Not me sends them back.
 */
export function JoinRequestsDialog({ me, onChanged }: { me: Player | null; onChanged?: () => void }) {
  const { colors } = useAppTheme();
  const [requests, setRequests] = useState<PendingLink[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    try { setRequests(await playerIdentityService.listMyRequests(me)); } catch { setRequests([]); }
  }, [me]);
  useEffect(() => { load(); }, [load]);

  const answer = async (link: PendingLink, accept: boolean) => {
    if (!me) return;
    setBusy(link.id);
    setError(null);
    try {
      await playerIdentityService.answerRequest(me, link, accept);
      setRequests((r) => r.filter((x) => x.id !== link.id));
      onChanged?.();
    } catch (err) { setError(formatSupabaseError(err)); } finally { setBusy(null); }
  };

  const current = requests[0];
  return (
    <Portal>
      <Dialog visible={Boolean(current)} dismissable={false}>
        <Dialog.Title>{current?.kind === 'existing' ? 'Request to join a game' : 'Welcome! One quick check'}</Dialog.Title>
        <Dialog.Content>
          {current ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyLarge">{current.kind === 'existing' ? joinRequestPrompt(current) : claimPrompt(current)}</Text>
              <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                They added “{current.playerName}” with your email, {current.email}. Yes puts those scores on your account. Not me leaves them with {current.ownerName || 'them'}.
              </Text>
              {requests.length > 1 ? <Text variant="labelMedium">{requests.length - 1} more after this</Text> : null}
              {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button mode="outlined" onPress={() => current && answer(current, false)} disabled={Boolean(busy)}>Not me</Button>
          <Button mode="contained" onPress={() => current && answer(current, true)} loading={busy === current?.id}>Yes</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing.sm } });
