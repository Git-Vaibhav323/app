import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';

export default function HomeScreen() {
  // Redirect to Skip On (chat-on) as the default screen
  return <Redirect href="/home/chat-on" />;
}
