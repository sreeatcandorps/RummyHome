/**
 * Layered over app.json by Expo.
 *
 * EAS Update stays off unless a build profile opts in with
 * EXPO_UPDATES_ENABLED=true (see eas.json). Preview and development APKs
 * therefore always run the JavaScript built into them. Before this, every
 * 1.0.0 preview APK shared one runtime version and one channel, so whatever
 * had last been published to that channel, even something older than the
 * APK, replaced the embedded code on the second launch.
 */
module.exports = ({ config }) => {
  const updatesEnabled = process.env.EXPO_UPDATES_ENABLED === 'true';

  return {
    ...config,
    updates: {
      ...config.updates,
      enabled: updatesEnabled,
    },
  };
};
