import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Dialog, Text } from 'react-native-paper';
import { HelpButton } from '@/components/ui/HelpButton';
import { HELP } from '@/constants/help';
import { radius, spacing, useAppTheme } from '@/constants/theme';

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
  startedLabel?: string;
  gameLabel?: string;
  busy?: boolean;
  notice?: string | null;
  onDismiss: () => void;
  onCopy: () => void;
  onEmail: (people: SharePerson[]) => void;
  onPreview: () => void;
};

export function ShareDialog({
  visible,
  people,
  link,
  startedLabel,
  gameLabel,
  busy,
  notice,
  onDismiss,
  onCopy,
  onEmail,
  onPreview,
}: ShareDialogProps) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setSelected(people.map((person) => person.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>
        <View style={styles.titleRow}>
          <Text variant="titleLarge" style={styles.title}>Share scorecard</Text>
          <HelpButton text={HELP.share} />
        </View>
      </Dialog.Title>
      <Dialog.ScrollArea style={styles.scroll}>
        <ScrollView>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            Anyone with the link can watch.
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
      </Dialog.ScrollArea>
      <Dialog.Actions style={styles.actions}>
        <Button onPress={onDismiss} disabled={busy}>Close</Button>
        <Button mode="outlined" icon="eye-outline" onPress={onPreview} disabled={busy || !link}>Preview</Button>
        <Button mode="outlined" icon="content-copy" onPress={onCopy} disabled={busy || !link}>Copy link</Button>
        <Button
          mode="contained"
          icon="email-outline"
          onPress={() => onEmail(people.filter((person) => selected.includes(person.id)))}
          loading={busy}
          disabled={busy || selected.length === 0}
        >
          Email selected
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 520,
    width: '92%',
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 360,
    paddingHorizontal: spacing.md,
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
