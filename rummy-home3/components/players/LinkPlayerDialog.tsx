import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Text, TextInput } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { playerIdentityService } from '@/services/playerIdentity';
import { Player } from '@/types/player';
import { parsePlayerNo } from '@/utils/playerIdentity';
import { linkConflictMessage, LinkOutcome, LinkPreview, linkPreviewMessage } from '@/utils/linkPlayer';
import { formatSupabaseError } from '@/utils/supabaseErrors';

/**
 * Link to Player ID (025): the organiser types the account's Player ID and its email. Check
 * confirms the pair names one registered account (the email is never shown back) and lists
 * any game where that account already plays alongside this player; Link moves every seat.
 */
export function LinkPlayerDialog({ player, owner, onDismiss, onLinked }: {
  player: Player;
  owner: Player;
  onDismiss: () => void;
  onLinked: (outcome: LinkOutcome) => void;
}) {
  const { colors } = useAppTheme();
  const [idText, setIdText] = useState('');
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const reset = () => { setPreview(null); setProblem(null); };

  const check = async () => {
    const no = parsePlayerNo(idText);
    if (no === null) { setProblem('Type the Player ID number, like #42.'); setPreview(null); return; }
    if (!email.trim()) { setProblem('Type the email of the account to confirm it.'); setPreview(null); return; }
    setChecking(true);
    try {
      setPreview(await playerIdentityService.linkPreview(owner.id, player, no, email));
      setProblem(null);
    } catch (caught) {
      setPreview(null);
      setProblem(formatSupabaseError(caught));
    } finally {
      setChecking(false);
    }
  };

  const link = async () => {
    const no = parsePlayerNo(idText);
    if (!preview || no === null) return;
    setLinking(true);
    try {
      onLinked(await playerIdentityService.linkPlayerToAccount(owner.id, player, no, email));
    } catch (caught) {
      setProblem(formatSupabaseError(caught));
    } finally {
      setLinking(false);
    }
  };

  const clash = preview ? linkConflictMessage(preview) : null;
  const busy = checking || linking;

  return (
    <Dialog visible onDismiss={() => busy || onDismiss()} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>Link {player.name} to Player ID</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          If this person already has an account, type their Player ID and the email they signed up with. Both must match. Their seats and scores in every game move to that account.
        </Text>
        <TextInput
          label="Player ID"
          value={idText}
          onChangeText={(text) => { setIdText(text); reset(); }}
          mode="outlined"
          keyboardType="number-pad"
          accessibilityLabel="Player ID to link"
          testID="link-player-id"
        />
        <TextInput
          label="Email of that account"
          value={email}
          onChangeText={(text) => { setEmail(text); reset(); }}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Email of the account to link"
          testID="link-player-email"
          onSubmitEditing={check}
        />
        {problem ? <Text variant="bodyMedium" style={{ color: colors.error }} accessibilityRole="alert">{problem}</Text> : null}
        {preview ? (
          <View style={[styles.preview, { backgroundColor: clash ? colors.errorContainer : colors.positiveContainer }]} testID="link-preview">
            <Text variant="titleMedium" style={{ color: clash ? colors.onErrorContainer : colors.onPositiveContainer }}>{preview.target.name}</Text>
            <Text variant="bodySmall" style={{ color: clash ? colors.onErrorContainer : colors.onPositiveContainer }}>
              {preview.target.playerNo != null ? `#${preview.target.playerNo} · ` : ''}Registered · email confirmed
            </Text>
            <Text variant="bodySmall" style={{ color: clash ? colors.onErrorContainer : colors.onPositiveContainer, marginTop: spacing.xs }}>
              {clash ?? linkPreviewMessage(player.name, preview)}
            </Text>
          </View>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
        {preview && !clash ? (
          <Button mode="contained" onPress={link} loading={linking} disabled={busy} accessibilityLabel="Confirm link" testID="link-confirm">Link</Button>
        ) : (
          <Button mode="contained" onPress={check} loading={checking} disabled={busy || !idText.trim() || !email.trim()} accessibilityLabel="Check Player ID and email" testID="link-check">Check</Button>
        )}
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
  gap: { gap: spacing.sm },
  preview: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xxs },
});
