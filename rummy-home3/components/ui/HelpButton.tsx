import React, { useState } from 'react';
import { Button, Dialog, IconButton, Portal } from 'react-native-paper';
import { useAppTheme } from '@/constants/theme';
import { HelpText } from '@/components/ui/HelpText';

type HelpButtonProps = {
  text: string;
  color?: string;
};

/** Small ? that opens a short note. Tap the icon again or outside the note to close it. */
export function HelpButton({ text, color }: HelpButtonProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        icon={open ? 'close-circle-outline' : 'help-circle-outline'}
        size={22}
        iconColor={color ?? colors.onSurface}
        onPress={() => setOpen((current) => !current)}
        accessibilityLabel="Help"
      />
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)}>
          <Dialog.Title>Help</Dialog.Title>
          <Dialog.Content>
            <HelpText text={text} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
