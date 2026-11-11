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
  /** Unsaved results: a Save icon sits beside Share, and Share stays off until the result is saved. */
  onSave?: () => void;
  saveDisabled?: boolean;
  saving?: boolean;
  /** False while the result is not saved yet (sharing requires saving first). */
  shareEnabled?: boolean;
};

/** Header Save (when offered) and Share. The results page body stays the four sections. */
export function ResultsShare({ card, details, createdAt, onSave, saveDisabled = false, saving = false, shareEnabled = true }: Props) {
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.tools}>
          {onSave ? (
            <IconButton
              icon="content-save-outline"
              size={22}
              accessibilityLabel="Save result"
              testID="results-save-icon"
              onPress={onSave}
              disabled={saveDisabled || saving}
            />
          ) : null}
          <IconButton
            icon="share-variant"
            size={22}
            accessibilityLabel={shareEnabled ? 'Share' : 'Share (save the result first)'}
            testID="results-share-icon"
            onPress={() => {
              setNotice(null);
              setOpen(true);
            }}
            disabled={!card || !shareEnabled}
          />
          <HelpButton text={HELP.results} />
        </View>
      ),
    });
  }, [navigation, card, onSave, saveDisabled, saving, shareEnabled]);

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
