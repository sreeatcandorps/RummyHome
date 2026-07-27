const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function randomBytes(length: number): Uint8Array {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  try {
    // React Native / Expo
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoCrypto = require('expo-crypto') as { getRandomBytes: (n: number) => Uint8Array };
    if (typeof ExpoCrypto.getRandomBytes === 'function') {
      return ExpoCrypto.getRandomBytes(length);
    }
  } catch {
    // fall through
  }

  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** Always returns a RFC UUID v4 — React Native often lacks crypto.randomUUID(). */
export function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
