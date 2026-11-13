import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { playerIdentityService } from '@/services/playerIdentity';
import { Player } from '@/types/player';
import { parsePlayerNo, PendingLink } from '@/utils/playerIdentity';
import { linkConflictMessage, linkPendingMessage, LinkPreview, linkPreviewMessage, LinkRequestOutcome } from '@/utils/linkPlayer';
import { formatSupabaseError } from '@/utils/supabaseErrors';

/**
 * Link to Player ID (025): the organiser types only the account's Player ID. Check names the
 * account and lists what would move, or the full conflict sentence (which game, its ID, its
 * creator). Send request asks the account owner — by email and on their Home screen — and
 * nothing moves until they say Yes. While the request is open the dialog offers Cancel request.
 */
export function LinkPlayerDialog({ player, owner, pending = null, onDismiss, onRequested, onCancelled }: {
  player: Player;
  owner: Player;
  /** The open request for this player, when the screen already knows it. */
  pending?: PendingLink | null;
  onDismiss: () => void;
  onRequested: (outcome: LinkRequestOutcome) => void;
  onCancelled?: () => void;
}) {
  const { colors } = useAppTheme();
  const [idText, setIdText] = useState(pending?.targetNo != null ? String(pending.targetNo) : '');
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [open, setOpen] = useState<LinkPreview['pending']>(pending ? { id: pending.id, expiresAt: pending.expiresAt, targetId: pending.targetId ?? null, targetNo: pending.targetNo ?? null, targetName: pending.targetName ?? null } : null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (pending) setOpen({ id: pending.id, expiresAt: pending.expiresAt, targetId: pending.targetId ?? null, targetNo: pending.targetNo ?? null, targetName: pending.targetName ?? null });
  }, [pending]);

  const reset = () => { setPreview(null); setProblem(null); };

  const check = async () => {
    const no = parsePlayerNo(idText);
    if (no === null) { setProblem('Type the Player ID number, like #42.'); setPreview(null); return; }
    setChecking(true);
    try {
      const next = await playerIdentityService.linkPreview(owner.id, player, no);
      setPreview(next);
      if (next.pending) setOpen(next.pending);
      setProblem(null);
    } catch (caught) {
      setPreview(null);
      setProblem(formatSupabaseError(caught));
    } finally {
      setChecking(false);
    }
  };

  const send = async () => {
    const no = parsePlayerNo(idText);
    if (!preview || no === null) return;
    setSending(true);
    try {
      onRequested(await playerIdentityService.requestLink(owner, player, no));
    } catch (caught) {
      setProblem(formatSupabaseError(caught));
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!open) return;
    setSending(true);
    try {
      await playerIdentityService.cancelLinkRequest(owner.id, open.id);
      setOpen(null);
      setPreview(null);
      onCancelled?.();
    } catch (caught) {
      setProblem(formatSupabaseError(caught));
    } finally {
      setSending(false);
    }
  };

  const clash = preview ? linkConflictMessage(preview) : null;
  const busy = checking || sending;

  return (
    <Dialog visible onDismiss={() => busy || onDismiss()} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>Link {player.name} to Player ID</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        {open ? (
          <View style={[styles.preview, { backgroundColor: colors.secondaryContainer }]} testID="link-pending">
            <Text variant="titleMedium" style={{ color: colors.onSecondaryContainer }}>Link pending</Text>
            <Text variant="bodySmall" style={{ color: colors.onSecondaryContainer }}>{linkPendingMessage(open)}</Text>
            <Text variant="bodySmall" style={{ color: colors.onSecondaryContainer }}>Nothing moves until they say Yes. Send again to replace this request with a new Player ID.</Text>
          </View>
        ) : (
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            If this person already has an account, type their Player ID. They get an email and an in-app request; their seats and scores move only after they say Yes.
          </Text>
        )}
        <TextInput
          label="Player ID"
          value={idText}
          onChangeText={(text) => { setIdText(text); reset(); }}
          mode="outlined"
          keyboardType="number-pad"
          accessibilityLabel="Player ID to link"
          testID="link-player-id"
          onSubmitEditing={check}
        />
        {problem ? <Text variant="bodyMedium" style={{ color: colors.error }} accessibilityRole="alert">{problem}</Text> : null}
        {preview ? (
          <View style={[styles.preview, { backgroundColor: clash ? colors.errorContainer : colors.positiveContainer }]} testID="link-preview">
            <Text variant="titleMedium" style={{ color: clash ? colors.onErrorContainer : colors.onPositiveContainer }}>{preview.target.name}</Text>
            <Text variant="bodySmall" style={{ color: clash ? colors.onErrorContainer : colors.onPositiveContainer }}>
              {preview.target.playerNo != null ? `#${preview.target.playerNo}` : 'Player ID confirmed'}
            </Text>
            <Text variant="bodySmall" style={{ color: clash ? colors.onErrorContainer : colors.onPositiveContainer, marginTop: spacing.xs }} testID={clash ? 'link-conflict' : 'link-preview-text'}>
              {clash ?? linkPreviewMessage(player.name, preview)}
            </Text>
          </View>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy}>Close</Button>
        {open ? (
          <Button mode="outlined" onPress={cancel} disabled={busy} accessibilityLabel="Cancel the link request" testID="link-cancel-request">Cancel request</Button>
        ) : null}
        {preview && !clash ? (
          <Button mode="contained" onPress={send} loading={sending} disabled={busy} accessibilityLabel="Send the link request" testID="link-send">Send request</Button>
        ) : (
          <Button mode="contained" onPress={check} loading={checking} disabled={busy || !idText.trim()} accessibilityLabel="Check Player ID" testID="link-check">Check</Button>
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
