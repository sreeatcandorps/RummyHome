import React, { useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useNavigation } from 'expo-router';
import { ShareImageDialog } from '@/components/share/ShareImageDialog';
import { HelpButton } from '@/components/ui/HelpButton';
import { HELP } from '@/constants/help';
import { ShareCard } from '@/utils/shareCard';

/** Header share. The results page body stays the four sections. */
export function ResultsShare({ card }: { card: ShareCard | null }) {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.tools}>
          <IconButton
            icon="share-variant"
            size={22}
            accessibilityLabel="Share results"
            onPress={() => setOpen(true)}
            disabled={!card}
          />
          <HelpButton text={HELP.results} />
        </View>
      ),
    });
  }, [navigation, card]);

  return (
    <ShareImageDialog
      visible={open}
      card={card}
      notice={notice}
      onDismiss={() => setOpen(false)}
      onShared={setNotice}
      onFail={setNotice}
    />
  );
}

const styles = StyleSheet.create({
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
