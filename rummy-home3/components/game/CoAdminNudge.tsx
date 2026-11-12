import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Portal, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { CO_ADMIN_NUDGE_BODY, CO_ADMIN_NUDGE_TITLE } from '@/utils/coAdmin';

export { coAdminCandidates } from '@/utils/coAdmin';

/**
 * Shown once at Start game when the organiser is the only admin and a registered player is
 * seated. One tap picks the co-admin; Skip starts without one.
 */
export function CoAdminNudge({ visible, candidates, busy, onSkip, onPick }: {
  visible: boolean;
  candidates: { id: string; name: string }[];
  busy?: boolean;
  onSkip: () => void;
  onPick: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const [choice, setChoice] = useState<string | null>(null);
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={() => busy || onSkip()} style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Dialog.Icon icon="shield-account-outline" />
        <Dialog.Title style={styles.title}>{CO_ADMIN_NUDGE_TITLE}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>{CO_ADMIN_NUDGE_BODY}</Text>
          <View style={styles.chips} accessibilityLabel="Pick a co-admin">
            {candidates.map((c) => (
              <Chip key={c.id} selected={choice === c.id} showSelectedCheck onPress={() => setChoice(c.id)} accessibilityLabel={`Make ${c.name} co-admin`}>{c.name}</Chip>
            ))}
          </View>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Only registered players can be admins. You can change this later from Players · Admins.</Text>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onSkip} disabled={busy}>Skip</Button>
          <Button mode="contained" onPress={() => choice && onPick(choice)} disabled={!choice || busy} loading={busy}>Add and start</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 480, width: '90%', alignSelf: 'center' },
  title: { textAlign: 'center', fontWeight: '700' },
  content: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
});
