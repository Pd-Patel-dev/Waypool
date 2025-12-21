// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// For web builds, ensure react-native-maps is not bundled
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Exclude react-native-maps from web builds
  if (moduleName === 'react-native-maps' && platform === 'web') {
    return {
      type: 'empty',
    };
  }
  // Use the default resolver for other modules
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
