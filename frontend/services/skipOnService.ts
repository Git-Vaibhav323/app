/**
 * Skip On Chat Service using Socket.IO
 * Production-ready anonymous 1-to-1 temporary chat matching and messaging
 * 
 * Features:
 * - WebSocket-only transport (no polling fallback)
 * - Handles Android emulator, real devices, iOS, and Web
 * - Automatic reconnection
 * - Stable matchmaking
 * - Instant message delivery
 * - Proper cleanup on disconnect
 * 
 * Uses Socket.IO WebSocket for real-time communication (NO database)
 */

import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get backend URL from environment variables
const getBackendUrl = (): string => {
  // Force use port 3001 for Socket.IO server
  const FORCE_PORT = 3001;
  
  const expoExtraValue = Constants.expoConfig?.extra?.['EXPO_PUBLIC_BACKEND_URL'];
  if (expoExtraValue && typeof expoExtraValue === 'string' && expoExtraValue.trim() !== '') {
    let url = expoExtraValue.trim();
    // Force replace port 8001 with 3001 if found
    if (url.includes(':8001')) {
      url = url.replace(':8001', `:${FORCE_PORT}`);
      console.warn(`⚠️ Detected port 8001, forcing to ${FORCE_PORT}: ${url}`);
    }
    console.log(`📡 Backend URL from app.json: ${url}`);
    return url;
  }
  const envValue = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envValue && typeof envValue === 'string' && envValue.trim() !== '') {
    let url = envValue.trim();
    // Force replace port 8001 with 3001 if found
    if (url.includes(':8001')) {
      url = url.replace(':8001', `:${FORCE_PORT}`);
      console.warn(`⚠️ Detected port 8001, forcing to ${FORCE_PORT}: ${url}`);
    }
    console.log(`📡 Backend URL from process.env: ${url}`);
    return url;
  }
  // Default fallback (development) - ALWAYS use 3001
  const defaultUrl = `http://localhost:${FORCE_PORT}`;
  console.log(`📡 Backend URL using default: ${defaultUrl}`);
  return defaultUrl;
};

/**
 * Get the correct backend URL for the current platform
 * Handles Android emulator (10.0.2.2), real devices, iOS, and Web
 */
const getPlatformBackendUrl = (): string => {
  const baseUrl = getBackendUrl();
  
  // For Web, use localhost
  if (Platform.OS === 'web') {
    return baseUrl;
  }
  
  // For Android emulator, replace localhost with 10.0.2.2
  if (Platform.OS === 'android' && baseUrl.includes('localhost')) {
    const androidUrl = baseUrl.replace('localhost', '10.0.2.2');
    console.log(`📱 Android emulator detected, using: ${androidUrl}`);
    return androidUrl;
  }
  
  // For iOS simulator, localhost works
  // For real devices, use your computer's IP address
  // Example: http://192.168.1.100:3001
  // You'll need to set this in app.json for production
  
  return baseUrl;
};

export interface MatchResult {
  roomId: string;
  partnerId: string;
}

/**
 * Chat message data (Socket.IO based, no database storage)
 */
export interface ChatMessageData {
  id: string;
  sender_id: string;
  message: string;
  timestamp: string;
  created_at: string; // Alias for timestamp
}

