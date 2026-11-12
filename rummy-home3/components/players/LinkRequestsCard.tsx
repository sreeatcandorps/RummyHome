import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { playerIdentityService } from '@/services/playerIdentity';
import { Player } from '@/types/player';
import { LinkOutcome, LinkRequestForMe, linkRequestDetail, linkRequestPrompt } from '@/utils/linkPlayer';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing, useAppTheme } from '@/constants/theme';

type LinkRequestsCardProps = {
  me: Player;
  onAnswered?: (outcome: LinkOutcome | null) => void;
  /** The list when the screen already has it (home bundle); the card fetches its own when omitted. */
  preloaded?: LinkRequestForMe[] | null;
};

/**
 * Account-owner side of Link to Player ID (025): an organiser asked to link one of their
 * unregistered players to this account. Yes moves the seats and scores; No leaves them.
 * A conflict (both already in one game) is shown and Yes is disabled until it is cleared.
 */
export function LinkRequestsCard({ me, onAnswered, preloaded = null }: LinkRequestsCardProps) {
  const { colors } = useAppTheme();
  const [requests, setRequests] = useState<LinkRequestForMe[]>(preloaded ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRequests(await playerIdentityService.listLinkRequestsForMe(me)); } catch { setRequests([]); }
  }, [me]);
  useEffect(() => {
    if (preloaded) setRequests(preloaded);
    else load();
  }, [load, preloaded]);

  const answer = async (req: LinkRequestForMe, accept: boolean) => {
    setBusy(req.id);
    setError(null);
    try {
      const outcome = await playerIdentityService.answerLinkRequest(me, req, accept);
      setRequests((r) => r.filter((x) => x.id !== req.id));
      onAnswered?.(outcome);
    } catch (err) { setError(formatSupabaseError(err)); } finally { setBusy(null); }
  };

  if (!requests.length) return null;
  return (
    <View style={styles.wrap} testID="link-requests-card">
      {requests.map((req) => (
        <View key={req.id} style={[styles.card, { backgroundColor: colors.primaryContainer }]}>
          <Text variant="titleSmall" style={{ color: colors.onPrimaryContainer }}>{linkRequestPrompt(req)}</Text>
          <Text variant="bodySmall" style={{ color: colors.onPrimaryContainer }}>{linkRequestDetail(req)}</Text>
          {req.conflictMessage ? (
            <Text variant="bodySmall" style={{ color: colors.error }} accessibilityRole="alert">{req.conflictMessage}</Text>
          ) : null}
          <View style={styles.row}>
            <Button mode="outlined" onPress={() => answer(req, false)} disabled={Boolean(busy)} accessibilityLabel={`No, do not link ${req.playerName}`}>No</Button>
            <Button mode="contained" onPress={() => answer(req, true)} loading={busy === req.id} disabled={Boolean(busy) || Boolean(req.conflictMessage)} accessibilityLabel={`Yes, link ${req.playerName} to my account`}>Yes</Button>
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
