import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Dialog, Text, TextInput } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';

export type SharePerson = {
  id: string;
  name: string;
  email?: string;
};

type ShareDialogProps = {
  visible: boolean;
  people: SharePerson[];
  link: string;
  busy?: boolean;
  notice?: string | null;
  onDismiss: () => void;
  onCopy: () => void;
  onEmail: (emails: string[]) => void;
};

export function ShareDialog({ visible, people, link, busy, notice, onDismiss, onCopy, onEmail }: ShareDialogProps) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setSelected(people.filter((person) => person.email).map((person) => person.id));
    // Preselect once each time the sheet opens. `people` is read at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const emails = people.filter((person) => selected.includes(person.id) && person.email).map((person) => person.email as string);

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title style={styles.title}>Share scorecard</Dialog.Title>
      <Dialog.ScrollArea style={styles.scroll}>
        <ScrollView>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            Everyone in the game starts selected. The link is view-only and does not need a sign-in.
          </Text>
          {people.map((person) => (
            <Checkbox.Item
              key={person.id}
              label={person.email ? `${person.name}` : `${person.name} (no email)`}
              status={person.email && selected.includes(person.id) ? 'checked' : 'unchecked'}
              disabled={!person.email || busy}
              onPress={() => toggle(person.id)}
              labelStyle={styles.checkLabel}
            />
          ))}
          <TextInput
            mode="outlined"
            label="Link"
            value={link}
            editable={false}
            multiline
            style={styles.link}
          />
          {notice ? (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {notice}
            </Text>
          ) : null}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions style={styles.actions}>
        <Button onPress={onDismiss} disabled={busy}>Close</Button>
        <Button mode="outlined" icon="content-copy" onPress={onCopy} disabled={busy || !link}>
          Copy link
        </Button>
        <Button
          mode="contained"
          icon="email-outline"
          onPress={() => onEmail(emails)}
          loading={busy}
          disabled={busy || emails.length === 0}
        >
          Email
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
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  scroll: {
    maxHeight: 360,
    paddingHorizontal: spacing.md,
  },
  checkLabel: {
    textAlign: 'left',
  },
  link: {
    marginTop: spacing.sm,
  },
  actions: {
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
