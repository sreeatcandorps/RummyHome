import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Player } from '@/types/player';
import { playerIdentityService } from '@/services/playerIdentity';
import { claimPrompt, PendingLink } from '@/utils/playerIdentity';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * After sign-up (and email confirmation) on a phone that opened a claim link:
 * "Is this you? You played in G3 with Sree". Yes links the scores. Not me leaves them.
 * Also sends a player ID typed at sign-up to its creator as a claim request.
 */
export function JoinRequestsDialog({ me, onChanged, onNotice }: { me: Player | null; onChanged?: () => void; onNotice?: (text: string) => void }) {
  const { colors } = useAppTheme();
  const [claim, setClaim] = useState<(PendingLink & { token: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me) return;
    try { setClaim(await playerIdentityService.peekPendingClaim()); } catch { setClaim(null); }
    const sent = await playerIdentityService.flushPendingPlayerNo(me).catch(() => null);
    if (sent) onNotice?.(sent);
  }, [me, onNotice]);
  useEffect(() => { load(); }, [load]);

  const answer = async (accept: boolean) => {
    if (!me || !claim) return;
    setBusy(true);
    setError(null);
    try {
      await playerIdentityService.answerClaimLink(me, claim, accept);
      setClaim(null);
      onNotice?.(accept ? `Done. ${claim.playerName}’s games are now on your account.` : 'Okay. Those scores stay with the person who sent the link.');
      onChanged?.();
    } catch (err) { setError(formatSupabaseError(err)); setClaim(null); } finally { setBusy(false); }
  };

  return (
    <Portal>
      <Dialog visible={Boolean(claim)} dismissable={false}>
        <Dialog.Title>One quick check</Dialog.Title>
        <Dialog.Content>
          {claim ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="bodyLarge">{claimPrompt(claim)}</Text>
              <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                {claim.ownerName || 'They'} added you as “{claim.playerName}”{claim.playerNo ? ` (#${claim.playerNo})` : ''}. Yes puts those scores on your account.
              </Text>
              {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={{ gap: spacing.sm }}>
          <Button mode="outlined" onPress={() => answer(false)} disabled={busy}>Not me</Button>
          <Button mode="contained" onPress={() => answer(true)} loading={busy}>Yes</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
