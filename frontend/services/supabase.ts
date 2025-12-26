import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

// Get Supabase URL and Anon Key from environment variables
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Check if Supabase is configured (non-empty strings)
const isSupabaseConfigured = supabaseUrl && 
  supabaseAnonKey && 
  typeof supabaseUrl === 'string' && 
  typeof supabaseAnonKey === 'string' &&
  supabaseUrl.trim() !== '' && 
  supabaseAnonKey.trim() !== '';

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.warn('⚠️ Supabase is not configured. Google/Apple OAuth will not work.');
  console.warn('   To enable OAuth, set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in app.json');
}

// Use placeholder values if not configured (prevents client creation error)
const finalSupabaseUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const finalSupabaseKey = isSupabaseConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder';

// Lazy initialization to prevent SSR issues
let supabaseClient: ReturnType<typeof createClient> | null = null;

// Create a simple storage adapter that works on both web and native
const createStorageAdapter = () => {
  // Check if we're in a browser environment
  const isClient = typeof window !== 'undefined';
  
  if (Platform.OS === 'web' && isClient) {
    // Use localStorage for web
    return {
      getItem: (key: string) => {
        try {
          return Promise.resolve(localStorage.getItem(key));
        } catch {
          return Promise.resolve(null);
        }
      },
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key);
          return Promise.resolve();
        } catch {
          return Promise.resolve();
        }
      },
    };
  } else if (Platform.OS !== 'web') {
    // Use AsyncStorage for native platforms only
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return AsyncStorage;
    } catch {
      // Fallback if AsyncStorage not available
      return {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
      };
    }
  } else {
    // SSR fallback - no-op storage
    return {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
  }
};

// Get or create Supabase client (lazy initialization)
const getSupabaseClient = (): ReturnType<typeof createClient> => {
  if (!supabaseClient) {
    const isClient = typeof window !== 'undefined';
    supabaseClient = createClient(finalSupabaseUrl, finalSupabaseKey, {
      auth: {
        storage: createStorageAdapter() as any,
        autoRefreshToken: isClient,
        persistSession: isClient,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return supabaseClient;
};

// Export a proxy that lazy-loads the client only when accessed
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
}) as ReturnType<typeof createClient>;

// Export a flag to check if Supabase is configured
export const isSupabaseEnabled = isSupabaseConfigured;

// Helper function to get the redirect URL for OAuth
export const getRedirectUrl = () => {
  const redirectTo = Linking.createURL('/auth/callback');
  return redirectTo;
};

export default supabase;
