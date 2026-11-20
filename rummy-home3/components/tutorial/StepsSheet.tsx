import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { spacing, useAppTheme } from '@/constants/theme';
import { stepCounter, TUTORIAL_BACK, TUTORIAL_DONE, TUTORIAL_NEXT, TutorialStep } from '@/utils/tutorials';

/**
 * The step-by-step sheet (D61): a title, "n of N", one step at a time — its heading, a looping demo
 * drawn by the caller, one line of text — and Back / Next, Got it on the last step. `forced` is the
 * first-time run: no tap outside, no Cancel, the only way out is through the steps (Sree: "force
 * them to see it the first time"). Opened again later (Show me, Help › Watch how) it can be dismissed.
 */
export function StepsSheet({ visible, title, steps, renderDemo, forced = false, onDone, testID = 'steps-sheet' }: {
  visible: boolean;
  title: string;
  steps: readonly TutorialStep[];
  /** The demo for one step; it should loop on its own while mounted. */
  renderDemo: (step: number) => React.ReactNode;
  forced?: boolean;
  onDone: () => void;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const [step, setStep] = useState(0);
  useEffect(() => { if (visible) setStep(0); }, [visible]);
  const last = step === steps.length - 1;
  const current = steps[step];
  if (!current) return null;
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={forced ? undefined : onDone} dismissable={!forced} testID={testID}>
        <Dialog.Title testID={`${testID}-title`}>{title}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <View style={styles.head}>
            <Text variant="titleSmall" style={{ color: colors.primary, flex: 1 }} testID={`${testID}-step-title`}>
              {`${step + 1}  ${current.title}`}
            </Text>
            <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }} testID={`${testID}-counter`}>{stepCounter(step, steps.length)}</Text>
          </View>
          <View style={styles.demo} testID={`${testID}-demo-${step + 1}`}>{renderDemo(step)}</View>
          <Text variant="bodyMedium" style={{ color: colors.onSurface }} testID={`${testID}-line`}>{current.line}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          {step > 0 ? <Button onPress={() => setStep(step - 1)} testID={`${testID}-back`}>{TUTORIAL_BACK}</Button> : <View />}
          {last ? (
            <Button mode="contained" onPress={onDone} testID={`${testID}-done`}>{TUTORIAL_DONE}</Button>
          ) : (
            <Button mode="contained" onPress={() => setStep(step + 1)} icon="arrow-right" contentStyle={styles.nextContent} testID={`${testID}-next`}>{TUTORIAL_NEXT}</Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  demo: { minHeight: 4 * 48 + spacing.sm },
  nextContent: { flexDirection: 'row-reverse' },
});
