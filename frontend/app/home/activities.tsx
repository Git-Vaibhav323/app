import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ActivitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabBarHeight = 60 + insets.bottom;

  // Premium muted accent colors
  const activityColors = {
    watch: { icon: '#FFB020', badge: 'rgba(255, 176, 32, 0.15)' },
    play: { icon: '#7C3AED', badge: 'rgba(124, 58, 237, 0.15)' },
    sing: { icon: '#10B981', badge: 'rgba(16, 185, 129, 0.15)' },
  };

  const activities = [
    {
      id: 'watch',
      title: 'Watch Along',
      description: 'Watch YouTube videos together in sync',
      icon: 'play-circle',
      colors: activityColors.watch,
      route: '/features/watch',
      status: 'Available',
    },
    {
      id: 'play-along',
      title: 'Play Along',
      description: 'Play games together with friends or random players',
      icon: 'game-controller',
      colors: activityColors.play,
      route: '/features/chess',
      status: 'Available',
    },
    {
      id: 'sing',
      title: 'Sing Along',
      description: 'Karaoke together with real-time sync',
      icon: 'musical-notes',
      colors: activityColors.sing,
      route: '/features/sing',
      status: 'Beta',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Activities</Text>
          <Text style={styles.subtitle}>Choose what to do together</Text>
        </View>

        {/* Premium Activity Cards */}
        <View style={styles.activitiesContainer}>
          {activities.map((activity) => (
            <TouchableOpacity
              key={activity.id}
              style={styles.activityCard}
              onPress={() => router.push(activity.route as any)}
              activeOpacity={0.9}
            >
              <View style={[styles.iconContainer, { backgroundColor: activity.colors.badge }]}>
                <Ionicons
                  name={activity.icon as any}
                  size={32}
                  color={activity.colors.icon}
                />
              </View>
              <View style={styles.activityContent}>
                <View style={styles.activityTitleRow}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  {activity.status === 'Beta' && (
                    <View style={[styles.badge, { backgroundColor: activity.colors.badge }]}>
                      <Text style={[styles.badgeText, { color: activity.colors.icon }]}>BETA</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.activityDescription}>
                  {activity.description}
                </Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          activity.status === 'Beta' ? activity.colors.icon : '#4A90E2',
                      },
                    ]}
                  />
                  <Text style={styles.statusText}>{activity.status}</Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="rgba(255, 255, 255, 0.3)"
                style={styles.chevron}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Coming Soon Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Coming Soon</Text>
          <Text style={styles.infoText}>
            More activities like board games, trivia, and group video calls are
            coming soon!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 22,
  },
  activitiesContainer: {
    padding: 16,
    paddingTop: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
    justifyContent: 'center',
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 12,
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  activityDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 12,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 8,
  },
  infoSection: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 20,
  },
});
