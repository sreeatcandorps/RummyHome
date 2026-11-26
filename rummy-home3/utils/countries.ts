/**
 * Countries offered at sign-up for the optional phone number. Pure data + formatting;
 * nothing here promises availability of the service in a country.
 */
export type Country = { code: string; name: string; callingCode: string; flag: string; postalLabel: string; postalPattern: RegExp; postalExample: string };

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', callingCode: '1', flag: '🇺🇸', postalLabel: 'Zip code', postalPattern: /^\d{5}(-\d{4})?$/, postalExample: '94086' },
  { code: 'IN', name: 'India', callingCode: '91', flag: '🇮🇳', postalLabel: 'PIN code', postalPattern: /^[1-9]\d{5}$/, postalExample: '500081' },
  { code: 'CA', name: 'Canada', callingCode: '1', flag: '🇨🇦', postalLabel: 'Postal code', postalPattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, postalExample: 'M5V 3L9' },
  { code: 'GB', name: 'United Kingdom', callingCode: '44', flag: '🇬🇧', postalLabel: 'Postcode', postalPattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, postalExample: 'SW1A 1AA' },
  { code: 'AU', name: 'Australia', callingCode: '61', flag: '🇦🇺', postalLabel: 'Postcode', postalPattern: /^\d{4}$/, postalExample: '2000' },
  { code: 'AE', name: 'United Arab Emirates', callingCode: '971', flag: '🇦🇪', postalLabel: 'Postal code', postalPattern: /^.{0,10}$/, postalExample: '' },
  { code: 'SG', name: 'Singapore', callingCode: '65', flag: '🇸🇬', postalLabel: 'Postal code', postalPattern: /^\d{6}$/, postalExample: '018956' },
  { code: 'DE', name: 'Germany', callingCode: '49', flag: '🇩🇪', postalLabel: 'Postal code', postalPattern: /^\d{5}$/, postalExample: '10115' },
  { code: 'FR', name: 'France', callingCode: '33', flag: '🇫🇷', postalLabel: 'Postal code', postalPattern: /^\d{5}$/, postalExample: '75001' },
  { code: 'NZ', name: 'New Zealand', callingCode: '64', flag: '🇳🇿', postalLabel: 'Postcode', postalPattern: /^\d{4}$/, postalExample: '6011' },
  { code: 'MY', name: 'Malaysia', callingCode: '60', flag: '🇲🇾', postalLabel: 'Postcode', postalPattern: /^\d{5}$/, postalExample: '50450' },
  { code: 'LK', name: 'Sri Lanka', callingCode: '94', flag: '🇱🇰', postalLabel: 'Postal code', postalPattern: /^\d{5}$/, postalExample: '00100' },
  { code: 'NP', name: 'Nepal', callingCode: '977', flag: '🇳🇵', postalLabel: 'Postal code', postalPattern: /^\d{5}$/, postalExample: '44600' },
  { code: 'ZA', name: 'South Africa', callingCode: '27', flag: '🇿🇦', postalLabel: 'Postal code', postalPattern: /^\d{4}$/, postalExample: '8001' },
  { code: 'IE', name: 'Ireland', callingCode: '353', flag: '🇮🇪', postalLabel: 'Eircode', postalPattern: /^[A-Za-z\d]{3}\s?[A-Za-z\d]{4}$/, postalExample: 'D02 X285' },
  { code: 'NL', name: 'Netherlands', callingCode: '31', flag: '🇳🇱', postalLabel: 'Postal code', postalPattern: /^\d{4}\s?[A-Za-z]{2}$/, postalExample: '1012 AB' },
  { code: 'MX', name: 'Mexico', callingCode: '52', flag: '🇲🇽', postalLabel: 'Postal code', postalPattern: /^\d{5}$/, postalExample: '06000' },
  { code: 'BR', name: 'Brazil', callingCode: '55', flag: '🇧🇷', postalLabel: 'CEP', postalPattern: /^\d{5}-?\d{3}$/, postalExample: '01001-000' },
  { code: 'JP', name: 'Japan', callingCode: '81', flag: '🇯🇵', postalLabel: 'Postal code', postalPattern: /^\d{3}-?\d{4}$/, postalExample: '100-0001' },
  { code: 'OTHER', name: 'Other country', callingCode: '', flag: '🌐', postalLabel: 'Postal code', postalPattern: /^.{0,12}$/, postalExample: '' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function countryByCode(code: string | null | undefined): Country {
  return COUNTRIES.find((country) => country.code === code) ?? DEFAULT_COUNTRY;
}

/** E.164-style number from a country and whatever the person typed. Returns null when empty. */
export function internationalPhone(country: Country, typed: string): string | null {
  const trimmed = typed.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (!country.callingCode) return `+${digits}`;
  if (country.code === 'IN' && digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (country.code === 'IN' && digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (country.callingCode === '1' && digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return `+${country.callingCode}${digits}`;
}

/** Null when the phone is empty or plausible; otherwise what to fix. */
export function phoneForCountryProblem(country: Country, typed: string): string | null {
  const formatted = internationalPhone(country, typed);
  if (!formatted) return null;
  const national = formatted.slice(1 + country.callingCode.length);
  if (country.code === 'IN' && !/^[6-9]\d{9}$/.test(national)) return 'An Indian mobile number is 10 digits starting 6–9.';
  if (country.callingCode === '1' && !/^\d{10}$/.test(national)) return 'A US or Canadian number is 10 digits.';
  if (national.length < 6 || national.length > 14) return 'That phone number looks too short or too long.';
  return null;
}

// ---------------------------------------------------------------------------
// WhatsApp sign-in numbers (Q26 / D116): the six countries only, the same six the Twilio Verify service allows.
// ---------------------------------------------------------------------------

export type WhatsAppCountryCode = 'IN' | 'US' | 'CA' | 'GB' | 'AE' | 'AU';

export type WhatsAppCountry = {
  code: WhatsAppCountryCode;
  name: string;
  callingCode: string;
  flag: string;
  /** National number lengths accepted, and how the digits are grouped for display. */
  lengths: number[];
  groups: number[];
  example: string;
};

export const WHATSAPP_COUNTRIES: WhatsAppCountry[] = [
  { code: 'IN', name: 'India', callingCode: '91', flag: '🇮🇳', lengths: [10], groups: [5, 5], example: '98765 43210' },
  { code: 'US', name: 'United States', callingCode: '1', flag: '🇺🇸', lengths: [10], groups: [3, 3, 4], example: '415 555 0123' },
  { code: 'CA', name: 'Canada', callingCode: '1', flag: '🇨🇦', lengths: [10], groups: [3, 3, 4], example: '416 555 0123' },
  { code: 'GB', name: 'United Kingdom', callingCode: '44', flag: '🇬🇧', lengths: [10], groups: [4, 6], example: '7700 900123' },
  { code: 'AE', name: 'United Arab Emirates', callingCode: '971', flag: '🇦🇪', lengths: [9], groups: [2, 3, 4], example: '50 123 4567' },
  { code: 'AU', name: 'Australia', callingCode: '61', flag: '🇦🇺', lengths: [9], groups: [3, 3, 3], example: '412 345 678' },
];

/** WhatsApp sign-in is for India first: the code when the phone's country is unknown or not one of the six. */
export const DEFAULT_WHATSAPP_COUNTRY = WHATSAPP_COUNTRIES[0];

export function whatsAppCountry(code: string | null | undefined): WhatsAppCountry | null {
  return WHATSAPP_COUNTRIES.find((country) => country.code === code) ?? null;
}

export const WHATSAPP_COUNTRIES_SENTENCE = 'WhatsApp sign-in works with numbers from India, the US, Canada, the UK, the UAE and Australia.';

/** Longest calling code first, so +971 is not read as +9… and +44 never as +4. */
const BY_CALLING_CODE = [...WHATSAPP_COUNTRIES].sort((a, b) => b.callingCode.length - a.callingCode.length);

/**
 * A number typed with its own "+" code: the country it names and the rest of the digits. "+1" keeps Canada when
 * Canada is picked (the US and Canada share +1). Null when the "+" code is not one of the six.
 */
export function splitPlusNumber(typed: string, current: WhatsAppCountry = DEFAULT_WHATSAPP_COUNTRY): { country: WhatsAppCountry; national: string } | null {
  const trimmed = typed.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.replace(/\D/g, '');
  const match = BY_CALLING_CODE.find((country) => digits.startsWith(country.callingCode));
  if (!match) return null;
  const country = match.callingCode === '1' && current.callingCode === '1' ? current : match;
  return { country, national: digits.slice(country.callingCode.length) };
}

/** The national digits of what was typed in the box beside the picker: a leading 0 or a repeated code is dropped. */
export function whatsAppNationalDigits(country: WhatsAppCountry, typed: string): string {
  let digits = typed.replace(/\D/g, '');
  const longest = Math.max(...country.lengths);
  if (digits.length === longest + 1 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === longest + country.callingCode.length && digits.startsWith(country.callingCode)) digits = digits.slice(country.callingCode.length);
  return digits;
}

/** "+919876543210" for Supabase Auth, or null when the box is empty. A "+" code typed in the box wins over the picker. */
export function whatsAppE164(country: WhatsAppCountry, typed: string): string | null {
  const plus = splitPlusNumber(typed, country);
  const national = plus ? plus.national : whatsAppNationalDigits(country, typed);
  if (!national) return null;
  return `+${(plus?.country ?? country).callingCode}${national}`;
}

/** Null when the number can be sent a WhatsApp code; otherwise what to fix, in the app's words. */
export function whatsAppNumberProblem(country: WhatsAppCountry, typed: string): string | null {
  const trimmed = typed.trim();
  if (!trimmed.replace(/\D/g, '')) return 'Enter your WhatsApp number.';
  const plus = splitPlusNumber(trimmed, country);
  if (trimmed.startsWith('+') && !plus) return WHATSAPP_COUNTRIES_SENTENCE;
  const picked = plus?.country ?? country;
  const national = plus ? plus.national : whatsAppNationalDigits(country, trimmed);
  if (picked.code === 'IN' && !/^[6-9]\d{9}$/.test(national)) return 'An Indian WhatsApp number is 10 digits starting 6–9.';
  if (!picked.lengths.includes(national.length)) {
    return `A WhatsApp number in ${picked.code === 'US' || picked.code === 'CA' ? 'the US or Canada' : picked.code === 'GB' ? 'the UK' : picked.code === 'AE' ? 'the UAE' : picked.name} is ${picked.lengths.join(' or ')} digits after +${picked.callingCode}.`;
  }
  return null;
}

/** Supabase Auth keeps a phone as digits only ("919876543210"); the country and the national digits back. */
export function parseStoredPhone(stored: string | null | undefined): { country: WhatsAppCountry; national: string } | null {
  const digits = (stored ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const match = BY_CALLING_CODE.find((country) => digits.startsWith(country.callingCode) && country.lengths.includes(digits.length - country.callingCode.length));
  return match ? { country: match, national: digits.slice(match.callingCode.length) } : null;
}

function group(national: string, groups: number[]): string {
  const parts: string[] = [];
  let at = 0;
  for (const size of groups) {
    if (at >= national.length) break;
    parts.push(national.slice(at, at + size));
    at += size;
  }
  if (at < national.length) parts.push(national.slice(at));
  return parts.join(' ');
}

/** "+91 98765 43210" from "919876543210" or "+919876543210"; an unknown shape comes back as "+<digits>". */
export function formatWhatsAppNumber(stored: string | null | undefined): string {
  const parsed = parseStoredPhone(stored);
  if (!parsed) {
    const digits = (stored ?? '').replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }
  return `+${parsed.country.callingCode} ${group(parsed.national, parsed.country.groups)}`;
}

/** "+91 98xxx xx210": the first two and last three digits shown, so the person knows which number got the code. */
export function maskWhatsAppNumber(stored: string | null | undefined): string {
  const parsed = parseStoredPhone(stored);
  if (!parsed) return formatWhatsAppNumber(stored);
  const { national } = parsed;
  const masked = national.slice(0, 2) + 'x'.repeat(Math.max(0, national.length - 5)) + national.slice(-3);
  return `+${parsed.country.callingCode} ${group(masked, parsed.country.groups)}`;
}

/** Null when empty or valid for the country; otherwise what to fix. */
export function postalProblem(country: Country, typed: string): string | null {
  const value = typed.trim();
  if (!value) return null;
  if (!country.postalPattern.test(value)) {
    return country.postalExample ? `${country.postalLabel} should look like ${country.postalExample}.` : `${country.postalLabel} is too long.`;
  }
  return null;
}
