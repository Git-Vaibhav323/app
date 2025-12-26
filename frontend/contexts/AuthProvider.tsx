/**
 * Global AuthProvider
 * 
 * This provider:
 * - Sets up a SINGLE global auth state listener
 * - Persists auth state across page refreshes
 * - Restores user session on app load
 * - NEVER calls logout unless explicitly requested
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User as FirebaseUser, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseEnabled } from '../services/firebase';
import { useAuthStore } from '../store/authStore';
import { ENABLE_DEMO_MODE, MOCK_TOKEN, generateMockUser } from '../config/demo';
import api from '../services/api';
import socketService from '../services/socket';

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to convert Firebase user to our User type
const firebaseUserToUser = (firebaseUser: FirebaseUser) => {
  const displayName = firebaseUser.displayName || '';
  const email = firebaseUser.email || '';
  const name = displayName || email.split('@')[0] || 'User';
  
  return {
    id: firebaseUser.uid,
    email: email,
    name: name,
    city: '', // Will be set in profile setup
    gender: 'other' as any,
    status: 'active' as any,
    is_guest: false,
    created_at: firebaseUser.metadata.creationTime || new Date().toISOString(),
    online: false,
  };
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { setUser, setToken, isLoading, setIsLoading } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Ensure isLoading is set to false once we're done initializing
  useEffect(() => {
    if (!isInitializing && isLoading) {
      setIsLoading(false);
    }
  }, [isInitializing, isLoading, setIsLoading]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const initializeAuth = async () => {
      console.log('🔐 AuthProvider: Initializing auth state...');

      // Configure Firebase persistence FIRST (before any auth operations)
      if (isFirebaseEnabled) {
        try {
          const auth = getFirebaseAuth();
          if (auth) {
            // Enable persistent auth storage (survives page refresh)
            await setPersistence(auth, browserLocalPersistence);
            console.log('✅ AuthProvider: Firebase persistence enabled');
          }
        } catch (error) {
          console.error('⚠️ AuthProvider: Failed to set Firebase persistence:', error);
        }
      }

      // Try to restore from AsyncStorage first (fastest)
      try {
        const storedUserStr = await AsyncStorage.getItem('auth_user');
        const storedToken = await AsyncStorage.getItem('auth_token');

        if (storedUserStr && storedToken && isMounted) {
          const storedUser = JSON.parse(storedUserStr);
          console.log('✅ AuthProvider: Restored user from storage:', storedUser.email || storedUser.name);
          
          // Set user and token immediately (optimistic restore)
          await setUser(storedUser);
          await setToken(storedToken);
          setIsLoading(false); // Ensure store's isLoading is false
          setIsInitializing(false);

          // Then verify with Firebase/backend
          if (isFirebaseEnabled) {
            const auth = getFirebaseAuth();
            if (auth) {
              // Set up persistent listener (will update if Firebase state differs)
              unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                if (!isMounted) return;

                if (firebaseUser) {
                  try {
                    const idToken = await firebaseUser.getIdToken();
                    const user = firebaseUserToUser(firebaseUser);
                    
                    // Persist to AsyncStorage
                    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
                    await AsyncStorage.setItem('auth_token', idToken);
                    
                    await setUser(user);
                    await setToken(idToken);
                    console.log('✅ AuthProvider: Firebase auth state updated');
                  } catch (error) {
                    console.error('❌ AuthProvider: Error updating Firebase auth:', error);
                  }
                } else {
                  // Firebase says no user - but check if we have demo/stored user
                  if (ENABLE_DEMO_MODE) {
                    const demoUser = await AsyncStorage.getItem('demo_user');
                    if (demoUser) {
                      const user = JSON.parse(demoUser);
                      const token = await AsyncStorage.getItem('auth_token') || MOCK_TOKEN;
                      await setUser(user);
                      await setToken(token);
                      console.log('✅ AuthProvider: Using demo user (Firebase not signed in)');
                      return;
                    }
                  }
                  
                  // No Firebase user and no stored user - clear everything
                  await AsyncStorage.removeItem('auth_user');
                  await AsyncStorage.removeItem('auth_token');
                  await setUser(null);
                  await setToken(null);
                  console.log('ℹ️ AuthProvider: No authenticated user');
                }
              });
            }
          } else if (ENABLE_DEMO_MODE) {
            // Demo mode: just use stored user
            console.log('✅ AuthProvider: Demo mode - using stored user');
          } else {
            // Backend mode: verify token with backend
            try {
              const response = await api.get('/auth/me');
              if (response.data && isMounted) {
                await setUser(response.data);
                await setToken(storedToken);
                console.log('✅ AuthProvider: Backend verified token');
              }
            } catch (error) {
              // Token invalid - clear storage
              console.log('⚠️ AuthProvider: Token invalid, clearing storage');
              await AsyncStorage.removeItem('auth_user');
              await AsyncStorage.removeItem('auth_token');
              await setUser(null);
              await setToken(null);
            }
          }

          return; // User restored, exit early
        }
      } catch (error) {
        console.error('❌ AuthProvider: Error restoring from storage:', error);
      }

      // No stored user - set up Firebase listener to wait for auth
      if (isFirebaseEnabled) {
        const auth = getFirebaseAuth();
        if (auth) {
          let hasInitialized = false;
          unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!isMounted) return;

            if (firebaseUser) {
              try {
                const idToken = await firebaseUser.getIdToken();
                const user = firebaseUserToUser(firebaseUser);
                
                // Persist to AsyncStorage
                await AsyncStorage.setItem('auth_user', JSON.stringify(user));
                await AsyncStorage.setItem('auth_token', idToken);
                
                await setUser(user);
                await setToken(idToken);
                console.log('✅ AuthProvider: User authenticated via Firebase');
              } catch (error) {
                console.error('❌ AuthProvider: Error processing Firebase user:', error);
                await setUser(null);
                await setToken(null);
              }
            } else {
              // Check demo mode fallback
              if (ENABLE_DEMO_MODE) {
                const demoUser = await AsyncStorage.getItem('demo_user');
                if (demoUser) {
                  const user = JSON.parse(demoUser);
                  const token = await AsyncStorage.getItem('auth_token') || MOCK_TOKEN;
                  await setUser(user);
                  await setToken(token);
                  console.log('✅ AuthProvider: Using demo user');
                  if (!hasInitialized && isMounted) {
                    hasInitialized = true;
                    setIsInitializing(false);
                  }
                  return;
                }
              }
              
              // No user at all
              await setUser(null);
              await setToken(null);
            }
            
            if (!hasInitialized && isMounted) {
              hasInitialized = true;
              setIsLoading(false);
              setIsInitializing(false);
            }
          });
          
          // Fallback timeout: if Firebase doesn't respond within 3 seconds, proceed anyway
          setTimeout(() => {
            if (!hasInitialized && isMounted) {
              hasInitialized = true;
              setIsLoading(false);
              setIsInitializing(false);
              console.log('⚠️ AuthProvider: Firebase auth check timeout, proceeding without user');
            }
          }, 3000);
        } else {
          // No Firebase auth instance, check demo mode
          if (ENABLE_DEMO_MODE) {
            const demoUser = await AsyncStorage.getItem('demo_user');
            if (demoUser) {
              const user = JSON.parse(demoUser);
              const token = await AsyncStorage.getItem('auth_token') || MOCK_TOKEN;
              await setUser(user);
              await setToken(token);
            }
          }
          setIsLoading(false);
          setIsInitializing(false);
        }
      } else {
        // No Firebase - check demo mode or backend token
        if (ENABLE_DEMO_MODE) {
          const demoUser = await AsyncStorage.getItem('demo_user');
          if (demoUser) {
            const user = JSON.parse(demoUser);
            const token = await AsyncStorage.getItem('auth_token') || MOCK_TOKEN;
            await setUser(user);
            await setToken(token);
          }
        } else {
          // Try backend token
          const token = await AsyncStorage.getItem('auth_token');
          if (token) {
            try {
              const response = await api.get('/auth/me');
              if (response.data) {
                await setUser(response.data);
                await setToken(token);
              }
            } catch (error) {
              await AsyncStorage.removeItem('auth_token');
            }
          }
        }
        setIsLoading(false);
        setIsInitializing(false);
      }
    };

    initializeAuth();

    // Cleanup: unsubscribe from Firebase listener
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
        console.log('🧹 AuthProvider: Cleaned up auth listener');
      }
    };
  }, []); // Run only once on mount

  // Show loading screen while initializing
  if (isInitializing || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
  },
});

export default AuthProvider;

