import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WatchAlongScreen() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState('');

  const handleCreateRoom = () => {
    if (!videoUrl) {
      Alert.alert('Error', 'Please enter a YouTube URL');
      return;
    }

    Alert.alert('Coming Soon', 'Watch Along feature is being finalized!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch Along</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Ionicons name="play-circle" size={100} color="#fa709a" />
        <Text style={styles.title}>Watch Together</Text>
        <Text style={styles.subtitle}>
          Paste a YouTube URL to watch videos in sync with friends
        </Text>

        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Paste YouTube URL here"
            placeholderTextColor="#999"
            value={videoUrl}
            onChangeText={setVideoUrl}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateRoom}
          >
            <Text style={styles.createButtonText}>Create Watch Room</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <Text style={styles.infoText}>• Paste a YouTube video URL</Text>
          <Text style={styles.infoText}>• Share room code with friends</Text>
          <Text style={styles.infoText}>• Watch in perfect sync</Text>
          <Text style={styles.infoText}>• Host controls playback for everyone</Text>
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
  },
  placeholder: {
    width: 40,
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
    marginBottom: 32,
  },
  inputSection: {
    width: '100%',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#fa709a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
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
    borderLeftColor: '#fa709a',
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
});
