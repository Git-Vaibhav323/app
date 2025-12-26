/**
 * Sing Along Screen (Phase 1)
 * 
 * Phase 1: Same as Watch Along
 * - YouTube karaoke video sync
 * - Host controls playback
 * - Real-time sync via Socket.IO
 * 
 * Phase 2 (Future):
 * - WebRTC audio rooms
 * - Echo cancellation
 * - Push-to-sing mode
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import engageService from '../../services/engageService';
import { WebView } from 'react-native-webview';

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

type RoomState = 'idle' | 'creating' | 'joining' | 'singing' | 'error';

export default function SingAlongScreen() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const [videoUrl, setVideoUrl] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState>('idle');
  const [isHost, setIsHost] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const webViewRef = useRef<WebView>(null);
  const socketRef = useRef<any>(null);

  // Auth check - redirect immediately if not authenticated
  if (!user || user.is_guest || !token) {
    return <Redirect href="/welcome" />;
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        engageService.disconnectSingAlong();
      }
    };
  }, []);

  // Setup Socket.IO listeners (same as Watch Along)
  useEffect(() => {
    if (!token || !user || !socketRef.current) return;

    const socket = socketRef.current;

    socket.on('room_created', (data: any) => {
      console.log('[SingAlong] Room created:', data);
      setRoomId(data.roomId);
      setRoomCode(data.roomId.split('_')[1]?.substring(0, 6) || '');
      setVideoId(data.videoId);
      setIsHost(true);
      setRoomState('singing');
    });

    socket.on('room_joined', (data: any) => {
      console.log('[SingAlong] Room joined:', data);
      setRoomId(data.roomId);
      setRoomCode(data.roomId.split('_')[1]?.substring(0, 6) || '');
      setVideoId(data.videoId);
      setIsHost(data.isHost);
      setIsPlaying(data.isPlaying);
      setCurrentTime(data.currentTime);
      setRoomState('singing');
    });

    socket.on('sync_play', (data: { currentTime: number }) => {
      setIsPlaying(true);
      setCurrentTime(data.currentTime);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          player.seekTo(${data.currentTime}, true);
          player.playVideo();
        `);
      }
    });

    socket.on('sync_pause', (data: { currentTime: number }) => {
      setIsPlaying(false);
      setCurrentTime(data.currentTime);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          player.seekTo(${data.currentTime}, true);
          player.pauseVideo();
        `);
      }
    });

    socket.on('sync_seek', (data: { currentTime: number }) => {
      setCurrentTime(data.currentTime);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          player.seekTo(${data.currentTime}, true);
        `);
      }
    });

    socket.on('sync_video', (data: { videoId: string; videoUrl: string }) => {
      setVideoId(data.videoId);
      setVideoUrl(data.videoUrl);
      setCurrentTime(0);
      setIsPlaying(false);
    });

    socket.on('participant_joined', () => {
      Alert.alert('Participant Joined', 'Someone joined your karaoke room!');
    });

    socket.on('participant_left', () => {
      Alert.alert('Participant Left', 'Someone left the karaoke room.');
    });

    socket.on('error', (error: { message: string }) => {
      Alert.alert('Error', error.message);
      setRoomState('error');
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('sync_play');
      socket.off('sync_pause');
      socket.off('sync_seek');
      socket.off('sync_video');
      socket.off('participant_joined');
      socket.off('participant_left');
      socket.off('error');
    };
  }, [token, user, roomId]);

  const handleCreateRoom = async () => {
    if (!videoUrl.trim()) {
      Alert.alert('Error', 'Please enter a YouTube karaoke URL');
      return;
    }

    const extractedId = extractYouTubeId(videoUrl);
    if (!extractedId) {
      Alert.alert('Error', 'Invalid YouTube URL');
      return;
    }

    if (!token || !user) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    setRoomState('creating');

    try {
      const socket = engageService.connectSingAlong(token, user.id);
      socketRef.current = socket;

      await new Promise((resolve, reject) => {
        if (socket.connected) {
          resolve(null);
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        socket.once('connect', () => {
          clearTimeout(timeout);
          resolve(null);
        });

        socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      socket.emit('create_sing_room', {
        videoId: extractedId,
        videoUrl: videoUrl.trim(),
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create room');
      setRoomState('error');
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode || roomCode.length < 6) {
      Alert.alert('Error', 'Please enter a valid room code');
      return;
    }

    if (!token || !user) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    setRoomState('joining');

    try {
      const socket = engageService.connectSingAlong(token, user.id);
      socketRef.current = socket;

      await new Promise((resolve, reject) => {
        if (socket.connected) {
          resolve(null);
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        socket.once('connect', () => {
          clearTimeout(timeout);
          resolve(null);
        });

        socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      const fullRoomId = `room_${roomCode}`;
      socket.emit('join_sing_room', { roomId: fullRoomId });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join room');
      setRoomState('error');
    }
  };

  // Host controls
  const handlePlay = () => {
    if (!isHost || !socketRef.current || !roomId) return;
    socketRef.current.emit('play', { roomId, currentTime });
  };

  const handlePause = () => {
    if (!isHost || !socketRef.current || !roomId) return;
    socketRef.current.emit('pause', { roomId, currentTime });
  };

  // YouTube iframe HTML
  const getYouTubeHTML = (vidId: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; background: #000; }
          #player { width: 100%; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="player"></div>
        <script src="https://www.youtube.com/iframe_api"></script>
        <script>
          var player;
          function onYouTubeIframeAPIReady() {
            player = new YT.Player('player', {
              height: '100%',
              width: '100%',
              videoId: '${vidId}',
              playerVars: {
                'playsinline': 1,
                'controls': ${isHost ? 1 : 0},
                'modestbranding': 1,
              },
              events: {
                'onReady': function(event) {
                  event.target.seekTo(${currentTime}, true);
                  ${isPlaying ? 'event.target.playVideo();' : 'event.target.pauseVideo();'}
                },
                'onStateChange': function(event) {
                  if (event.data === YT.PlayerState.PLAYING) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'playing' }));
                  } else if (event.data === YT.PlayerState.PAUSED) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'paused' }));
                  }
                }
              }
            });
          }
        </script>
      </body>
    </html>
  `;

  if (roomState === 'singing' && videoId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Sing Along</Text>
            {roomCode && (
              <Text style={styles.roomCode}>Room: {roomCode.toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {isHost && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>HOST</Text>
              </View>
            )}
            <View style={styles.betaBadge}>
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>
        </View>

        <View style={styles.playerContainer}>
          <WebView
            ref={webViewRef}
            source={{ html: getYouTubeHTML(videoId) }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={(event) => {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'playing') {
                setIsPlaying(true);
              } else if (data.type === 'paused') {
                setIsPlaying(false);
              }
            }}
          />
        </View>

        {isHost && (
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, !isPlaying && styles.controlButtonActive]}
              onPress={handlePause}
            >
              <Ionicons name="pause" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, isPlaying && styles.controlButtonActive]}
              onPress={handlePlay}
            >
              <Ionicons name="play" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {!isHost && (
          <View style={styles.viewerBadge}>
            <Text style={styles.viewerText}>Viewer - Waiting for host to control playback</Text>
          </View>
        )}

        <View style={styles.phase1Banner}>
          <Ionicons name="information-circle" size={16} color="#10B981" />
          <Text style={styles.phase1Text}>
            Phase 1: YouTube sync only. WebRTC audio coming in Phase 2.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sing Along</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>BETA</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Ionicons name="musical-notes" size={100} color="#10B981" />
        <Text style={styles.title}>Sing Together</Text>
        <Text style={styles.subtitle}>
          Paste a YouTube karaoke URL to sing along in sync with friends
        </Text>

        <View style={styles.betaBanner}>
          <Ionicons name="flask" size={20} color="#10B981" />
          <Text style={styles.betaBannerText}>
            Phase 1: YouTube sync. WebRTC audio coming soon!
          </Text>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Paste YouTube karaoke URL here"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={videoUrl}
            onChangeText={setVideoUrl}
            autoCapitalize="none"
            editable={roomState !== 'creating' && roomState !== 'joining'}
          />

          <TouchableOpacity
            style={[styles.createButton, (roomState === 'creating' || roomState === 'joining') && styles.createButtonDisabled]}
            onPress={handleCreateRoom}
            disabled={roomState === 'creating' || roomState === 'joining'}
          >
            {roomState === 'creating' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Karaoke Room</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.joinSection}>
          <TextInput
            style={styles.input}
            placeholder="Enter room code (6 digits)"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            value={roomCode || ''}
            onChangeText={setRoomCode}
            maxLength={6}
            editable={roomState !== 'creating' && roomState !== 'joining'}
          />

          <TouchableOpacity
            style={[styles.joinButton, (roomState === 'creating' || roomState === 'joining') && styles.joinButtonDisabled]}
            onPress={handleJoinRoom}
            disabled={roomState === 'creating' || roomState === 'joining'}
          >
            {roomState === 'joining' ? (
              <ActivityIndicator color="#10B981" />
            ) : (
              <Text style={styles.joinButtonText}>Join Room</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Phase 1 Features:</Text>
          <Text style={styles.infoText}>• YouTube karaoke video sync</Text>
          <Text style={styles.infoText}>• Host controls playback</Text>
          <Text style={styles.infoText}>• Real-time sync for all participants</Text>
          <Text style={styles.infoText}>• Create or join with room code</Text>
        </View>

        <View style={styles.futureBox}>
          <Text style={styles.futureTitle}>Phase 2 (Coming Soon):</Text>
          <Text style={styles.futureText}>• WebRTC audio rooms</Text>
          <Text style={styles.futureText}>• Echo cancellation</Text>
          <Text style={styles.futureText}>• Push-to-sing mode</Text>
          <Text style={styles.futureText}>• Multi-user audio mixing</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  roomCode: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  hostBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hostBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  betaBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  betaText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  betaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  betaBannerText: {
    color: '#10B981',
    fontSize: 13,
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
  },
  inputSection: {
    width: '100%',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 16,
    fontSize: 14,
  },
  joinSection: {
    width: '100%',
    marginBottom: 24,
  },
  joinButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
  },
  futureBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  futureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 12,
  },
  futureText: {
    fontSize: 14,
    color: 'rgba(16, 185, 129, 0.8)',
    marginBottom: 8,
  },
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#1A1A1A',
    gap: 16,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 8,
  },
  controlButtonActive: {
    backgroundColor: '#10B981',
  },
  viewerBadge: {
    padding: 16,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
  },
  viewerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  phase1Banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    gap: 8,
  },
  phase1Text: {
    color: '#10B981',
    fontSize: 12,
    flex: 1,
  },
});
