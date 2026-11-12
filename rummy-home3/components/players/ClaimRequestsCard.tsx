import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { playerIdentityService } from '@/services/playerIdentity';
import { claimRequestPrompt, PendingLink } from '@/utils/playerIdentity';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing, useAppTheme } from '@/constants/theme';

type ClaimRequestsCardProps = {
  ownerId: string;
  onChanged?: () => void;
  /** The list when the screen already has it (home bundle); the card fetches its own when omitted. */
  preloaded?: PendingLink[] | null;
};

/** Creator side: someone typed a player ID at sign-up. Only Approve links. */
export function ClaimRequestsCard({ ownerId, onChanged, preloaded = null }: ClaimRequestsCardProps) {
  const { colors } = useAppTheme();
  const [requests, setRequests] = useState<PendingLink[]>(preloaded ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRequests(await playerIdentityService.listClaimRequests(ownerId)); } catch { setRequests([]); }
  }, [ownerId]);
  useEffect(() => {
    if (preloaded) setRequests(preloaded);
    else load();
  }, [load, preloaded]);

  const answer = async (link: PendingLink, approve: boolean) => {
    setBusy(link.id);
    setError(null);
    try {
      await playerIdentityService.answerClaimRequest(ownerId, link, approve);
      setRequests((r) => r.filter((x) => x.id !== link.id));
      onChanged?.();
    } catch (err) { setError(formatSupabaseError(err)); } finally { setBusy(null); }
  };

  if (!requests.length) return null;
  return (
    <View style={styles.wrap}>
      {requests.map((link) => (
        <View key={link.id} style={[styles.card, { backgroundColor: colors.primaryContainer }]}>
          <Text variant="titleSmall" style={{ color: colors.onPrimaryContainer }}>{claimRequestPrompt(link)}</Text>
          <Text variant="bodySmall" style={{ color: colors.onPrimaryContainer }}>
            {link.requesterName ? `${link.requesterName} signed up and typed this player ID.` : 'A new account typed this player ID.'} Approve puts {link.playerName}’s scores on their account.
          </Text>
          <View style={styles.row}>
            <Button mode="outlined" onPress={() => answer(link, false)} disabled={Boolean(busy)}>Decline</Button>
            <Button mode="contained" onPress={() => answer(link, true)} loading={busy === link.id}>Approve</Button>
          </View>
        </View>
      ))}
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.sm },
  card: { borderRadius: 12, padding: spacing.md, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
