import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { loadUser } = useAuthStore();

  useEffect(() => {
    // Firebase handles OAuth callbacks automatically with popup
    // Just redirect to profile setup or home after a brief moment
    const handleCallback = async () => {
      try {
        // Load user to check if authenticated
        await loadUser();
        // Give Firebase a moment to complete auth
        setTimeout(() => {
          router.replace('/auth/profile-setup');
        }, 1000);
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/welcome');
      }
    };

    handleCallback();
  }, [router, loadUser]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

