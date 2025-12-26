import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TextInput, KeyboardAvoidingView, ScrollView, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

export default function WelcomeScreen() {
  const router = useRouter();
  const { login, verifyOTP, signInWithGoogle, signInWithApple } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { width, height } = useWindowDimensions();
  
  // Responsive calculations
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 768;
  const maxContentWidth = Math.min(width * 0.9, 450); // Max 450px, but 90% of screen width
  const responsivePadding = isSmallScreen ? Spacing.md : Spacing.lg + 8;
  const logoSize = isSmallScreen ? 28 : 32;
  const headingSize = isSmallScreen ? 28 : 32;

  const handleLogin = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Error', 'Please enter a valid password');
      return;
    }

    setLoading(true);
    try {
      // For now, using OTP flow - you can replace with password login later
      const otp = await login(email);
      Alert.alert('Success', `OTP sent to ${email}\n\nDemo OTP: ${otp}`);
      // In production, you would authenticate with password here
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { width: '100%', height: '100%' }]}>
      {/* Dark Blue → Deep Navy Gradient Background with Radial Glow */}
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']} // Dark blue → navy → dark blue
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.backgroundGradient}
      >
        {/* Soft Radial Glow Effect - Near Top Center */}
        <View style={styles.radialGlow} />
        
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.content, { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' }]}>
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <Text style={[styles.logo, { fontSize: logoSize }]}>GINGR</Text>
            </View>

            {/* Main Heading */}
            <View style={styles.headingSection}>
              <Text style={[styles.heading, { fontSize: headingSize }]}>Hi There!</Text>
              <Text style={styles.subtext}>
                Please enter required details to continue.
              </Text>
            </View>

            {/* Social Login Buttons */}
            <View style={styles.socialButtonsContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.socialButtonPressed,
                ]}
                onPress={async () => {
                  try {
                    setLoading(true);
                    await signInWithGoogle();
                    // Navigate to profile setup after successful login
                    router.push('/auth/profile-setup');
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Google sign-in failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={20} color={Colors.text.primary} />
                <Text style={styles.socialButtonText}>Google</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.socialButtonPressed,
                ]}
                onPress={async () => {
                  try {
                    setLoading(true);
                    await signInWithApple();
                    // Navigate to profile setup after successful login
                    router.push('/auth/profile-setup');
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'Apple sign-in failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                <Ionicons name="logo-apple" size={20} color={Colors.text.primary} />
                <Text style={styles.socialButtonText}>Apple</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email Input Field */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </View>

            {/* Password Input Field */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                autoCorrect={false}
              />
            </View>

            {/* Forgot Password Link */}
            <Pressable
              style={styles.forgotPasswordLink}
              onPress={() => Alert.alert('Forgot Password', 'Feature coming soon')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>

            {/* Log In Button - Gradient */}
            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient
                colors={['#2563EB', '#06B6D4']} // Blue → Cyan gradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.text.inverse} />
                ) : (
                  <Text style={styles.loginButtonText}>Log In</Text>
                )}
              </LinearGradient>
            </Pressable>

            {/* Secondary Action */}
            <Pressable
              style={({ pressed }) => [
                styles.secondaryLink,
                pressed && styles.secondaryLinkPressed,
              ]}
              onPress={() => router.push('/auth/guest')}
            >
              <Text style={styles.secondaryLinkText}>
                Continue as Guest
              </Text>
            </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  radialGlow: {
    position: 'absolute',
    top: -200,
    alignSelf: 'center',
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: 'rgba(37, 99, 235, 0.15)', // Soft blue glow
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 100,
      },
      web: {
        boxShadow: '0 0 100px rgba(37, 99, 235, 0.3)',
      },
    }),
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%', // Ensure scroll content fills viewport
  },
  content: {
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg + 8,
    paddingVertical: Spacing['2xl'],
    minHeight: '100%', // Ensure content fills screen
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  logo: {
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.text.inverse,
    textAlign: 'center',
  },
  headingSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  heading: {
    fontWeight: '700',
    letterSpacing: -0.5,
    color: Colors.text.inverse,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtext: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.inverse,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary, // White background
    paddingVertical: Spacing.md,
    borderRadius: 28, // Pill shape
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: Spacing.sm,
  },
  socialButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    opacity: 0.95,
  },
  socialButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary, // Dark text on white background
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.inverse,
    opacity: 0.6,
    marginHorizontal: Spacing.md,
  },
  inputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Dark rounded card
    borderRadius: 16, // Rounded card
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  input: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.inverse,
    padding: 0,
    margin: 0,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  forgotPasswordText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.inverse,
    opacity: 0.7,
  },
  loginButton: {
    borderRadius: 28, // Pill shape
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 8px rgba(37, 99, 235, 0.3)',
      },
    }),
  },
  loginButtonGradient: {
    paddingVertical: Spacing.md + 4,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: 28,
  },
  loginButtonPressed: {
    opacity: 0.95,
  },
  loginButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.inverse,
    letterSpacing: 0.3,
  },
  secondaryLink: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLinkPressed: {
    opacity: 0.7,
  },
  secondaryLinkText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.text.inverse,
    opacity: 0.8,
  },
});
