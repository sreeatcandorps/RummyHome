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

/** Null when empty or valid for the country; otherwise what to fix. */
export function postalProblem(country: Country, typed: string): string | null {
  const value = typed.trim();
  if (!value) return null;
  if (!country.postalPattern.test(value)) {
    return country.postalExample ? `${country.postalLabel} should look like ${country.postalExample}.` : `${country.postalLabel} is too long.`;
  }
  return null;
}
