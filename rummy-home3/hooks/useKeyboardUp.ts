import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** True while the on-screen keyboard is open (Android reports it once open, iOS as it starts to open). */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}
