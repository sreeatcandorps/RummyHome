import * as Haptics from 'expo-haptics';

/** A light tap of the phone (D61: the real last tap of the Order of players). Never throws: no motor, no problem. */
export async function lightTap(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Emulators and some phones have no haptics.
  }
}
