/**
 * Skip On REST API Service
 * 
 * Handles matchmaking via REST API (server-authoritative)
 * Chat is handled via Firebase Realtime Database (see skipOnFirebaseService.ts)
 * 
 * Endpoints:
 * - POST /api/skip/match - Join queue or get matched
 * - POST /api/skip/leave - Leave queue/room
 * - GET /api/skip/status - Check current status
 */

import api from './api';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MatchResult {
  status: 'matched' | 'searching';
  roomId?: string;
  partnerId?: string;
  isPartnerGuest?: boolean;
}

export interface MatchStatus {
  status: 'idle' | 'searching' | 'matched';
  roomId?: string;
  partnerId?: string;
}

class SkipOnRESTService {
  private guestIdKey = 'skip_on_guest_id';

  /**
   * Get or create guest ID
   */
  async getGuestId(): Promise<string> {
    try {
      let guestId = await AsyncStorage.getItem(this.guestIdKey);
      if (!guestId) {
        // Generate new guest ID
        guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(this.guestIdKey, guestId);
        console.log('✅ SkipOnREST: Generated new guest ID:', guestId);
      }
      return guestId;
    } catch (error) {
      console.error('❌ SkipOnREST: Error getting guest ID:', error);
      // Fallback: generate temporary ID
      return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Get current user ID (authenticated or guest)
   */
  async getUserId(): Promise<{ userId: string; isGuest: boolean; token?: string }> {
    const { user, token } = useAuthStore.getState();
    
    if (user && !user.is_guest && token) {
      // Authenticated user
      return { userId: user.id, isGuest: false, token };
    } else {
      // Guest user
      const guestId = await this.getGuestId();
      return { userId: guestId, isGuest: true };
    }
  }

  /**
   * Join matchmaking queue or get matched
   */
  async match(): Promise<MatchResult> {
    const { userId, isGuest, token } = await this.getUserId();

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body: any = {};
      if (isGuest) {
        body.guestId = userId;
      }

      const response = await api.post('/skip/match', body, { headers });
      
      console.log('✅ SkipOnREST: Match response:', response.data);
      
      // Validate response
      if (!response.data || (response.data.status !== 'matched' && response.data.status !== 'searching')) {
        throw new Error(`Invalid response from backend: ${JSON.stringify(response.data)}`);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('❌ SkipOnREST: Match error:', error);
      throw new Error(error.response?.data?.detail || 'Failed to join matchmaking');
    }
  }

  /**
   * Leave matchmaking queue or current room
   */
  async leave(): Promise<void> {
    const { userId, isGuest, token } = await this.getUserId();

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body: any = {};
      if (isGuest) {
        body.guestId = userId;
      }

      await api.post('/skip/leave', body, { headers });
      console.log('✅ SkipOnREST: Left matchmaking/room');
    } catch (error: any) {
      console.error('❌ SkipOnREST: Leave error:', error);
      // Don't throw - leaving is best-effort
    }
  }

  /**
   * Get current matchmaking status
   */
  async getStatus(): Promise<MatchStatus> {
    const { userId, isGuest, token } = await this.getUserId();

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await api.get('/skip/status', { 
        headers,
        params: isGuest ? { guestId: userId } : undefined
      });
      
      return response.data;
    } catch (error: any) {
      console.error('❌ SkipOnREST: Status error:', error);
      return { status: 'idle' };
    }
  }
}

export default new SkipOnRESTService();

