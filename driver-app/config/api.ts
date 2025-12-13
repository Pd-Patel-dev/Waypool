import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API Configuration from environment variables
// For development, use your local machine's IP address
// For Android emulator: use 10.0.2.2 instead of localhost
// For iOS simulator: use localhost
// For physical device: use your computer's IP address (e.g., 192.168.1.100)
//
// To find your computer's IP address:
// Mac/Linux: Run `ifconfig | grep "inet " | grep -v 127.0.0.1` or `ipconfig getifaddr en0`
// Windows: Run `ipconfig` and look for IPv4 Address
//
// Set EXPO_PUBLIC_API_URL_IOS_PHYSICAL in your .env file with your IP (e.g., http://192.168.1.100:3000)

const getApiUrl = (): string => {
  // Use environment variables with fallback defaults
  if (__DEV__) {
    // Development - adjust based on your setup
    if (Platform.OS === 'android') {
      // For Android emulator: use 10.0.2.2 to access host machine
      // For physical Android device: use your computer's IP address
      return process.env.EXPO_PUBLIC_API_URL_ANDROID || 'http://10.0.2.2:3000';
    } else if (Platform.OS === 'ios') {
      // Check if running on physical device or simulator
      const isPhysicalDevice = Constants.isDevice;
      
      if (isPhysicalDevice) {
        // For physical iOS device: use your computer's IP address
        // Set EXPO_PUBLIC_API_URL_IOS_PHYSICAL in .env file
        // Example: EXPO_PUBLIC_API_URL_IOS_PHYSICAL=http://192.168.1.100:3000
        return process.env.EXPO_PUBLIC_API_URL_IOS_PHYSICAL || process.env.EXPO_PUBLIC_API_URL_IOS || 'http://192.168.1.100:3000';
      } else {
        // For iOS simulator: use localhost
        return process.env.EXPO_PUBLIC_API_URL_IOS || 'http://localhost:3000';
      }
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
    GET_BY_ID: (id: number) => `/api/driver/rides/${id}`,
    DELETE: (id: number) => `/api/driver/rides/${id}`,
    CANCEL: (id: number) => `/api/driver/rides/${id}/cancel`,
  },
} as const;

