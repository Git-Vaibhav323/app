/**
 * Skip On Firebase Realtime Database Service
 * 
 * Handles chat messages via Firebase Realtime Database
 * Matchmaking is handled via REST API (see skipOnService.ts)
 * 
 * Firebase Structure:
 * skipOnRooms/
 *   {roomId}/
 *     users/
 *       userAId: true
 *       userBId: true
 *     messages/
 *       {messageId}/
 *         senderId: string
 *         text: string
 *         timestamp: number
 *     status: "active" | "ended"
 */

import { getDatabase, ref, push, onValue, onChildAdded, off, set, get, Database } from 'firebase/database';
import { getFirebaseApp } from './firebase';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

class SkipOnFirebaseService {
  private db: Database | null = null;
  private currentRoomId: string | null = null;
  private messageListeners: Array<() => void> = [];
  private statusListener: (() => void) | null = null;

  constructor() {
    try {
      const app = getFirebaseApp();
      if (app) {
        this.db = getDatabase(app);
        console.log('✅ SkipOnFirebaseService: Firebase Realtime Database initialized');
      } else {
        console.warn('⚠️ SkipOnFirebaseService: Firebase app not initialized');
      }
    } catch (error) {
      console.error('❌ SkipOnFirebaseService: Failed to initialize:', error);
    }
  }

  /**
   * Initialize room in Firebase
   * Called after match is confirmed
   */
  async initializeRoom(roomId: string, userId: string, partnerId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Firebase Database not initialized');
    }

    this.currentRoomId = roomId;

    const roomRef = ref(this.db, `skipOnRooms/${roomId}`);
    
    // Set room structure
    await set(roomRef, {
      users: {
        [userId]: true,
        [partnerId]: true,
      },
      status: 'active',
      createdAt: Date.now(),
    });

    console.log(`✅ SkipOnFirebase: Room ${roomId} initialized in Firebase`);
  }

  /**
   * Send a message to Firebase
   */
  async sendMessage(roomId: string, senderId: string, text: string): Promise<void> {
    if (!this.db) {
      throw new Error('Firebase Database not initialized');
    }

    if (!roomId || !senderId || !text.trim()) {
      throw new Error('roomId, senderId, and text are required');
    }

    const messagesRef = ref(this.db, `skipOnRooms/${roomId}/messages`);
    const newMessageRef = push(messagesRef);

    await set(newMessageRef, {
      senderId,
      text: text.trim(),
      timestamp: Date.now(),
    });

    console.log(`✅ SkipOnFirebase: Message sent to room ${roomId}`);
  }

  /**
   * Subscribe to messages in a room
   * Returns cleanup function
   */
  subscribeToMessages(
    roomId: string,
    currentUserId: string,
    onMessage: (message: ChatMessage) => void,
    onPartnerLeft?: () => void
  ): () => void {
    if (!this.db) {
      console.error('❌ SkipOnFirebase: Database not initialized');
      return () => {};
    }

    this.currentRoomId = roomId;

    // Listen for new messages
    const messagesRef = ref(this.db, `skipOnRooms/${roomId}/messages`);
    
    const unsubscribeMessages = onChildAdded(messagesRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.val();
      const messageId = snapshot.key;

      if (!messageId || !data) return;

      // Don't process own messages (they're added optimistically)
      if (data.senderId === currentUserId) {
        return;
      }

      const message: ChatMessage = {
        id: messageId,
        senderId: data.senderId,
        text: data.text,
        timestamp: data.timestamp,
      };

      console.log(`📨 SkipOnFirebase: New message from ${data.senderId}`);
      onMessage(message);
    });

    // Listen for room status changes (partner left)
    const statusRef = ref(this.db, `skipOnRooms/${roomId}/status`);
    
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const status = snapshot.val();
      if (status === 'ended' && onPartnerLeft) {
        console.log('🚪 SkipOnFirebase: Room ended, partner left');
        onPartnerLeft();
      }
    });

    // Store cleanup function
    // onChildAdded and onValue return unsubscribe functions directly
    const cleanup = () => {
      try {
        if (typeof unsubscribeMessages === 'function') {
          unsubscribeMessages();
        }
        if (typeof unsubscribeStatus === 'function') {
          unsubscribeStatus();
        }
        console.log(`🧹 SkipOnFirebase: Unsubscribed from room ${roomId}`);
      } catch (error) {
        console.error('❌ SkipOnFirebase: Error unsubscribing:', error);
      }
    };

    this.messageListeners.push(cleanup);
    this.statusListener = cleanup;

    return cleanup;
  }

  /**
   * Mark room as ended (when user leaves)
   */
  async endRoom(roomId: string): Promise<void> {
    if (!this.db) {
      return;
    }

    const statusRef = ref(this.db, `skipOnRooms/${roomId}/status`);
    await set(statusRef, 'ended');

    console.log(`🚪 SkipOnFirebase: Room ${roomId} marked as ended`);
  }

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    // Clean up all message listeners
    this.messageListeners.forEach(cleanup => cleanup());
    this.messageListeners = [];

    // Clean up status listener
    if (this.statusListener) {
      this.statusListener();
      this.statusListener = null;
    }

    this.currentRoomId = null;
    console.log('🧹 SkipOnFirebase: All listeners cleaned up');
  }

  /**
   * Get current room ID
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }
}

export default new SkipOnFirebaseService();

