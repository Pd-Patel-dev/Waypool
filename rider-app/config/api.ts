import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { logger } from '@/utils/logger';

// Production API URL - MUST be set for production builds
const PRODUCTION_API_URL = process.env.EXPO_PUBLIC_API_URL_PRODUCTION || 'https://api.waypool.com';

// Development configuration
const LOCAL_IP = '192.168.0.101'; // Update this if your local IP changes
const BACKEND_PORT = '3000';

// Get the appropriate API URL based on device type and environment
const getIOSApiUrl = (): string => {
  // Production: Always use production URL
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  // Development: Use environment variable if set (highest priority)
  if (process.env.EXPO_PUBLIC_API_URL_IOS) {
    const url = process.env.EXPO_PUBLIC_API_URL_IOS;
    if (__DEV__) {
      logger.info(`[API Config] Using API URL from environment: ${url}`, undefined, 'api-config');
    }
    return url;
  }
  
  // Development: Auto-detect device type
  const isPhysicalDevice = Device.isDevice;
  const deviceName = Device.deviceName || 'Unknown';
  const deviceType = Device.deviceType || 'Unknown';
  const modelName = Device.modelName || 'Unknown';
  
  let apiUrl: string;
  
  if (isPhysicalDevice === true) {
    // Physical device - use local network IP
    apiUrl = `http://${LOCAL_IP}:${BACKEND_PORT}`;
  } else if (isPhysicalDevice === false) {
    // Simulator - use localhost
    apiUrl = 'http://localhost:3000';
  } else {
    // Can't determine - default to IP for safety
    apiUrl = `http://${LOCAL_IP}:${BACKEND_PORT}`;
    console.warn('[API Config] Could not determine device type, defaulting to local IP');
  }
  
  // Log device info for debugging (only in development)
  if (__DEV__) {
    console.log('=== API Configuration Debug ===');
    console.log(`Device Name: ${deviceName}`);
    console.log(`Device Type: ${deviceType}`);
    console.log(`Model Name: ${modelName}`);
    console.log(`Is Physical Device: ${isPhysicalDevice}`);
    console.log(`Selected API URL: ${apiUrl}`);
    console.log('================================');
    
    logger.info(
      `[API Config] Device: ${deviceName} (${deviceType}/${modelName}), Physical: ${isPhysicalDevice}, API URL: ${apiUrl}`,
      undefined,
      'api-config'
    );
  }
  
  return apiUrl;
};

// Backend API URL configuration
export const API_URL = Platform.select({
  ios: getIOSApiUrl(),
  android: __DEV__ 
    ? (process.env.EXPO_PUBLIC_API_URL_ANDROID || 'http://10.0.2.2:3000')
    : PRODUCTION_API_URL,
  web: __DEV__
    ? (process.env.EXPO_PUBLIC_API_URL_WEB || 'http://localhost:3000')
    : PRODUCTION_API_URL,
  default: getIOSApiUrl(),
});

// Log the final API URL being used (always log in dev, and log once in production for debugging)
if (__DEV__) {
  console.log('🔗 API_URL configured:', API_URL);
  logger.info(`[API Config] Final API_URL: ${API_URL}`, undefined, 'api-config');
} else {
  // Even in production, log once to help debug connection issues
  console.log('🔗 API_URL:', API_URL);
}

// Export API_BASE_URL for WebSocket connection
export const API_BASE_URL = API_URL;

export const API_CONFIG = {
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

