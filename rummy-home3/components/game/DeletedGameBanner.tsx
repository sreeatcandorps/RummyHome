import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { GameDeletion } from '@/types/game';
import { GAME_DELETED_TITLE } from '@/utils/archive';
import { askButton, askedLine, deletedBannerLine, RESTORE_GAME_LABEL } from '@/utils/deletedGames';

type Props = {
  deletion: GameDeletion;
  viewerId?: string | null;
  busy?: boolean;
  onAsk: () => void;
  onRestore: () => void;
};

/**
 * The red banner over a deleted game's read-only scorecard (G04, migration 045). A player gets one
 * button, "Ask an admin to restore" (then "Asked · Nov 10"); the creator, admins and the deleter get
 * "Restore game". Everyone sees who deleted it, when it is hidden for good, and who asked.
 */
export function DeletedGameBanner({ deletion, viewerId, busy = false, onAsk, onRestore }: Props) {
  const { colors } = useAppTheme();
  const asked = askedLine(deletion.requests, viewerId);
  const ask = askButton(deletion.myRequestAt);
  return (
    <View style={[styles.banner, { backgroundColor: colors.errorContainer }]} accessibilityRole="alert" testID="deleted-game-banner">
      <View style={styles.titleRow}>
        <Icon source="delete-alert-outline" size={22} color={colors.onErrorContainer} />
        <Text variant="titleMedium" style={[styles.title, { color: colors.onErrorContainer }]}>{GAME_DELETED_TITLE}</Text>
      </View>
      <Text variant="bodyMedium" style={{ color: colors.onErrorContainer }}>{deletedBannerLine(deletion)}</Text>
      {asked ? (
        <Text variant="bodyMedium" style={{ color: colors.onErrorContainer, fontWeight: '700' }} testID="deleted-game-asked-line">{asked}</Text>
      ) : null}
      <Text variant="bodySmall" style={{ color: colors.onErrorContainer }}>Read-only: the scores and the Log stay as they were.</Text>
      <View style={styles.actions}>
        {deletion.canRestore ? (
          <Button mode="contained" icon="restore" buttonColor={colors.error} textColor={colors.onError} onPress={onRestore} loading={busy} disabled={busy} testID="deleted-game-restore">
            {RESTORE_GAME_LABEL}
          </Button>
        ) : (
          <Button mode="outlined" icon={ask.disabled ? 'check' : 'hand-wave-outline'} textColor={colors.onErrorContainer} onPress={onAsk} loading={busy} disabled={busy || ask.disabled} testID="deleted-game-ask">
            {ask.label}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontWeight: '800', flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
});
