import { Platform } from 'react-native';
import { storage } from '@/utils/storage';
import { isSignInMethod, SignInDefaults, SignInMethod, signInDefaults } from '@/utils/signInDefaults';

/**
 * The two inputs of the D125 rule, read each time a sign-in screen opens and never stored: the SIM's country
 * (Android; new iPhones do not expose it) and the phone's region setting. No permission is asked for either.
 */
export async function readPhoneCountryInputs(): Promise<{ sim: string | null; region: string | null }> {
  let sim: string | null = null;
  let region: string | null = null;
  if (Platform.OS !== 'web') {
    try {
      const Cellular = require('expo-cellular') as typeof import('expo-cellular');
      sim = await Cellular.getIsoCountryCodeAsync();
    } catch {
      sim = null;
    }
  }
  try {
    const Localization = require('expo-localization') as typeof import('expo-localization');
    region = Localization.getLocales()[0]?.regionCode ?? null;
  } catch {
    region = null;
  }
  return { sim, region };
}

/** The way someone last signed in on this phone (WhatsApp or Email): only that, no number, no country. */
export const LAST_SIGN_IN_METHOD_KEY = 'ezscore.lastSignInMethod';

export async function readLastSignInMethod(): Promise<SignInMethod | null> {
  const stored = await storage.getItem(LAST_SIGN_IN_METHOD_KEY);
  return isSignInMethod(stored) ? stored : null;
}

export async function rememberSignInMethod(method: SignInMethod): Promise<void> {
  await storage.setItem(LAST_SIGN_IN_METHOD_KEY, method);
}

/** Create account: `useLastUsed` false. Sign in and Forgot passcode: true. */
export async function loadSignInDefaults(useLastUsed: boolean): Promise<SignInDefaults> {
  const [{ sim, region }, lastUsed] = await Promise.all([
    readPhoneCountryInputs(),
    useLastUsed ? readLastSignInMethod() : Promise.resolve(null),
  ]);
  return signInDefaults(sim, region, lastUsed);
}
