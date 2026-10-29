import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Text } from 'react-native-paper';
import { ShareCardView } from '@/components/share/ShareCardView';
import { HelpButton } from '@/components/ui/HelpButton';
import { HELP } from '@/constants/help';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ShareCard } from '@/utils/shareCard';
import { shareCardImage } from '@/utils/shareImage';

export type SharePerson = {
  id: string;
  name: string;
  playerCode?: string;
  /** Used to send. Never rendered. */
  email?: string;
};

type ShareDialogProps = {
  visible: boolean;
  people: SharePerson[];
  link: string;
  card: ShareCard;
  startedLabel?: string;
  gameLabel?: string;
  busy?: boolean;
  notice?: string | null;
  onDismiss: () => void;
  onCopy: () => void;
  onEmail: (people: SharePerson[]) => void;
  onPreview: () => void;
  onNotice: (message: string) => void;
};

export function ShareDialog({
  visible,
  people,
  link,
  card,
  startedLabel,
  gameLabel,
  busy,
  notice,
  onDismiss,
  onCopy,
  onEmail,
  onPreview,
  onNotice,
}: ShareDialogProps) {
  const { colors } = useAppTheme();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setSelected(people.map((person) => person.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const shareImage = async () => {
    setSharing(true);
    try {
      onNotice(await shareCardImage(cardRef.current, card));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not make the image.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Close share scorecard" />
        <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <View style={styles.titleRow}>
            <Text variant="headlineSmall" accessibilityRole="header" style={styles.title}>Share scorecard</Text>
            <HelpButton text={HELP.share} />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <ShareCardView card={card} cardRef={cardRef} />
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginTop: spacing.md }}>
              Anyone with the link can watch. Share image is the picture for WhatsApp.
            </Text>
            {startedLabel ? (
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Started {startedLabel}</Text>
            ) : null}
            {gameLabel ? (
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>ID {gameLabel}</Text>
            ) : null}
            {people.map((person) => (
              <Checkbox.Item
                key={person.id}
                label={`${person.name}${person.playerCode ? `  ${person.playerCode}` : ''}`}
                status={selected.includes(person.id) ? 'checked' : 'unchecked'}
                disabled={busy}
                onPress={() => toggle(person.id)}
                labelStyle={styles.checkLabel}
              />
            ))}
            {notice ? (
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{notice}</Text>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Button onPress={onDismiss} disabled={busy || sharing}>Close</Button>
            <Button mode="contained" icon="image" onPress={shareImage} loading={sharing} disabled={busy || sharing}>
              Share image
            </Button>
            <Button mode="outlined" icon="content-copy" onPress={onCopy} disabled={busy || sharing || !link}>Copy link</Button>
            <Button
              mode="outlined"
              icon="email-outline"
              onPress={() => onEmail(people.filter((person) => selected.includes(person.id)))}
              loading={busy}
              disabled={busy || sharing || selected.length === 0}
            >
              Email selected
            </Button>
            <Button mode="outlined" icon="eye-outline" onPress={onPreview} disabled={busy || sharing || !link}>Preview</Button>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 420,
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingVertical: spacing.md,
  },
  checkLabel: {
    textAlign: 'left',
  },
  actions: {
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
