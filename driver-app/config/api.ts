import { Platform } from 'react-native';

// API Configuration from environment variables
// For development, use your local machine's IP address
// For Android emulator: use 10.0.2.2 instead of localhost
// For iOS simulator: use localhost
// For physical device: use your computer's IP address (e.g., 192.168.1.100)

const getApiUrl = (): string => {
  // Use environment variables with fallback defaults
  if (__DEV__) {
    // Development - adjust based on your setup
    if (Platform.OS === 'android') {
      // For Android emulator: use 10.0.2.2 to access host machine
      return process.env.EXPO_PUBLIC_API_URL_ANDROID || 'http://10.0.2.2:3000';
    } else if (Platform.OS === 'ios') {
      // For iOS simulator
      return process.env.EXPO_PUBLIC_API_URL_IOS || 'http://localhost:3000';
    } else {
      // For web or other platforms
      return process.env.EXPO_PUBLIC_API_URL_WEB || 'http://localhost:3000';
    }
  }
  // Production - use environment variable or fallback
  return process.env.EXPO_PUBLIC_API_URL_PROD || 'https://api.waypool.com';
};

export const API_BASE_URL = getApiUrl();

export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: '/api/driver/auth/signup',
    LOGIN: '/api/driver/auth/login',
    LOGOUT: '/api/driver/auth/logout',
    CHECK_EMAIL: '/api/driver/auth/check-email',
  },
  RIDES: {
    CREATE: '/api/driver/rides',
    UPCOMING: '/api/driver/rides/upcoming',
  },
} as const;

