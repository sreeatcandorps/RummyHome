import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { radius, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

/** A sheet is never wider than this (tablets, landscape); it sits centred. */
export const SHEET_MAX_WIDTH = 560;
/** Share of the window the sheet may take; the rest stays dimmed. */
export const SHEET_MAX_HEIGHT = 0.9;

/**
 * A bottom sheet with a pinned header and footer and a list that scrolls between them (design-review-2
 * §8.1 / §10.6: "what if there are more players, will it scroll?" — only the list does). The backdrop does
 * not close it: the footer's button says where it goes. Android back calls `onRequestClose` when given.
 */
export function BottomSheet({ visible, header, footer, children, onRequestClose, testID, scrollRef }: {
  visible: boolean;
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
  onRequestClose?: () => void;
  testID?: string;
  scrollRef?: React.Ref<ScrollView>;
}) {
  const { colors } = useAppTheme();
  const { width, height, insets } = useLayout();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => onRequestClose?.()}>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, width: Math.min(width, SHEET_MAX_WIDTH), maxHeight: Math.round(height * SHEET_MAX_HEIGHT) },
          ]}
          testID={testID}
        >
          <View style={[styles.handle, { backgroundColor: colors.outline }]} />
          <View style={[styles.header, { borderBottomColor: colors.hairline }]}>{header}</View>
          <ScrollView ref={scrollRef} style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator testID={testID ? `${testID}-list` : undefined}>
            {children}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: colors.hairline, paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>{footer}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full, marginTop: 8, opacity: 0.5 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  list: { flexGrow: 0, flexShrink: 1 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
