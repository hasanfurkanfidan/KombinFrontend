// Build-time network policy (an Expo config plugin: it edits the generated manifest/plist, no native code of its own).
// Development builds may talk plain http to a LAN address or the Android emulator's 10.0.2.2; preview and production
// builds allow https only: Android `usesCleartextTraffic="false"`, iOS App Transport Security without any exception.
const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

function withNetworkPolicy(config, { allowCleartext = false } = {}) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = allowCleartext ? 'true' : 'false';
    }
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSAppTransportSecurity = allowCleartext
      ? { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true }
      : { NSAllowsArbitraryLoads: false };
    if (!allowCleartext) {
      // Only the development launcher looks for a Metro server on the local network; a release build never does,
      // so it does not ask for local-network access (and shows no English purpose string for it).
      delete mod.modResults.NSLocalNetworkUsageDescription;
      delete mod.modResults.NSBonjourServices;
    }
    return mod;
  });
  return config;
}

module.exports = withNetworkPolicy;
