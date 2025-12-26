/**
 * Demo/Mock Mode Configuration
 * 
 * When ENABLE_DEMO_MODE is true, the app will work without a backend.
 * API calls will return mock data, and authentication will use local storage only.
 * 
 * To use the app in demo mode:
 * 1. Set ENABLE_DEMO_MODE to true (already set)
 * 2. Start the app with: cd frontend && npm start
 * 3. Use any email to login - OTP will be '123456'
 * 4. Or continue as guest with any name/city/gender
 * 
 * All data is stored locally and will persist across app restarts.
 */

// Set to true to enable demo mode (no backend required)
export const ENABLE_DEMO_MODE = true;

// Mock data for demo mode
export const MOCK_OTP = '123456';
export const MOCK_TOKEN = 'demo_token_' + Date.now();

// Generate mock user data
export const generateMockUser = (data: {
  email?: string;
  name: string;
  city: string;
  gender: string;
  isGuest?: boolean;
  guestUuid?: string;
}) => ({
  id: data.isGuest ? data.guestUuid || `guest_${Date.now()}` : `user_${Date.now()}`,
  email: data.email,
  name: data.name,
  city: data.city,
  gender: data.gender as any,
  status: 'active' as any,
  is_guest: data.isGuest || false,
  guest_uuid: data.guestUuid,
  created_at: new Date().toISOString(),
  online: true,
});

