import { Platform } from 'react-native';

// Backend API URL configuration
export const API_URL = Platform.select({
  // For iOS simulator, use localhost
  ios: 'http://localhost:3000',
  // For Android emulator, use 10.0.2.2 (Android emulator's special alias for host machine)
  android: 'http://10.0.2.2:3000',
  // For web
  web: 'http://localhost:3000',
  // Default fallback
  default: 'http://localhost:3000',
});

export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

