import React from 'react';
import { Snackbar } from 'react-native-paper';
import { spacing } from '@/constants/theme';

/** A plain note stays 3 s; one with an Undo 4 s (design audit A13). */
export const TOAST_MS = 3000;
export const TOAST_UNDO_MS = 4000;
/** A bottom action bar is about this tall (buttons + padding); a toast over one sits above it. */
export const BOTTOM_BAR_CLEARANCE = 48 + spacing.md * 2;

type ToastProps = {
  /** The text; null hides the toast. */
  message: string | null;
  onDismiss: () => void;
  /** Undo (or another single action). Lengthens the stay to 4 s unless `durationMs` says otherwise. */
  action?: { label?: string; onPress: () => void; accessibilityLabel?: string; testID?: string };
  /**
   * Only for a toast that stands in for a confirm dialog (Delete result keeps its 10 s Undo, D9.1).
   * Everything else takes the standard 3 s / 4 s.
   */
  durationMs?: number;
  /** The screen has a bottom action bar: lift the toast above it. */
  aboveBar?: boolean;
  testID?: string;
};

/**
 * The one toast (A13): Paper's Snackbar (which already clears the gesture bar) with the two standard
 * durations and, when asked, lifted above the screen's bottom action bar. Notes that need an answer are dialogs, not toasts.
 */
export function Toast({ message, onDismiss, action, durationMs, aboveBar = false, testID }: ToastProps) {
  const duration = durationMs ?? (action ? TOAST_UNDO_MS : TOAST_MS);
  return (
    <Snackbar
      visible={Boolean(message)}
      onDismiss={onDismiss}
      duration={duration}
      action={action ? { label: action.label ?? 'Undo', onPress: action.onPress, accessibilityLabel: action.accessibilityLabel ?? action.label ?? 'Undo', testID: action.testID } : undefined}
      style={aboveBar ? { marginBottom: BOTTOM_BAR_CLEARANCE } : undefined}
      testID={testID}
    >
      {message ?? ''}
    </Snackbar>
  );
}
