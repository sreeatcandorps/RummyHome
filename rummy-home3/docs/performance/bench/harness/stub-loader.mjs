// Module source for every native/Expo import reached from services/*.ts. Used by stubs.mjs.
export const STUBS = {
  'react-native': `
    export const Platform = { OS: 'android', select: (o) => o.android ?? o.default };
    export const Share = { share: async () => ({ action: 'sharedAction' }) };
    export const AppState = { addEventListener: () => ({ remove() {} }) };
    export const Linking = { openURL: async () => {} };
    export default {};
  `,
  '@react-native-async-storage/async-storage': `
    const m = new Map();
    const AsyncStorage = {
      getItem: async (k) => m.get(k) ?? null,
      setItem: async (k, v) => { m.set(k, v); },
      removeItem: async (k) => { m.delete(k); },
      multiRemove: async (ks) => ks.forEach((k) => m.delete(k)),
      getAllKeys: async () => [...m.keys()],
    };
    export default AsyncStorage;
  `,
  'expo-crypto': `
    export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
    export const digestStringAsync = async () => 'deadbeef';
    export const getRandomBytes = (n) => new Uint8Array(n);
    export const randomUUID = () => '00000000-0000-4000-8000-000000000000';
  `,
  'react-native-url-polyfill/auto': `export {};`,
  'expo-constants': `export default { expoConfig: { extra: {} } };`,
  'expo-application': `export const nativeApplicationVersion = '1.1.0'; export const nativeBuildVersion = '1';`,
  'expo-linking': `export const createURL = (p) => 'rummy-home3://' + p;`,
  'expo-clipboard': `export const setStringAsync = async () => {};`,
  'expo-sharing': `export const isAvailableAsync = async () => false; export const shareAsync = async () => {};`,
  'expo-print': `export const printToFileAsync = async () => ({ uri: '' });`,
  'expo-file-system': `export const cacheDirectory = '/tmp/'; export const moveAsync = async () => {};`,
  'react-native-view-shot': `export const captureRef = async () => '';`,
};
