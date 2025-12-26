import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

/**
 * Index Screen
 * 
 * This screen is rendered AFTER AuthProvider has initialized.
 * AuthProvider handles all auth state restoration, so we don't need to call loadUser here.
 * We just check the current auth state and redirect accordingly.
 */
export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuthStore();

  // AuthProvider handles loading state, but just in case:
  if (isLoading) {
    return null; // AuthProvider shows loading screen
  }

  if (isAuthenticated && user) {
    // Guest users skip profile setup and go directly to app
    if (user.is_guest) {
      return <Redirect href="/home/chat-on" />;
    }
    
    // Authenticated users (Google/Apple/Email) must complete profile setup
    // Check if name, city, and gender are missing
    if (!user.name || !user.city || !user.gender) {
      return <Redirect href="/auth/profile-setup" />;
    }
    
    return <Redirect href="/home/chat-on" />;
  }

  return <Redirect href="/welcome" />;
}
