import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface NavItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const navItems: NavItem[] = [
  { id: 'skip-on', title: 'Skip On', icon: 'chatbubbles', route: '/home/chat-on' },
  { id: 'engage', title: 'Engage', icon: 'heart', route: '/home/engage' },
  { id: 'profile', title: 'Profile', icon: 'person', route: '/home/profile' },
];

export default function TopNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (route: string) => {
    if (!pathname) return false;
    
    // Handle Skip On route - also match /home and /home/index
    if (route === '/home/chat-on') {
      return pathname === '/home/chat-on' || 
             pathname === '/home/chat-on/' ||
             pathname === '/home' ||
             pathname === '/home/' ||
             pathname === '/home/index' ||
             pathname.startsWith('/home/index');
    }
    
    // Handle other routes - check if pathname matches exactly or starts with route + /
    return pathname === route || 
           pathname.startsWith(route + '/') ||
           pathname === route + '/';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.navBar, { paddingTop: Math.max(insets.top, 8) }]}>
        {navItems.map((item) => {
          const active = isActive(item.route);
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.navItem,
                active && styles.navItemActive,
                pressed && styles.navItemPressed,
              ]}
              onPress={() => {
                if (!active) {
                  router.push(item.route as any);
                }
              }}
            >
              <View style={[
                styles.iconContainer,
                active && styles.iconContainerActive,
              ]}>
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={active ? '#4A90E2' : 'rgba(255, 255, 255, 0.4)'}
                />
              </View>
              <Text style={[
                styles.navLabel,
                active && styles.navLabelActive,
              ]}>
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#0F0F0F',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 56,
  },
  navItemActive: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  navItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#4A90E2',
    fontWeight: '600',
  },
});

