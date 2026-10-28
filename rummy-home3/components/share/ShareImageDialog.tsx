import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { ShareCardView } from '@/components/share/ShareCardView';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ShareCard } from '@/utils/shareCard';
import { shareCardImage } from '@/utils/shareImage';

export function ShareImageDialog({
  visible,
  card,
  notice,
  onDismiss,
  onShared,
  onFail,
}: {
  visible: boolean;
  card: ShareCard | null;
  notice?: string | null;
  onDismiss: () => void;
  onShared: (notice: string) => void;
  onFail: (message: string) => void;
}) {
  const { colors } = useAppTheme();
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      onShared(await shareCardImage(cardRef.current, card));
    } catch (error) {
      onFail(error instanceof Error ? error.message : 'Could not make the image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close share results" />
        <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Text variant="headlineSmall" accessibilityRole="header" style={styles.title}>Share results</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {card ? <ShareCardView card={card} cardRef={cardRef} /> : null}
            {notice ? <Text variant="bodyMedium" style={styles.notice}>{notice}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Button onPress={onDismiss} disabled={busy}>Close</Button>
            <Button mode="contained" icon="image" onPress={share} loading={busy} disabled={busy || !card}>
              Share image
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '88%',
  },
  title: {
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  scroll: {
    flexGrow: 0,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  notice: {
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
