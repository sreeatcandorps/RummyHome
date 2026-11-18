import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { AppVersionInfo } from '@/utils/appVersion';

/**
 * Reads the installed app's version. Native values win; the app config is the
 * fallback for Expo Go and web, where there is no installed binary.
 */
export function readAppVersion(): AppVersionInfo {
  const config = Constants.expoConfig;
  const configBuild = config?.android?.versionCode ?? config?.ios?.buildNumber ?? null;

  return {
    version: Application.nativeApplicationVersion ?? config?.version ?? null,
    build: Application.nativeBuildVersion ?? (configBuild != null ? String(configBuild) : null),
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId ?? null,
  };
}
