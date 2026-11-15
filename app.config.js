// Extends app.json with what depends on the build profile. `EAS_BUILD_PROFILE` is set by EAS Build; a local
// `expo start` / `expo run` has none and counts as development.
const withNetworkPolicy = require('./plugins/withNetworkPolicy');

const RELEASE_PROFILES = new Set(['preview', 'production']);

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const release = profile !== undefined && RELEASE_PROFILES.has(profile);
  if (release) {
    // The dev menu's overlay permission has no place in a build testers or users install.
    config.android = {
      ...config.android,
      blockedPermissions: [
        ...(config.android?.blockedPermissions ?? []),
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    };
  }
  return withNetworkPolicy(config, { allowCleartext: !release });
};
