module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for Expo Router
      'expo-router/babel',
      // Required for Reanimated
      'react-native-reanimated/plugin',
    ],
  };
};

