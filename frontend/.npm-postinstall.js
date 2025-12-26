// Post-install script - DISABLED
// We need the real Supabase Realtime package for web platform
// The stub was only needed for React Native, but we're using web now

// IMPORTANT: Do NOT replace @supabase/realtime-js with stub
// The real package is needed for Supabase Realtime to work on web

const fs = require('fs');
const path = require('path');

const realtimeJsPath = path.join(__dirname, 'node_modules', '@supabase', 'realtime-js');
const backupPath = path.join(__dirname, 'node_modules', '@supabase', 'realtime-js.backup');

// If backup exists (from previous stub installation), restore it
if (fs.existsSync(backupPath)) {
  console.log('Restoring original @supabase/realtime-js from backup...');
  if (fs.existsSync(realtimeJsPath)) {
    fs.rmSync(realtimeJsPath, { recursive: true, force: true });
  }
  fs.renameSync(backupPath, realtimeJsPath);
  console.log('✓ Original @supabase/realtime-js restored');
} else {
  console.log('✓ Using real @supabase/realtime-js package (no stub)');
}

