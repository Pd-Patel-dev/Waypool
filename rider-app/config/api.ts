import { Platform } from 'react-native';

// Backend API URL configuration from environment variables
export const API_URL = Platform.select({
  // For iOS simulator, use localhost
  ios: process.env.EXPO_PUBLIC_API_URL_IOS || 'http://localhost:3000',
  // For Android emulator, use 10.0.2.2 (Android emulator's special alias for host machine)
  android: process.env.EXPO_PUBLIC_API_URL_ANDROID || 'http://10.0.2.2:3000',
  // For web
  web: process.env.EXPO_PUBLIC_API_URL_WEB || 'http://localhost:3000',
  // Default fallback
  default: process.env.EXPO_PUBLIC_API_URL_IOS || 'http://localhost:3000',
});

// Export API_BASE_URL for WebSocket connection
export const API_BASE_URL = API_URL;

export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

