const TOKEN_BYTES = 24;

/** Public scorecard host. Override with EXPO_PUBLIC_SCORECARD_URL after you deploy the page. */
export const DEFAULT_SCORECARD_BASE = 'https://gngcrplcldfiubvhcdin.supabase.co/functions/v1/scorecard';

export function createViewToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isViewToken(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^[0-9a-f]{48}$/.test(value);
}

export function scorecardBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SCORECARD_URL?.trim();
  return (configured || DEFAULT_SCORECARD_BASE).replace(/\/$/, '');
}

export function scorecardUrl(token: string): string {
  return `${scorecardBaseUrl()}?t=${encodeURIComponent(token)}`;
}
