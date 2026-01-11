/**
 * Skip On - Chat Screen
 * 
 * Clean implementation using new Socket.IO service
 * No Supabase, no database, no polling
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../../types';
import { useAuthStore } from '../../store/authStore';
import TopNavigation from '../../components/TopNavigation';
// Skip On Service (REST + Firebase, no Socket.IO)
import skipOnService, { ChatMessageData as SkipOnMessage } from '../../services/skipOnService.new';
import skipOnRESTService from '../../services/skipOnRESTService';
import videoCallService from '../../services/videoCallService';

// Import avatar images
const avatarImages = {
  i1: require('../../assets/images/i1.png'),
  i2: require('../../assets/images/i2.png'),
  i3: require('../../assets/images/i3.png'),
  i4: require('../../assets/images/i4.png'),
  i5: require('../../assets/images/i5.png'),
  i6: require('../../assets/images/i6.png'),
  i7: require('../../assets/images/i7.png'),
};

const getAvatarImage = (avatarKey?: string) => {
  if (avatarKey && avatarKey in avatarImages) {
    return avatarImages[avatarKey as keyof typeof avatarImages];
  }
  return avatarImages.i1;
};

type ChatState = 'idle' | 'searching' | 'chatting' | 'error';

const WebRTCModule = (() => {
  try {
    // eslint-disable-next-line
    return require('react-native-webrtc');
  } catch {
    return null;
  }
})();

const RTCView = WebRTCModule?.RTCView;

export default function ChatOnScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [selfId, setSelfId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [roomReady, setRoomReady] = useState(false); // True when both users are in room
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStream, setRemoteStream] = useState<any | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Debug: Watch for roomId and partnerId changes
  useEffect(() => {
    if (roomId) {
      console.log('[ChatOn] ✅ roomId changed to:', roomId);
      console.log('[ChatOn] Current chatState:', chatState);
      console.log('[ChatOn] Partner ID:', partnerId);
      
      // CRITICAL: Only set to chatting if we have a partner
      if (partnerId) {
      if (chatState !== 'chatting') {
          console.log('[ChatOn] ✅ Partner found, setting state to chatting');
        setChatState('chatting');
          setRoomReady(true);
        }
      } else {
        // No partner - MUST stay in searching state
        if (chatState === 'chatting') {
          console.log('[ChatOn] ⚠️ No partner but state is chatting, fixing to searching');
          setChatState('searching');
          setRoomReady(false);
        }
      }
    }
  }, [roomId, chatState, partnerId]);

  // Get user ID (authenticated or guest)
  const getUserId = async (): Promise<string> => {
    if (user && !user.is_guest && user.id) {
      return user.id;
    }
    // Get or create guest ID (persisted in AsyncStorage)
    return await skipOnRESTService.getGuestId();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[ChatOn] Cleaning up...');
      skipOnService.disconnect();
      videoCallService.hangup();
    };
  }, []);

  useEffect(() => {
    if (chatState !== 'chatting' || !roomId || !partnerId || !selfId) {
      return;
    }

    let cancelled = false;

    videoCallService
      .start({
        roomId,
        selfId,
        partnerId,
        callbacks: {
          onLocalStream: (s) => {
            if (!cancelled) setLocalStream(s);
          },
          onRemoteStream: (s) => {
            if (!cancelled) setRemoteStream(s);
          },
          onError: (message) => {
            if (!cancelled) {
              console.error('[VideoCall] Error:', message);
              Alert.alert('Video Call Error', message);
            }
          },
          onPartnerLeft: () => {
            if (!cancelled) {
              Alert.alert('Partner Left', 'Your partner left. Starting new search...');
              handleSkip();
            }
          },
        },
      })
      .catch((e: any) => {
        if (!cancelled) {
          Alert.alert('Video Call Error', e?.message || 'Failed to start video call');
        }
      });

    return () => {
      cancelled = true;
      videoCallService.hangup();
      setLocalStream(null);
      setRemoteStream(null);
      setMicEnabled(true);
      setCameraEnabled(true);
    };
  }, [chatState, roomId, partnerId, selfId]);

  /**
   * Start searching for a chat partner
   */
  const handleStartChat = async () => {
    try {
      const userId = await getUserId();
      setSelfId(userId);
      
      console.log('[ChatOn] Starting chat for user:', userId);
      
      setChatState('searching');
      setMessages([]);
      setRoomId(null);
      setInputMessage('');
      setPartnerId(null);
      setPartnerName(null);
      setRoomReady(false);
      setLocalStream(null);
      setRemoteStream(null);

      // Start chat with callbacks
      await skipOnService.startChat(
        userId,
        // onMatched - use functional updates to ensure state updates work
        (foundRoomId: string, foundPartnerId?: string, foundPartnerName?: string) => {
          console.log('[ChatOn] 🎉 Match callback! Room:', foundRoomId, 'Partner:', foundPartnerId, 'Name:', foundPartnerName);
          
          // Clear messages - real messages will come from Firebase
          setMessages([]);
          
          // Set roomId
          setRoomId((prevRoomId) => {
            console.log('[ChatOn] setRoomId called, prevRoomId:', prevRoomId, 'newRoomId:', foundRoomId);
            return foundRoomId;
          });
          
          // Only set to chatting if we have a partner
          if (foundPartnerId) {
            console.log('[ChatOn] ✅ Partner found! Setting up chat...');
            setPartnerId(foundPartnerId);
            if (foundPartnerName) {
              setPartnerName(foundPartnerName);
            } else {
              // Fallback: use partner ID as name
              setPartnerName(foundPartnerId.substring(0, 8));
            }
            // Partner exists - ready to chat
            setChatState('chatting');
            setRoomReady(true);
          } else {
            console.log('[ChatOn] ⚠️ Room created but no partner yet, staying in searching state');
            // Room created but no partner - keep searching
            setChatState('searching');
            setRoomReady(false);
            setPartnerId(null);
            setPartnerName(null);
          }
          
          // Force a re-render check
          setTimeout(() => {
            console.log('[ChatOn] After state update - roomId should be:', foundRoomId);
          }, 100);
        },
        // onMessage
        (message: SkipOnMessage) => {
          console.log('[ChatOn] 📨 Message received:', message.message);
          
          const chatMessage: ChatMessage = {
            message_id: message.id,
            message: message.message,
            timestamp: message.timestamp,
            is_self: false, // Always false - messages from partner
          };
          
          setMessages((prev) => [...prev, chatMessage]);
          
          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
        // onPartnerLeft
        () => {
          console.log('[ChatOn] 🚪 Partner left');
          Alert.alert('Partner Left', 'Your chat partner has left. Starting new search...');
          handleSkip();
        },
        // onError
        (error: string) => {
          console.error('[ChatOn] ❌ Error:', error);
          Alert.alert('Error', error);
          setChatState('error');
        },
        // onRoomReady - called when both users have joined
        async () => {
          console.log('[ChatOn] ✅ Room is ready - both users joined');
          
          // When room is ready, check backend for partner info
          if (roomId) {
            try {
              console.log('[ChatOn] Fetching updated match status from backend...');
              const userId = await getUserId();
              const matchResult = await skipOnRESTService.match();
              
              if (matchResult.status === 'matched' && matchResult.partnerId) {
                console.log('[ChatOn] ✅ Partner found! ID:', matchResult.partnerId);
                setPartnerId(matchResult.partnerId);
                if (matchResult.partnerName) {
                  setPartnerName(matchResult.partnerName);
                } else {
                  setPartnerName(matchResult.partnerId.substring(0, 8));
                }
                setChatState('chatting');
                setRoomReady(true);
              } else {
                console.log('[ChatOn] ⚠️ Room ready but no partnerId in match result');
                // Keep searching state
                setChatState('searching');
                setRoomReady(false);
              }
            } catch (error: any) {
              console.error('[ChatOn] ❌ Error fetching partner info:', error);
              // Keep searching state on error
              setChatState('searching');
              setRoomReady(false);
            }
          } else {
            // No roomId yet, just set ready
          setRoomReady(true);
          }
        }
      );

    } catch (error: any) {
      console.error('[ChatOn] Error starting chat:', error);
      setChatState('error');
      Alert.alert('Error', error.message || 'Failed to start chat. Please try again.');
      skipOnService.disconnect();
    }
  };

  /**
   * Send a message
   */
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !roomId) {
      return;
    }
    
    // Don't allow messages until room is ready (both users joined)
    if (!roomReady) {
      Alert.alert('Waiting', 'Waiting for partner to join the room...');
      return;
    }

    const messageText = inputMessage.trim();
    setInputMessage('');

    // Optimistically add message to UI
    const optimisticMessage: ChatMessage = {
      message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: messageText,
      timestamp: new Date().toISOString(),
      is_self: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      await skipOnService.sendMessage(messageText);
      console.log('[ChatOn] ✅ Message sent');
      // Note: Message will appear again from Firebase, but we keep optimistic one
      // Firebase listener filters out own messages, so this is fine
    } catch (error: any) {
      console.error('[ChatOn] ❌ Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
      
      // Remove optimistic message on error
      setMessages((prev) => prev.filter(msg => msg.message_id !== optimisticMessage.message_id));
    }
  };

  /**
   * Skip current chat
   */
  const handleSkip = async () => {
    videoCallService.hangup();
    if (roomId) {
      try {
        await skipOnService.skipChat();
        console.log('[ChatOn] ✅ Chat skipped');
      } catch (error) {
        console.error('[ChatOn] Error skipping:', error);
      }
    }

    // Reset state
    setRoomId(null);
    setMessages([]);
    setInputMessage('');
    setPartnerId(null);
    setPartnerName(null);
    setRoomReady(false);
    setLocalStream(null);
    setRemoteStream(null);
    setMicEnabled(true);
    setCameraEnabled(true);
    setChatState('idle');
  };

  /**
   * Render message bubble
   */
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    return (
      <View style={[styles.liveMessageRow, item.is_self ? styles.liveMessageRowSelf : styles.liveMessageRowOther]}>
        <Text style={styles.liveMessageText} numberOfLines={3}>
          {item.message}
        </Text>
      </View>
    );
  };

  // ====================================
  // RENDER STATES
  // ====================================

  // Idle or Error State
  if (chatState === 'idle' || chatState === 'error') {
    return (
      <View style={styles.container}>
        <TopNavigation />
        <SafeAreaView style={styles.contentContainer} edges={[]}>
          <View style={styles.startContainer}>
            <View style={styles.profilePictureContainer}>
              <View style={styles.profilePicture}>
                <Image
                  source={getAvatarImage(user?.avatar_base64 || 'i1')}
                  style={styles.profilePictureImage}
                  resizeMode="cover"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartChat}
              disabled={false}
            >
              <Text style={styles.startButtonText}>
                {chatState === 'error' ? 'Try Again' : 'Start Video'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Searching State
  if (chatState === 'searching') {
    return (
      <View style={styles.container}>
        <TopNavigation />
        <SafeAreaView style={styles.contentContainer} edges={[]}>
          <View style={styles.searchingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.searchingText}>Connecting...</Text>
            <Text style={styles.searchingSubtext}>Finding someone to connect with</Text>
            <Text style={styles.searchingHint}>
              💡 Tip: Run two simulators/devices to test matching.
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                skipOnService.disconnect();
                videoCallService.hangup();
                setChatState('idle');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Chatting State - Only show if we have a partner
  if (chatState === 'chatting' && partnerId) {
  return (
    <View style={styles.container}>
      <TopNavigation />
      <View style={styles.header}>
        <View style={styles.statusDot} />
        <Text style={styles.headerText}>
          {partnerName || (partnerId ? `Connected with ${partnerId.substring(0, 8)}...` : 'Connected')}
        </Text>
        <TouchableOpacity
          style={styles.iconActionButton}
          onPress={() => {
            const next = !micEnabled;
            setMicEnabled(next);
            videoCallService.setMicrophoneEnabled(next);
          }}
        >
          <Ionicons name={micEnabled ? 'mic' : 'mic-off'} size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconActionButton}
          onPress={() => {
            const next = !cameraEnabled;
            setCameraEnabled(next);
            videoCallService.setCameraEnabled(next);
          }}
        >
          <Ionicons name={cameraEnabled ? 'videocam' : 'videocam-off'} size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Ionicons name="play-skip-forward" size={18} color="#FFFFFF" />
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.videoCallContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        <View style={styles.videoStage}>
          {RTCView && remoteStream ? (
            <RTCView style={styles.remoteVideo} streamURL={remoteStream.toURL()} objectFit="cover" />
          ) : (
            <View style={styles.remoteVideoPlaceholder}>
              <Text style={styles.remoteVideoPlaceholderText}>
                {RTCView ? 'Connecting video...' : 'WebRTC not available in this build'}
              </Text>
            </View>
          )}

          {RTCView && localStream ? (
            <RTCView style={styles.localVideo} streamURL={localStream.toURL()} objectFit="cover" />
          ) : null}

          <View style={styles.chatOverlay}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.message_id}
              renderItem={renderMessage}
              contentContainerStyle={styles.liveMessagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            />

            <View style={[styles.liveInputRow, { paddingBottom: insets.bottom + 8 }]}>
              <TextInput
                style={styles.liveInput}
                placeholder="Message"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={inputMessage}
                onChangeText={setInputMessage}
                maxLength={500}
                editable={true}
              />
              <TouchableOpacity
                style={[styles.liveSendButton, !inputMessage.trim() && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!inputMessage.trim()}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
  }

  // If we have a roomId but no partner, show searching state
  if (roomId && !partnerId) {
    return (
      <View style={styles.container}>
        <TopNavigation />
        <View style={styles.contentContainer}>
          <View style={styles.startContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={styles.searchingText}>Searching for a partner...</Text>
            <Text style={styles.searchingSubtext}>Room created, waiting for someone to join...</Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={async () => {
                await skipOnService.disconnect();
                videoCallService.hangup();
                setChatState('idle');
                setRoomId(null);
                setPartnerId(null);
                setPartnerName(null);
                setRoomReady(false);
                setLocalStream(null);
                setRemoteStream(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Fallback - should not reach here
  return null;
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
  profilePictureContainer: {
    marginBottom: 48,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.3)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(74, 144, 226, 0.3)',
      },
    }),
  },
  profilePictureImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  startButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
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
    padding: 32,
  },
  searchingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 24,
    marginBottom: 16,
    fontWeight: '500',
  },
  searchingSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: -4,
    marginBottom: 8,
    textAlign: 'center',
  },
  searchingHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 32,
    fontStyle: 'italic',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
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
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
  videoCallContainer: {
    flex: 1,
  },
  videoStage: {
    flex: 1,
    backgroundColor: '#000000',
  },
  remoteVideo: {
    flex: 1,
  },
  remoteVideoPlaceholder: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  remoteVideoPlaceholderText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 14,
  },
  localVideo: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chatOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    top: 0,
    width: '52%',
    paddingTop: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  liveMessagesList: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  liveMessageRow: {
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    maxWidth: '100%',
  },
  liveMessageRowSelf: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(74, 144, 226, 0.85)',
  },
  liveMessageRowOther: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  liveMessageText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  liveInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  liveInput: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    color: '#FFFFFF',
    fontSize: 13,
    marginRight: 10,
  },
  liveSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    maxWidth: '85%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  messageAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  messageAvatarImage: {
    width: '100%',
    height: '100%',
  },
  messageBubble: {
    maxWidth: '100%',
    padding: 14,
    borderRadius: 20,
  },
  myMessage: {
    backgroundColor: '#4A90E2',
  },
  theirMessage: {
    backgroundColor: '#1A1A1A',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingHorizontal: 20,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  input: {
    flex: 1,
    backgroundColor: '#252525',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    maxHeight: 100,
    marginRight: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  waitingBanner: {
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  waitingText: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '500',
  },
  inputDisabled: {
    opacity: 0.5,
  },
});
