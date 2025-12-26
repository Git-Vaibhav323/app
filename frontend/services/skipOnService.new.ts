/**
 * Skip On Service (REST + Firebase)
 * 
 * Architecture:
 * - Matchmaking: REST API (server-authoritative)
 * - Chat: Firebase Realtime Database
 * - NO Socket.IO
 * 
 * Works for both authenticated and guest users
 */

import skipOnRESTService, { MatchResult } from './skipOnRESTService';
import skipOnFirebaseService, { ChatMessage } from './skipOnFirebaseService';

export interface ChatMessageData {
  id: string;
  sender_id: string;
  message: string;
  timestamp: string;
  created_at: string;
}

class SkipOnService {
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private onMatchFoundCallback: ((roomId: string) => void) | null = null;
  private onMessageCallback: ((message: ChatMessageData) => void) | null = null;
  private onRoomEndedCallback: (() => void) | null = null;
  private firebaseCleanup: (() => void) | null = null;
  private isSearching: boolean = false;
  private matchPollingInterval: NodeJS.Timeout | null = null;

  /**
   * Start searching for a chat partner
   */
  async startChat(
    clientId: string,
    onMatched: (roomId: string) => void,
    onMessage: (message: ChatMessageData) => void,
    onPartnerLeft: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      this.currentUserId = clientId;
      this.onMatchFoundCallback = onMatched;
      this.onMessageCallback = onMessage;
      this.onRoomEndedCallback = onPartnerLeft;

      console.log('[SkipOn] Starting matchmaking for user:', clientId);

      // Start matchmaking
      await this.startMatchmaking();

    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start chat';
      console.error('[SkipOn] startChat error:', errorMsg);
      if (onError) {
        onError(errorMsg);
      }
      throw error;
    }
  }

  /**
   * Start matchmaking (polling REST API)
   */
  private async startMatchmaking(): Promise<void> {
    if (this.isSearching) {
      console.log('[SkipOn] Already searching, skipping');
      return;
    }

    this.isSearching = true;

    // Initial match request
    try {
      const result = await skipOnRESTService.match();
      
      // Handle null response (demo mode or backend unavailable)
      if (!result || result === null) {
        throw new Error('Backend server is not available. Please ensure the FastAPI server is running on port 3001.');
      }
      
      await this.handleMatchResult(result);
    } catch (error: any) {
      console.error('[SkipOn] Match error:', error);
      this.isSearching = false;
      throw error;
    }

    // If searching, poll for status
    if (this.isSearching) {
      this.startStatusPolling();
    }
  }

  /**
   * Poll for match status
   */
  private startStatusPolling(): void {
    // Clear existing interval
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
    }

    // Poll every 2 seconds
    this.matchPollingInterval = setInterval(async () => {
      if (!this.isSearching) {
        this.stopStatusPolling();
        return;
      }

      try {
        // Try match again (in case someone joined queue)
        const result = await skipOnRESTService.match();
        
        if (result.status === 'matched' && result.roomId) {
          // Match found!
          this.stopStatusPolling();
          this.isSearching = false;
          await this.handleMatch(result);
        } else if (result.status === 'searching') {
          // Still searching, continue polling
          console.log('[SkipOn] Still searching...');
        }
      } catch (error) {
        console.error('[SkipOn] Status polling error:', error);
        // Continue polling on error
      }
    }, 2000);
  }

  /**
   * Stop status polling
   */
  private stopStatusPolling(): void {
    if (this.matchPollingInterval) {
      clearInterval(this.matchPollingInterval);
      this.matchPollingInterval = null;
    }
  }

  /**
   * Handle match result
   */
  private async handleMatchResult(result: MatchResult | null): Promise<void> {
    if (!result) {
      throw new Error('Backend server is not available. Please ensure the FastAPI server is running on port 3001.');
    }
    
    if (result.status === 'matched' && result.roomId) {
      // Immediate match
      this.isSearching = false;
      this.stopStatusPolling();
      await this.handleMatch(result);
    } else if (result.status === 'searching') {
      // In queue, start polling
      console.log('[SkipOn] In queue, waiting for match...');
    } else {
      throw new Error(`Invalid match result: ${JSON.stringify(result)}`);
    }
  }

  /**
   * Handle successful match
   */
  private async handleMatch(result: MatchResult): Promise<void> {
    if (!result.roomId || !this.currentUserId) {
      console.error('[SkipOn] Invalid match result:', result);
      return;
    }

    this.isSearching = false;
    this.currentRoomId = result.roomId;

    console.log('[SkipOn] 🎉 Match found! Room:', result.roomId);

    // Initialize Firebase room
    try {
      await skipOnFirebaseService.initializeRoom(
        result.roomId,
        this.currentUserId,
        result.partnerId || ''
      );
    } catch (error) {
      console.error('[SkipOn] Failed to initialize Firebase room:', error);
      // Continue anyway - Firebase might work later
    }

    // Subscribe to Firebase messages
    this.firebaseCleanup = skipOnFirebaseService.subscribeToMessages(
      result.roomId,
      this.currentUserId,
      (message: ChatMessage) => {
        // Convert Firebase message to ChatMessageData format
        const messageData: ChatMessageData = {
          id: message.id,
          sender_id: message.senderId,
          message: message.text,
          timestamp: new Date(message.timestamp).toISOString(),
          created_at: new Date(message.timestamp).toISOString(),
        };

        if (this.onMessageCallback) {
          this.onMessageCallback(messageData);
        }
      },
      () => {
        // Partner left
        if (this.onRoomEndedCallback) {
          this.onRoomEndedCallback();
        }
      }
    );

    // Notify callback
    if (this.onMatchFoundCallback) {
      this.onMatchFoundCallback(result.roomId);
    }
  }

  /**
   * Send a message
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId) {
      throw new Error('Not in a room');
    }

    try {
      await skipOnFirebaseService.sendMessage(
        this.currentRoomId,
        this.currentUserId,
        message
      );
      console.log('[SkipOn] ✅ Message sent');
    } catch (error: any) {
      console.error('[SkipOn] ❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Skip current chat
   */
  async skipChat(): Promise<void> {
    if (this.currentRoomId) {
      try {
        // Mark room as ended in Firebase
        await skipOnFirebaseService.endRoom(this.currentRoomId);
      } catch (error) {
        console.error('[SkipOn] Error ending Firebase room:', error);
      }
    }

    // Leave via REST API
    try {
      await skipOnRESTService.leave();
    } catch (error) {
      console.error('[SkipOn] Error leaving via REST:', error);
    }

    // Cleanup
    this.cleanup();
  }

  /**
   * Disconnect (alias for cleanup)
   */
  disconnect(): void {
    this.cleanup();
  }

  /**
   * Clean up all connections and reset state
   */
  cleanup(): void {
    console.log('[SkipOn] 🧹 Cleaning up...');

    // Stop polling
    this.stopStatusPolling();

    // Leave queue/room
    skipOnRESTService.leave().catch(() => {
      // Ignore errors during cleanup
    });

    // Cleanup Firebase
    if (this.firebaseCleanup) {
      this.firebaseCleanup();
      this.firebaseCleanup = null;
    }
    skipOnFirebaseService.cleanup();

    // Reset state
    this.currentRoomId = null;
    this.currentUserId = null;
    this.onMatchFoundCallback = null;
    this.onMessageCallback = null;
    this.onRoomEndedCallback = null;
    this.isSearching = false;

    console.log('[SkipOn] ✅ Cleanup complete');
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
      connected: !!this.currentRoomId,
      searching: this.isSearching,
      roomId: this.currentRoomId,
    };
  }
}

export default new SkipOnService();
