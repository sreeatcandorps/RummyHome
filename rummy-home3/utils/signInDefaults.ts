/**
 * Which way in and which country code a sign-in screen starts on (D125, WhatsApp spec §8.1).
 *
 * Sree (Nov 25): "I think maybe in the US, you want to have the email selected as a default, and in India,
 * WhatsApp. Also, depending on the location, I think the country code should automatically populate for
 * WhatsApp, right?" … "Sure, the regions setting is good."
 *
 * - The phone's country is the SIM's country first (Android, expo-cellular), else the region setting
 *   (expo-localization), else unknown. Never GPS, never a permission, never stored.
 *   The SIM wins because many Indian Android phones keep the factory "English (United States)", so their
 *   region reads US.
 * - Create account starts on WhatsApp in India and on Email everywhere else, unknown included.
 * - The country code is that country's when it is one of the six WhatsApp countries, otherwise +91.
 * - Sign in and Forgot passcode start on the way last used on this phone; the country rule applies only
 *   before anyone has signed in on it.
 */
import { DEFAULT_WHATSAPP_COUNTRY, WhatsAppCountryCode, whatsAppCountry } from '@/utils/countries';

export type SignInMethod = 'whatsapp' | 'email';

export type SignInDefaults = {
  method: SignInMethod;
  /** One of the six WhatsApp countries; the number box's picker starts here. */
  country: WhatsAppCountryCode;
  /** "+91", "+1", … the same country's code, for display and tests. */
  dialCode: string;
};

/** "in", " IN ", "--" (iPhone without a readable SIM), "" → "IN" or null. */
export function cleanCountryCode(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

/** The phone's country: the SIM's, else the region setting's, else null. */
export function phoneCountry(simCountry: string | null | undefined, regionCode: string | null | undefined): string | null {
  return cleanCountryCode(simCountry) ?? cleanCountryCode(regionCode);
}

export function isSignInMethod(value: unknown): value is SignInMethod {
  return value === 'whatsapp' || value === 'email';
}

/**
 * Create account passes `lastUsed` null (it always follows the country). Sign in and Forgot passcode pass the
 * way last used on this phone, which wins over the country.
 */
export function signInDefaults(
  simCountry: string | null | undefined,
  regionCode: string | null | undefined,
  lastUsed: SignInMethod | null | undefined,
): SignInDefaults {
  const country = phoneCountry(simCountry, regionCode);
  const picked = whatsAppCountry(country) ?? DEFAULT_WHATSAPP_COUNTRY;
  const method: SignInMethod = isSignInMethod(lastUsed) ? lastUsed : country === 'IN' ? 'whatsapp' : 'email';
  return { method, country: picked.code, dialCode: `+${picked.callingCode}` };
}