class SkipOnService {
  private socket: Socket | null = null;
  private backendUrl: string;
  private currentClientId: string | null = null;
  private currentRoomId: string | null = null;
  private onMatchFoundCallback: ((roomId: string) => void) | null = null;
  private onMessageCallback: ((message: ChatMessageData) => void) | null = null;
  private onRoomEndedCallback: (() => void) | null = null;
  private isConnected: boolean = false;
  private isSearching: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    this.backendUrl = getPlatformBackendUrl();
    console.log(`✅ SkipOnService initialized`);
    console.log(`   Platform: ${Platform.OS}`);
    console.log(`   Backend URL: ${this.backendUrl}`);
  }

  /**
   * Initialize Socket.IO connection
   * Uses WebSocket-only transport for better performance
   */
  private initializeSocket(clientId: string): void {
    if (this.socket && this.socket.connected) {
      console.log('ℹ️ Socket already connected, reusing existing connection');
      return;
    }

    // Close existing socket if any
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Create new socket connection
    console.log(`🔌 Connecting to Socket.IO server: ${this.backendUrl}`);
    console.log(`   Transport: WebSocket + Polling (fallback)`);
    
    this.socket = io(this.backendUrl, {
      // Allow WebSocket and polling (polling as fallback for web browsers)
      transports: ['polling', 'websocket'], // Try polling first (more reliable for initial connection)
      // Reconnection settings
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10, // Increase retry attempts
      // Connection timeout (increased)
      timeout: 30000, // 30 seconds
      // Force new connection
      forceNew: true, // Force new connection each time
      // Auto connect
      autoConnect: true,
      // Upgrade from polling to WebSocket automatically
      upgrade: true,
      // Additional options for better compatibility
      rememberUpgrade: true,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup all Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('✅ Socket.IO connected successfully');
      console.log(`   Socket ID: ${this.socket?.id}`);
      console.log(`   Transport: ${this.socket.io.engine.transport.name}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    // Connection confirmation from server
    this.socket.on('connected', (data: { socketId: string }) => {
      console.log('✅ Server confirmed connection:', data.socketId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`❌ Socket.IO disconnected: ${reason}`);
      this.isConnected = false;
      this.isSearching = false;
      
      // If it's a server disconnect, try to reconnect
      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnected, will reconnect...');
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.warn(`⚠️ Socket.IO connection error (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);
      this.isConnected = false;
      // Don't throw - let Socket.IO handle reconnection
      // The promise timeout will handle final failure
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
      }
    });

    // Reconnection events
    this.socket.io.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
    });

    this.socket.io.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed');
    });

    // Matchmaking event handlers
    this.socket.on('matched', (data: { roomId: string }) => {
      console.log('🎉 Match found! Room ID:', data.roomId);
      this.currentRoomId = data.roomId;
      this.isSearching = false;

      // Automatically join the room
      if (this.socket && this.currentClientId) {
        this.socket.emit('join_room', {
          roomId: data.roomId,
          clientId: this.currentClientId,
        });
      }

      // Notify callback
      if (this.onMatchFoundCallback) {
        this.onMatchFoundCallback(data.roomId);
      }
    });

    this.socket.on('searching', (data: { message: string }) => {
      console.log(`🔍 ${data.message}`);
      this.isSearching = true;
    });

    this.socket.on('search_stopped', () => {
      console.log('✅ Search stopped');
      this.isSearching = false;
    });

    // Room event handlers
    this.socket.on('room_joined', (data: { roomId: string; peerId: string | null }) => {
      console.log(`✅ Joined room: ${data.roomId}`);
      if (data.peerId) {
        console.log(`   Peer ID: ${data.peerId}`);
      }
    });

    // Message event handlers
    this.socket.on('message_received', (data: {
      roomId: string;
      senderId: string;
      message: string;
      timestamp: string;
    }) => {
      // Only process messages for the current room
      if (data.roomId !== this.currentRoomId) {
        console.log(`⚠️ Ignoring message for different room: ${data.roomId} (current: ${this.currentRoomId})`);
        return;
      }

      // Don't process our own messages (shouldn't happen, but safety check)
      if (data.senderId === this.currentClientId) {
        console.log('⚠️ Ignoring own message');
        return;
      }

      console.log('📨 Message received from peer:', data.message.substring(0, 50));
      console.log(`   Room: ${data.roomId}, Sender: ${data.senderId}`);
      
      if (this.onMessageCallback) {
        const messageData: ChatMessageData = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sender_id: data.senderId,
          message: data.message,
          timestamp: data.timestamp,
          created_at: data.timestamp,
        };
        this.onMessageCallback(messageData);
      }
    });

    this.socket.on('message_sent', (data: { roomId: string; timestamp: string }) => {
      console.log('✅ Message sent confirmation for room:', data.roomId);
    });

    // Skip/End chat event handlers
    this.socket.on('peer_skipped', () => {
      console.log('🚪 Peer skipped the chat');
      if (this.onRoomEndedCallback) {
        this.onRoomEndedCallback();
      }
    });

    this.socket.on('chat_skipped', (data: { roomId: string }) => {
      console.log('✅ Chat skipped successfully');
      this.currentRoomId = null;
    });

    // Error handler
    this.socket.on('error', (error: { message: string }) => {
      console.error('❌ Socket.IO error:', error.message);
    });

    // Health check
    this.socket.on('pong', (data: { timestamp: string }) => {
      console.log('🏓 Pong received:', data.timestamp);
    });
  }

  /**
   * Start searching for a chat partner
   */
  async startSearching(
    clientId: string,
    onMatchFound: (roomId: string) => void
  ): Promise<void> {
    this.currentClientId = clientId;
    this.onMatchFoundCallback = onMatchFound;

    // Initialize socket if not already connected
    if (!this.socket || !this.isConnected) {
      this.initializeSocket(clientId);
      
      // Wait for connection (with timeout)
      await new Promise<void>((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket initialization failed'));
          return;
        }

        // Check if already connected
        if (this.isConnected && this.socket.connected) {
          console.log('✅ Socket already connected');
          resolve();
          return;
        }

        let resolved = false;
        let rejected = false;

        // Connection timeout
        const timeout = setTimeout(() => {
          if (!resolved && !rejected) {
            rejected = true;
            const errorMsg = `Socket connection timeout after 30s. Backend URL: ${this.backendUrl}`;
            console.error('❌', errorMsg);
            console.error('   Socket state:', {
              connecting: this.socket?.connecting,
              connected: this.socket?.connected,
              disconnected: this.socket?.disconnected,
              id: this.socket?.id,
            });
            // Clean up listeners
            this.socket?.removeListener('connect', onConnect);
            this.socket?.removeListener('connect_error', onConnectError);
            reject(new Error(errorMsg));
          }
        }, 30000);

        const onConnect = () => {
          if (!resolved && !rejected) {
            resolved = true;
            clearTimeout(timeout);
            this.socket?.removeListener('connect_error', onConnectError);
            console.log('✅ Socket connection established');
            console.log(`   Socket ID: ${this.socket?.id}`);
            console.log(`   Transport: ${this.socket?.io?.engine?.transport?.name || 'unknown'}`);
            resolve();
          }
        };

        const onConnectError = (error: any) => {
          if (!resolved && !rejected) {
            console.warn(`⚠️ Connection error: ${error.message || 'Unknown error'}`);
            console.warn(`   Error type: ${error.type || 'unknown'}`);
            console.warn(`   Backend URL: ${this.backendUrl}`);
            console.warn(`   Socket connecting: ${this.socket?.connecting}`);
            console.warn(`   Socket connected: ${this.socket?.connected}`);
            // Don't reject immediately - let Socket.IO retry
            // The timeout will handle final failure
          }
        };

        // Set up listeners BEFORE checking connection status
        this.socket.once('connect', onConnect);
        this.socket.on('connect_error', onConnectError);
        
        // Check connection status and trigger if needed
        if (this.socket.connected) {
          // Already connected
          clearTimeout(timeout);
          this.socket.removeListener('connect_error', onConnectError);
          onConnect(); // Call directly since we're already connected
        } else if (this.socket.connecting) {
          // Already connecting, just wait
          console.log('⏳ Socket is connecting...');
        } else {
          // Not connecting, trigger connection
          console.log('🔄 Triggering socket connection...');
          this.socket.connect();
        }
      });
    }

    // Start searching
    if (this.socket && this.isConnected && this.socket.connected) {
      console.log(`🔍 Starting search for user: ${clientId}`);
      this.socket.emit('start_search', { clientId });
      this.isSearching = true;
    } else {
      throw new Error(`Socket not connected. Backend: ${this.backendUrl}`);
    }
  }

  /**
   * Start chat (wrapper for startSearching with additional callbacks)
   * This matches the interface expected by chat-on.tsx
   */
  async startChat(
    clientId: string,
    onMatched: (roomId: string) => void,
    onMessage: (message: ChatMessageData) => void,
    onPartnerLeft: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // Set up callbacks
      this.onMatchFoundCallback = onMatched;
      this.onMessageCallback = onMessage;
      this.onRoomEndedCallback = onPartnerLeft;

      // Initialize socket if needed (don't wait for connection)
      if (!this.socket) {
        this.initializeSocket(clientId);
        // Give it a moment to start connecting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Start searching (this handles connection and matchmaking)
      await this.startSearching(clientId, onMatched);
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start chat';
      console.error('[SkipOn] startChat error:', errorMsg);
      console.error('[SkipOn] Full error:', error);
      if (onError) {
        onError(errorMsg);
      }
      // Don't throw - let the error callback handle it
      // throw error;
    }
  }

  /**
   * Stop searching for a chat partner
   */
  async stopSearching(clientId: string): Promise<void> {
    if (this.socket && this.isConnected && this.isSearching) {
      console.log(`⏹️ Stopping search for user: ${clientId}`);
      this.socket.emit('stop_searching', { clientId });
      this.isSearching = false;
    }
  }

  /**
   * Subscribe to room for real-time messages
   */
  subscribeToRoom(
    roomId: string,
    clientId: string,
    onMessage: (message: ChatMessageData) => void,
    onRoomEnded: () => void
  ): () => void {
    console.log(`📡 Subscribing to room: ${roomId}`);
    this.currentRoomId = roomId;
    this.onMessageCallback = onMessage;
    this.onRoomEndedCallback = onRoomEnded;

    // Room is already joined via 'matched' event handler
    // Just return cleanup function
    return () => {
      console.log(`🔌 Unsubscribing from room: ${roomId}`);
      this.onMessageCallback = null;
      this.onRoomEndedCallback = null;
    };
  }

  /**
   * Send a chat message via Socket.IO
   */
  async sendMessage(roomId: string, clientId: string, message: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    if (!roomId || !clientId || !message.trim()) {
      throw new Error('roomId, clientId, and message are required');
    }

    const messageText = message.trim();
    console.log(`📤 Sending message to room ${roomId}: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`);

    // Emit message to server (server will relay to peer)
    this.socket.emit('send_message', {
      roomId,
      clientId,
      message: messageText,
    });

    console.log(`✅ Message sent to server`);
  }

  /**
   * Get chat messages for a room
   * NOTE: With Socket.IO, messages are ephemeral (not stored)
   * This returns empty array - messages only exist during the session
   */
  async getMessages(roomId: string, limit: number = 50): Promise<ChatMessageData[]> {
    console.log('ℹ️ Socket.IO chat: No stored messages (messages only exist during session)');
    return [];
  }

  /**
   * Check if channel/room is ready
   */
  isChannelReady(roomId: string): boolean {
    return !!(
      this.socket &&
      this.isConnected &&
      this.currentRoomId === roomId
    );
  }

  /**
   * Skip/end the current chat
   */
  async skipChat(roomId: string, clientId: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot skip: Socket not connected');
      return;
    }

    console.log(`🚪 Skipping chat in room: ${roomId}`);

    // Emit skip event to server
    this.socket.emit('skip_chat', {
      roomId,
      clientId,
    });

    // Reset state
    this.currentRoomId = null;
  }

  /**
   * Clean up all connections and reset state
   */
  cleanup(): void {
    console.log('🧹 Cleaning up SkipOnService...');

    // Stop searching if active
    if (this.isSearching && this.currentClientId) {
      this.stopSearching(this.currentClientId);
    }

    // Disconnect socket
    if (this.socket) {
      console.log('🔌 Disconnecting Socket.IO...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    // Reset state
    this.currentClientId = null;
    this.currentRoomId = null;
    this.onMatchFoundCallback = null;
    this.onMessageCallback = null;
    this.onRoomEndedCallback = null;
    this.isConnected = false;
    this.isSearching = false;
    this.reconnectAttempts = 0;

    console.log('✅ SkipOnService cleanup complete');
  }

  /**
   * Get current room ID
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): { connected: boolean; searching: boolean; roomId: string | null } {
    return {
      connected: this.isConnected,
      searching: this.isSearching,
      roomId: this.currentRoomId,
    };
  }
}

export default new SkipOnService();
