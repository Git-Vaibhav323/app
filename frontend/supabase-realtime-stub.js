// Stub for @supabase/realtime-js to avoid Node.js dependencies in React Native
// This prevents Metro from trying to bundle Node.js-specific modules (ws, events)

// Use CommonJS exports for better compatibility with Metro
class RealtimeClient {
  constructor() {
    // Stub - realtime features are not used in React Native
  }
  
  connect() {
    console.warn('Realtime features are disabled in React Native');
  }
  
  disconnect() {
    // Stub
  }
  
  channel() {
    return {
      subscribe: () => ({ unsubscribe: () => {} }),
      on: () => {},
      off: () => {},
      send: () => {},
    };
  }
  
  removeChannel() {
    // Stub
  }
  
  removeAllChannels() {
    // Stub
  }
  
  log() {
    // Stub
  }
  
  isConnected() {
    return false;
  }
}

// Export for both CommonJS and ESM compatibility
module.exports = RealtimeClient;
module.exports.RealtimeClient = RealtimeClient;
module.exports.default = RealtimeClient;
