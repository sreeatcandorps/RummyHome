/**
 * Layered over app.json by Expo.
 *
 * EAS Update stays off unless a build profile opts in with
 * EXPO_UPDATES_ENABLED=true (see eas.json). Preview and development APKs
 * therefore always run the JavaScript built into them. Before this, every
 * 1.0.0 preview APK shared one runtime version and one channel, so whatever
 * had last been published to that channel, even something older than the
 * APK, replaced the embedded code on the second launch.
 *
 * APP_VARIANT=staging (the eas.json `staging` profile; docs/test-environment-plan.md §2, Q12) builds a
 * second app — "EZ Score · Staging", its own package id and URL scheme — that installs beside the real
 * one and talks to the staging Supabase project. Nothing else about the build changes; the default
 * (no APP_VARIANT) is byte-for-byte what it was.
 */
const STAGING = {
  nameSuffix: ' · Staging',
  idSuffix: '.staging',
  scheme: 'rummy-home3-staging',
};

module.exports = ({ config }) => {
  const updatesEnabled = process.env.EXPO_UPDATES_ENABLED === 'true';
  const variant = process.env.APP_VARIANT === 'staging' ? 'staging' : 'production';

  const base = {
    ...config,
    updates: {
      ...config.updates,
      enabled: updatesEnabled,
    },
  };
  if (variant !== 'staging') return base;

  return {
    ...base,
    name: `${config.name.replace(/: Rummy$/, '')}${STAGING.nameSuffix}`,
    scheme: STAGING.scheme,
    android: { ...config.android, package: `${config.android.package}${STAGING.idSuffix}` },
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}${STAGING.idSuffix}` },
    extra: { ...config.extra, variant },
  };
};
