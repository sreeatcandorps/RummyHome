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

/** "v1.1.0 (build 7)". A missing build number reads "dev" so Expo Go and web still show something. */
export function shortVersionLabel(info: Pick<AppVersionInfo, 'version' | 'build'>): string {
  const version = info.version ? `v${info.version}` : 'dev';
  const build = info.build ? `build ${info.build}` : 'dev build';
  return `${version} (${build})`;
}

/** "EZ Score v1.1.0 (build 7)". */
export function fullVersionLabel(info: Pick<AppVersionInfo, 'version' | 'build'>): string {
  return `${APP_DISPLAY_NAME} ${shortVersionLabel(info)}`;
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
