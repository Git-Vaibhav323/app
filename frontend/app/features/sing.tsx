import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SingAlongScreen() {
  const router = useRouter();

  const handleStartSinging = () => {
    Alert.alert(
      'Beta Feature',
      'Sing Along is currently in BETA. This feature is being actively developed and improved.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sing Along</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>BETA</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Ionicons name="musical-notes" size={100} color="#43e97b" />
        <Text style={styles.title}>Sing Along</Text>
        <Text style={styles.subtitle}>
          Real-time karaoke experience with friends
        </Text>

        <View style={styles.betaBanner}>
          <Ionicons name="flask" size={20} color="#43e97b" />
          <Text style={styles.betaBannerText}>
            This feature is in BETA and being actively improved
          </Text>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartSinging}
        >
          <Text style={styles.startButtonText}>Try Beta Version</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Coming Features:</Text>
          <Text style={styles.infoText}>• Real-time audio sync</Text>
          <Text style={styles.infoText}>• Karaoke track library</Text>
          <Text style={styles.infoText}>• Lyrics display</Text>
          <Text style={styles.infoText}>• Multi-user singing rooms</Text>
          <Text style={styles.infoText}>• Recording & sharing</Text>
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="warning" size={20} color="#fa709a" />
          <Text style={styles.warningText}>
            Audio latency may vary based on network conditions
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginLeft: 16,
  },
  betaBadge: {
    backgroundColor: '#43e97b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  betaText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  betaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f8f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  betaBannerText: {
    color: '#43e97b',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
  },
  startButton: {
    backgroundColor: '#43e97b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#43e97b',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3f3',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  warningText: {
    color: '#fa709a',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});
