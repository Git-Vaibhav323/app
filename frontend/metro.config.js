// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Note: @supabase/realtime-js has been replaced with a stub in node_modules
// to avoid Node.js dependencies (ws, events) that don't work in React Native
// The stub provides the same interface but without realtime functionality

// Metro automatically resolves platform-specific files (.web.ts, .native.ts)
// No additional configuration needed

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
