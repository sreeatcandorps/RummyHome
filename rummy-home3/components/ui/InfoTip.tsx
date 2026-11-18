import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, Text } from 'react-native-paper';
import { HelpLine } from '@/components/help/HelpRich';
import { openHelp } from '@/components/help/HelpPage';
import { HelpTopicKey } from '@/constants/helpTopics';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';

export const INFO_TIP_CLOSE = 'Got it';
export const INFO_TIP_MORE = 'Full guide';

export type InfoTipProps = {
  /** The pop-up's heading — the label of the thing it explains, exactly as on screen. */
  title: string;
  /** One to three short lines (help markup allowed). */
  text: string | readonly string[];
  /** Optional link to the screen's help page (and anchor) for the long version. */
  topic?: HelpTopicKey;
  anchor?: string;
  color?: string;
  testID?: string;
};

/**
 * Mini help (Sree, Nov 17): a small ⓘ beside a section title instead of a paragraph under it.
 * One tap opens a short pop-up; a tap anywhere (Got it, outside) closes it. The screen stays clean,
 * nothing is lost — the long version is one more tap away in the Full guide.
 */
export function InfoTip({ title, text, topic, anchor, color, testID = 'info-tip' }: InfoTipProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const lines = typeof text === 'string' ? [text] : text;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        style={styles.target}
        accessibilityRole="button"
        accessibilityLabel={`About ${title}`}
        testID={testID}
      >
        <Icon source="information-outline" size={18} color={color ?? colors.onSurfaceVariant} />
      </Pressable>
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)} style={styles.dialog} testID={`${testID}-popup`}>
          <View style={styles.body}>
            <View style={styles.head}>
              <Icon source="information-outline" size={20} color={colors.primary} />
              <Text variant="titleMedium" style={styles.title}>{title}</Text>
            </View>
            <View style={styles.lines}>
              {lines.map((line, i) => <HelpLine key={i} text={line} />)}
            </View>
            <View style={styles.actions}>
              {topic ? (
                <Pressable onPress={() => { setOpen(false); openHelp(topic, anchor); }} style={styles.action} accessibilityRole="link" testID={`${testID}-more`}>
                  <Text variant="labelLarge" style={{ color: colors.primary }}>{INFO_TIP_MORE}</Text>
                </Pressable>
              ) : <View />}
              <Pressable onPress={() => setOpen(false)} style={[styles.action, styles.close, { backgroundColor: colors.primary }]} accessibilityRole="button" testID={`${testID}-close`}>
                <Text variant="labelLarge" style={{ color: colors.onPrimary }}>{INFO_TIP_CLOSE}</Text>
              </Pressable>
            </View>
          </View>
        </Dialog>
      </Portal>
    </>
  );
}

/** A section title with its ⓘ on the same line. */
export function TitleWithTip({ title, tip, variant = 'titleSmall' }: { title: string; tip: Omit<InfoTipProps, 'title'>; variant?: 'titleSmall' | 'titleMedium' }) {
  return (
    <View style={styles.titleRow}>
      <Text variant={variant} style={styles.titleText}>{title}</Text>
      <InfoTip title={title} {...tip} />
    </View>
  );
}

const styles = StyleSheet.create({
  target: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  dialog: { borderRadius: radius.lg, maxWidth: 420, alignSelf: 'center', width: '92%' },
  body: { padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontWeight: '700', flex: 1 },
  lines: { gap: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  action: { minHeight: MIN_TOUCH_TARGET - 8, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  close: { paddingHorizontal: spacing.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  titleText: { fontWeight: '700' },
});
