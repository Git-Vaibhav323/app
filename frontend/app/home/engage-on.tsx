import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import socketService from '../../services/socket';
import { useAuthStore } from '../../store/authStore';
import TopNavigation from '../../components/TopNavigation';

export default function EngageOnScreen() {
  const { token, user } = useAuthStore();
  const [isSearching, setIsSearching] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [isTimeRestricted, setIsTimeRestricted] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    checkTimeRestriction();
    const interval = setInterval(checkTimeRestriction, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = socketService.getSocket();
    if (!socket) {
      socketService.connect(token);
    }

    socketService.on('engage_waiting', (data: any) => {
      setRoomId(data.room_id);
      setIsSearching(true);
    });

    socketService.on('engage_matched', (data: any) => {
      setRoomId(data.room_id);
      setIsSearching(false);
      setIsMatched(true);
    });

    socketService.on('engage_time_restriction', (data: any) => {
      Alert.alert('Time Restriction', data.message);
      setIsSearching(false);
    });

    socketService.on('engage_partner_skipped', () => {
      Alert.alert('Partner Skipped', 'Your partner left. Finding new match...');
      handleStartEngage();
    });

    return () => {
      socketService.off('engage_waiting');
      socketService.off('engage_matched');
      socketService.off('engage_time_restriction');
      socketService.off('engage_partner_skipped');
    };
  }, [token]);

  const checkTimeRestriction = () => {
    const now = new Date();
    const hour = now.getHours();
    const restricted = hour >= 21 || hour < 0;
    setIsTimeRestricted(!restricted);
  };

  const handleStartEngage = () => {
    if (isTimeRestricted) {
      Alert.alert(
        'Time Restriction',
        'Engage On is only available between 9 PM - 12 AM in your timezone'
      );
      return;
    }

    if (!user) {
      Alert.alert('Authentication Required', 'Please login to use Engage On');
      return;
    }

    setIsMatched(false);
    setIsSearching(true);
    const timezoneOffset = -new Date().getTimezoneOffset() / 60;
    socketService.emit('join_engage', {
      token,
      timezone_offset: timezoneOffset,
    });
  };

  const handleSkip = () => {
    if (roomId) {
      socketService.emit('skip_engage', { room_id: roomId });
      handleStartEngage();
    }
  };

  if (!isMatched && !isSearching) {
    return (
      <View style={styles.container}>
        <TopNavigation />
        <SafeAreaView style={styles.contentContainer} edges={[]}>
          <View style={styles.startContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="heart" size={64} color="#E91E63" />
          </View>
          <Text style={styles.startTitle}>Engage On</Text>
          <Text style={styles.startSubtitle}>
            Match with opposite gender
          </Text>
          <Text style={styles.timeInfo}>
            Available: 9 PM - 12 AM (Your Timezone)
          </Text>
          <Text style={styles.requirementText}>
            Login Required
          </Text>

          {isTimeRestricted && (
            <View style={styles.restrictionBanner}>
              <Ionicons name="time" size={18} color="#E91E63" />
              <Text style={styles.restrictionText}>
                Not available at this time
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.startButton,
              isTimeRestricted && styles.startButtonDisabled,
            ]}
            onPress={handleStartEngage}
            disabled={isTimeRestricted}
          >
            <Text style={styles.startButtonText}>Start Matching</Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isSearching) {
    return (
      <View style={styles.container}>
        <TopNavigation />
        <SafeAreaView style={styles.contentContainer} edges={[]}>
          <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color="#E91E63" />
          <Text style={styles.searchingText}>
            Finding your match...
          </Text>
          <Text style={styles.searchingSubtext}>
            Looking for opposite gender
          </Text>
        </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopNavigation />
      <View style={styles.header}>
        <View style={styles.statusDot} />
        <Text style={styles.headerText}>Matched!</Text>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Ionicons name="play-skip-forward" size={18} color="#FFFFFF" />
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.matchedContainer}>
        <View style={styles.matchedIconContainer}>
          <Ionicons name="heart-circle" size={120} color="#E91E63" />
        </View>
        <Text style={styles.matchedTitle}>You're Matched!</Text>
        <Text style={styles.matchedSubtitle}>
          Start a conversation
        </Text>
        <Text style={styles.comingSoonText}>
          Full chat interface coming soon!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  contentContainer: {
    flex: 1,
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  startTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  startSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  timeInfo: {
    fontSize: 14,
    color: '#E91E63',
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 32,
  },
  restrictionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  restrictionText: {
    color: '#E91E63',
    fontSize: 14,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#E91E63',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#E91E63',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  searchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 24,
    fontWeight: '600',
  },
  searchingSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E91E63',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 6,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  matchedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  matchedIconContainer: {
    marginBottom: 24,
  },
  matchedTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  matchedSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 24,
    fontWeight: '500',
  },
  comingSoonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    fontStyle: 'italic',
  },
});
