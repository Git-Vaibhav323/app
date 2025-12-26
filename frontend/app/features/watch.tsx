/**
 * Watch Along Screen
 * 
 * Features:
 * - Create/Join watch rooms
 * - YouTube video sync (play/pause/seek/video change)
 * - Host controls playback for all viewers
 * - Real-time sync via Socket.IO
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

type RoomState = 'idle' | 'creating' | 'joining' | 'watching' | 'error';

export default function WatchAlongScreen() {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        engageService.disconnectWatchAlong();
      }
    };
  }, []);

  // Setup Socket.IO listeners
  useEffect(() => {
    if (!token || !user || !socketRef.current) return;

    const socket = socketRef.current;

    // Room created
    socket.on('room_created', (data: any) => {
      console.log('[WatchAlong] Room created:', data);
      setRoomId(data.roomId);
      setRoomCode(data.roomId.split('_')[1]?.substring(0, 6) || '');
      setVideoId(data.videoId);
      setIsHost(true);
      setRoomState('watching');
    });

    // Room joined
    socket.on('room_joined', (data: any) => {
      console.log('[WatchAlong] Room joined:', data);
      setRoomId(data.roomId);
      setRoomCode(data.roomId.split('_')[1]?.substring(0, 6) || '');
      setVideoId(data.videoId);
      setIsHost(data.isHost);
      setIsPlaying(data.isPlaying);
      setCurrentTime(data.currentTime);
      setRoomState('watching');
    });

    // Sync events
    socket.on('sync_play', (data: { currentTime: number }) => {
      console.log('[WatchAlong] Sync play at', data.currentTime);
      setIsPlaying(true);
      setCurrentTime(data.currentTime);
      // Trigger YouTube player play
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          player.seekTo(${data.currentTime}, true);
          player.playVideo();
        `);
      }
    });

    socket.on('sync_pause', (data: { currentTime: number }) => {
      console.log('[WatchAlong] Sync pause at', data.currentTime);
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
      console.log('[WatchAlong] Sync seek to', data.currentTime);
      setCurrentTime(data.currentTime);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          player.seekTo(${data.currentTime}, true);
        `);
      }
    });

    socket.on('sync_video', (data: { videoId: string; videoUrl: string }) => {
      console.log('[WatchAlong] Sync video change to', data.videoId);
      setVideoId(data.videoId);
      setVideoUrl(data.videoUrl);
      setCurrentTime(0);
      setIsPlaying(false);
    });

    socket.on('participant_joined', (data: { userId: string }) => {
      Alert.alert('Participant Joined', 'Someone joined your watch room!');
    });

    socket.on('participant_left', (data: { userId: string }) => {
      Alert.alert('Participant Left', 'Someone left the watch room.');
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
      Alert.alert('Error', 'Please enter a YouTube URL');
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
      // Connect to Watch Along namespace
      const socket = engageService.connectWatchAlong(token, user.id);
      socketRef.current = socket;

      // Wait for connection
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

      // Create room
      socket.emit('create_watch_room', {
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
      const socket = engageService.connectWatchAlong(token, user.id);
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

      // Find full room ID from code (in production, use a lookup)
      // For now, assume roomCode is part of roomId
      const fullRoomId = `room_${roomCode}`;
      socket.emit('join_watch_room', { roomId: fullRoomId });
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

  const handleSeek = (time: number) => {
    if (!isHost || !socketRef.current || !roomId) return;
    socketRef.current.emit('seek', { roomId, currentTime: time });
  };

  const handleChangeVideo = (newUrl: string) => {
    if (!isHost || !socketRef.current || !roomId) return;
    const newId = extractYouTubeId(newUrl);
    if (newId) {
      socketRef.current.emit('change_video', {
        roomId,
        videoId: newId,
        videoUrl: newUrl,
      });
    }
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
                },
                'onError': function(event) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: event.data }));
                }
              }
            });
          }
        </script>
      </body>
    </html>
  `;

  if (roomState === 'watching' && videoId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Watch Along</Text>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch Along</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Ionicons name="play-circle" size={100} color="#FFB020" />
        <Text style={styles.title}>Watch Together</Text>
        <Text style={styles.subtitle}>
          Paste a YouTube URL to watch videos in sync with friends
        </Text>

        <View style={styles.inputSection}>
          <TextInput
            style={styles.input}
            placeholder="Paste YouTube URL here"
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
              <Text style={styles.createButtonText}>Create Watch Room</Text>
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
              <ActivityIndicator color="#7C3AED" />
            ) : (
              <Text style={styles.joinButtonText}>Join Room</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <Text style={styles.infoText}>• Paste a YouTube video URL</Text>
          <Text style={styles.infoText}>• Create a room or join with code</Text>
          <Text style={styles.infoText}>• Watch in perfect sync</Text>
          <Text style={styles.infoText}>• Host controls playback for everyone</Text>
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
    width: 40,
  },
  hostBadge: {
    backgroundColor: '#FFB020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hostBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
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
    marginBottom: 32,
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
    backgroundColor: '#FFB020',
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
    borderColor: '#7C3AED',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginTop: 24,
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
    backgroundColor: '#FFB020',
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
});
