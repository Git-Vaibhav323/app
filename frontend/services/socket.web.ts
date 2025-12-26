/**
 * Socket Service for Web platform
 * Stub implementation - sockets not needed for demo mode
 */

import { ENABLE_DEMO_MODE } from '../config/demo';

class SocketService {
  private socket: any = null;

  connect(token: string) {
    // Skip socket connection in demo mode or on web
    if (ENABLE_DEMO_MODE) {
      console.log('Demo mode: Socket connection skipped');
      return null;
    }
    console.log('Web: Socket connections not supported in demo mode');
    return null;
  }

  disconnect() {
    // No-op for web
  }

  getSocket() {
    return null;
  }

  emit(event: string, data: any) {
    // No-op for web demo mode
    console.log('Web demo: Socket emit skipped', event);
  }

  on(event: string, callback: (data: any) => void) {
    // No-op for web demo mode
  }

  off(event: string) {
    // No-op for web demo mode
  }
}

export default new SocketService();

