import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
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
  title = 'Share results',
  shareLabel = 'Share image',
  onDetails,
  detailsBusy = false,
}: {
  visible: boolean;
  card: ShareCard | null;
  notice?: string | null;
  onDismiss: () => void;
  onShared: (notice: string) => void;
  onFail: (message: string) => void;
  title?: string;
  shareLabel?: string;
  onDetails?: () => void;
  detailsBusy?: boolean;
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
          <View style={styles.header}>
            <Text variant="headlineSmall" accessibilityRole="header" style={styles.title}>{title}</Text>
            <IconButton icon="close" size={22} onPress={onDismiss} disabled={busy || detailsBusy} accessibilityLabel="Close" />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {card ? <ShareCardView card={card} cardRef={cardRef} /> : null}
            {notice ? <Text variant="bodyMedium" style={styles.notice}>{notice}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Button mode="contained" icon="image" onPress={share} loading={busy} disabled={busy || detailsBusy || !card} style={styles.action}>
              {shareLabel}
            </Button>
            {onDetails ? (
              <Button mode="outlined" icon="file-pdf-box" onPress={onDetails} loading={detailsBusy} disabled={busy || detailsBusy} style={styles.action}>
                Share full details (PDF)
              </Button>
            ) : null}
            <Button onPress={onDismiss} disabled={busy || detailsBusy} style={styles.action}>Close</Button>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingTop: spacing.sm,
  },
  title: {
    fontWeight: '700',
    flex: 1,
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
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  action: {
    width: '100%',
  },
});
