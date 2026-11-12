/**
 * Version text shown on Home and in Help so the owner can tell which build a
 * phone is running. Pure formatting only; `utils/appVersionRuntime.ts` reads
 * the real values from the installed app.
 */

export type AppVersionInfo = {
  /** Marketing version, e.g. "1.1.0". */
  version: string | null;
  /** Android versionCode / iOS build number as installed. */
  build: string | null;
  /** Whether the JS running came with the install or from an EAS Update. */
  isEmbeddedLaunch: boolean;
  /** EAS Update id, when an update is running. */
  updateId: string | null;
};

export const APP_DISPLAY_NAME = 'EZ Score';

/**
 * "v1.1.0 (build 7)". Without a build number (Expo Go, web, a store build whose
 * native version could not be read) it is just "v1.1.0"; with no version at all it
 * is empty. Nothing here ever says "dev": that word belonged to prototype builds.
 */
export function shortVersionLabel(info: Pick<AppVersionInfo, 'version' | 'build'>): string {
  if (!info.version) return '';
  return info.build ? `v${info.version} (build ${info.build})` : `v${info.version}`;
}

/** "EZ Score v1.1.0 (build 7)", or just "EZ Score". */
export function fullVersionLabel(info: Pick<AppVersionInfo, 'version' | 'build'>): string {
  const short = shortVersionLabel(info);
  return short ? `${APP_DISPLAY_NAME} ${short}` : APP_DISPLAY_NAME;
}

/**
 * For Help: which JS bundle is running. An update id means EAS Update swapped
 * in different code than the one bundled into the APK.
 */
export function bundleSourceLabel(info: Pick<AppVersionInfo, 'isEmbeddedLaunch' | 'updateId'>): string {
  if (info.isEmbeddedLaunch || !info.updateId) return 'Running the code built into this install.';
  return `Running an over-the-air update (${info.updateId.slice(0, 8)}).`;
}

export function helpVersionText(info: AppVersionInfo): string {
  return `${fullVersionLabel(info)}. ${bundleSourceLabel(info)}`;
}
