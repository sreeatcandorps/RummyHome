import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ShareCardView, SHARE_RENDER_WIDTH, shareImageSize } from '@/components/share/ShareCardView';
import { ShareCard } from '@/utils/shareCard';
import { CaptureSize } from '@/utils/shareImage';

/**
 * The picture is captured from this copy of the card, not from the preview on screen: it is
 * laid out SHARE_RENDER_WIDTH wide off the left edge, ignores the phone's font scale, and is
 * scaled to SHARE_IMAGE_WIDTH pixels on capture — so every phone sends the same image and a
 * 20-player card is never squeezed into a dialog (PR 10b, Q10.16).
 */
export function useShareCapture(): { ref: React.RefObject<View | null>; size: CaptureSize | undefined; onHeight: (height: number) => void } {
  const ref = useRef<View>(null);
  const [height, setHeight] = useState(0);
  return { ref, size: height > 0 ? shareImageSize(height) : undefined, onHeight: setHeight };
}

export function OffscreenShareCard({ card, cardRef, onHeight }: { card: ShareCard; cardRef: React.Ref<View>; onHeight: (height: number) => void }) {
  return (
    <View pointerEvents="none" style={styles.offscreen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <ShareCardView card={card} cardRef={cardRef} fixed onLayoutHeight={onHeight} testID="share-capture" />
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: 0, left: -SHARE_RENDER_WIDTH * 4, width: SHARE_RENDER_WIDTH },
});
