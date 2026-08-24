const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK ships .cjs files that Metro's package.json "exports"
// resolution (default on since Expo SDK 53) misresolves, causing a
// "Component auth has not been registered yet" crash on launch.
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts.push('cjs');

module.exports = config;
