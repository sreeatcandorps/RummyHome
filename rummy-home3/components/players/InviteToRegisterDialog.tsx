import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { playerIdentityService } from '@/services/playerIdentity';
import { Player } from '@/types/player';
import { formatSupabaseError } from '@/utils/supabaseErrors';

/**
 * Invite to register, from the player ⋮ menu: prepares a one-time sign-up link and opens the
 * share sheet. The same dialog on the game's Players page and on My players.
 */
export function InviteToRegisterDialog({ player, owner, gameNumbers = [], onDismiss, onPrepared }: {
  player: Player;
  owner: Player;
  gameNumbers?: number[];
  onDismiss: () => void;
  /** Called once the link exists (shared or not), so the caller can show Pending registration. */
  onPrepared?: () => void;
}) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const prepare = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await playerIdentityService.shareClaimLink(owner, player, gameNumbers);
      setNotice(result.notice);
      setMessage(result.shared ? null : result.message);
      onPrepared?.();
    } catch (caught) {
      setFailure(formatSupabaseError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog visible onDismiss={() => busy || onDismiss()} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>Invite {player.name} to register</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="bodyMedium">
          Prepares a one-time sign-up link and opens your share sheet so you can send it on WhatsApp, text, or anything else. Nothing is sent until you pick where. The link works once and lasts 14 days.
        </Text>
        {notice ? <Text variant="bodyMedium" style={{ fontWeight: '700' }}>{notice}</Text> : null}
        {failure ? <Text variant="bodyMedium" style={{ color: colors.error }}>{failure}</Text> : null}
        {message ? (
          <View style={[styles.preview, { backgroundColor: colors.surfaceVariant }]}>
            <Text variant="bodySmall" selectable>{message}</Text>
            <Button compact icon="content-copy" onPress={() => Clipboard.setStringAsync(message)}>Copy</Button>
          </View>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy}>Close</Button>
        <Button mode="contained" icon="share-variant" loading={busy} disabled={busy} onPress={prepare} accessibilityLabel="Prepare invite link">
          {notice ? 'Share again' : 'Prepare link'}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
  gap: { gap: spacing.sm },
  preview: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xxs },
});
