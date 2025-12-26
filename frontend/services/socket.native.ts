/**
 * Socket Service for Native platforms (iOS/Android)
 * Uses socket.io-client for real-time communication
 */

import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { ENABLE_DEMO_MODE } from '../config/demo';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    // Skip socket connection in demo mode
    if (ENABLE_DEMO_MODE) {
      console.log('Demo mode: Socket connection skipped');
      return null;
    }

    if (this.socket?.connected) {
      return this.socket;
    }

    if (!API_URL) {
      console.log('No API URL configured, skipping socket connection');
      return null;
    }

    try {
      this.socket = io(API_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
        // Authenticate
        this.socket?.emit('authenticate', { token });
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      this.socket.on('error', (error: any) => {
        console.error('Socket error:', error);
      });

      this.socket.on('connect_error', (error: any) => {
        console.log('Socket connection error (non-blocking):', error.message);
        // Don't throw, just log - this allows app to work without backend
      });

      return this.socket;
    } catch (error) {
      console.log('Socket connection failed (non-blocking):', error);
      return null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export default new SocketService();

