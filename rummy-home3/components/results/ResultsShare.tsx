import React, { useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useNavigation } from 'expo-router';
import { ShareImageDialog } from '@/components/share/ShareImageDialog';
import { HelpButton } from '@/components/ui/HelpButton';
import { HELP } from '@/constants/help';
import { ShareCard } from '@/utils/shareCard';
import { ResultsDetails } from '@/utils/resultsDetails';
import { shareResultsPdf } from '@/utils/shareResultsPdf';

type Props = {
  card: ShareCard | null;
  details: ResultsDetails | null;
  createdAt?: string;
};

/**
 * Header Share and Help. Sharing is allowed before the result is saved: the picture and the
 * PDF then carry the same "Not saved yet" banner and warnings as the screen (card.notes).
 * The one Save button lives in the screen body.
 */
export function ResultsShare({ card, details, createdAt }: Props) {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.tools}>
          <IconButton
            icon="share-variant"
            size={22}
            accessibilityLabel="Share"
            testID="results-share-icon"
            onPress={() => {
              setNotice(null);
              setOpen(true);
            }}
            disabled={!card}
          />
          <HelpButton text={HELP.results} />
        </View>
      ),
    });
  }, [navigation, card]);

  const sharePdf = async () => {
    if (!details || pdfBusy) return;
    setPdfBusy(true);
    try {
      setNotice(await shareResultsPdf(details, createdAt));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not make the PDF.');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <ShareImageDialog
      visible={open}
      card={card}
      notice={notice}
      title="Share"
      shareLabel="Share results"
      onDismiss={() => setOpen(false)}
      onShared={setNotice}
      onFail={setNotice}
      onDetails={details ? sharePdf : undefined}
      detailsBusy={pdfBusy}
    />
  );
}

const styles = StyleSheet.create({
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
