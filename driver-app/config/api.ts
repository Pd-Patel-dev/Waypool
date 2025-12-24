import { Platform } from "react-native";
import * as Device from "expo-device";

// Production API URL - MUST be set for production builds
const PRODUCTION_API_URL = process.env.EXPO_PUBLIC_API_URL_PRODUCTION || 'https://api.waypool.com';

// Development configuration
const LOCAL_IP = "192.168.0.101"; // Update this if your local IP changes
const BACKEND_PORT = "3000";

// Get the appropriate API URL based on device type and environment
const getApiUrl = (): string => {
  // Production: Always use production URL
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  // Development: Use environment variables with fallback defaults
  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_API_URL_ANDROID || "http://10.0.2.2:3000";
  } else if (Platform.OS === "ios") {
    // If environment variable is set, use it (highest priority)
    if (process.env.EXPO_PUBLIC_API_URL_IOS_PHYSICAL || process.env.EXPO_PUBLIC_API_URL_IOS) {
      const url = process.env.EXPO_PUBLIC_API_URL_IOS_PHYSICAL || process.env.EXPO_PUBLIC_API_URL_IOS;
      console.log(`[Driver API Config] Using API URL from environment: ${url}`);
      return url!;
    }
    
    // Auto-detect device type
    const isPhysicalDevice = Device.isDevice;
    const deviceName = Device.deviceName || "Unknown";
    const deviceType = Device.deviceType || "Unknown";
    const modelName = Device.modelName || "Unknown";
    
    let apiUrl: string;
    
    if (isPhysicalDevice === true) {
      // Physical device - use local network IP
      apiUrl = `http://${LOCAL_IP}:${BACKEND_PORT}`;
    } else if (isPhysicalDevice === false) {
      // Simulator - use localhost
      apiUrl = "http://localhost:3000";
    } else {
      // Can't determine - default to IP for safety
      apiUrl = `http://${LOCAL_IP}:${BACKEND_PORT}`;
      console.warn("[Driver API Config] Could not determine device type, defaulting to local IP");
    }
    
    // Log device info for debugging (only in development)
    console.log("=== Driver API Configuration Debug ===");
    console.log(`Device Name: ${deviceName}`);
    console.log(`Device Type: ${deviceType}`);
    console.log(`Model Name: ${modelName}`);
    console.log(`Is Physical Device: ${isPhysicalDevice}`);
    console.log(`Selected API URL: ${apiUrl}`);
    console.log("======================================");
    
    return apiUrl;
  } else {
    // Web or other platforms
    return process.env.EXPO_PUBLIC_API_URL_WEB || "http://localhost:3000";
  }
};

export const API_BASE_URL = getApiUrl();

export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: "/api/driver/auth/signup",
    LOGIN: "/api/driver/auth/login",
    LOGOUT: "/api/driver/auth/logout",
    CHECK_EMAIL: "/api/driver/auth/check-email",
    REFRESH: "/api/driver/auth/refresh",
  },
  EMAIL_VERIFICATION: {
    SEND_OTP: "/api/driver/email-verification/send",
    VERIFY_OTP: "/api/driver/email-verification/verify",
    RESEND_OTP: "/api/driver/email-verification/resend",
  },
  RIDES: {
    CREATE: "/api/driver/rides",
    UPCOMING: "/api/driver/rides/upcoming",
    PAST: "/api/driver/rides/past",
    EARNINGS: "/api/driver/rides/earnings",
    GET_BY_ID: (id: number) => `/api/driver/rides/${id}`,
    UPDATE: (id: number) => `/api/driver/rides/${id}`,
    DELETE: (id: number) => `/api/driver/rides/${id}`,
    CANCEL: (id: number) => `/api/driver/rides/${id}/cancel`,
    START: (id: number) => `/api/driver/rides/${id}/start`,
    COMPLETE: (id: number) => `/api/driver/rides/${id}/complete`,
  },
  NOTIFICATIONS: {
    GET_ALL: "/api/driver/notifications",
    MARK_READ: (id: number) => `/api/driver/notifications/${id}/read`,
    MARK_ALL_READ: "/api/driver/notifications/read-all",
  },
  BOOKINGS: {
    ACCEPT: (id: number) => `/api/driver/bookings/${id}/accept`,
    REJECT: (id: number) => `/api/driver/bookings/${id}/reject`,
    PICKUP_COMPLETE: (id: number) =>
      `/api/driver/bookings/${id}/pickup-complete`,
  },
  RATINGS: {
    SUBMIT: "/api/driver/ratings",
    GET_BY_RIDE: (rideId: number) => `/api/driver/ratings/ride/${rideId}`,
  },
  PROFILE: {
    GET: "/api/driver/profile",
    UPDATE: "/api/driver/profile",
    UPDATE_PASSWORD: "/api/driver/profile/password",
    UPDATE_PHOTO: "/api/driver/profile/photo",
    DELETE: "/api/driver/profile",
    GET_PREFERENCES: "/api/driver/profile/preferences",
    UPDATE_PREFERENCES: "/api/driver/profile/preferences",
  },
  VEHICLE: {
    GET: "/api/driver/vehicle",
    UPDATE: "/api/driver/vehicle",
  },
  LOCATION: {
    UPDATE: "/api/driver/location",
  },
  MESSAGES: {
    CONVERSATIONS: "/api/driver/messages/conversations",
    GET_MESSAGES: (partnerId: number) => `/api/driver/messages/${partnerId}`,
    SEND: "/api/driver/messages",
  },
  EARNINGS: {
    GET: "/api/driver/earnings",
    SUMMARY: "/api/driver/earnings/summary",
  },
  PAYOUTS: {
    CONNECT_ACCOUNT: "/api/driver/payouts/connect-account",
    ACCOUNT_STATUS: "/api/driver/payouts/account-status",
    CREATE_ACCOUNT_LINK: "/api/driver/payouts/create-account-link",
    UPDATE_ACCOUNT: "/api/driver/payouts/update-account",
    CREATE_BANK_TOKEN: "/api/driver/payouts/create-bank-account-token",
    ACCOUNT_REQUIREMENTS: "/api/driver/payouts/account-requirements",
    DELETE_ACCOUNT: "/api/driver/payouts/delete-account",
    RESET_STRIPE_STATUS: "/api/driver/payouts/reset-stripe-status",
    INITIATE: "/api/driver/payouts/initiate",
    HISTORY: "/api/driver/payouts/history",
    BALANCE: "/api/driver/payouts/balance",
  },
  CONNECT: {
    ACCOUNT_SESSION: "/api/driver/connect/account-session",
    STATUS: "/api/driver/connect/status",
    // Custom Connect endpoints
    CUSTOM_CREATE: "/api/driver/connect/custom/create",
    REQUIREMENTS: "/api/driver/connect/requirements",
    UPDATE_INDIVIDUAL: "/api/driver/connect/custom/update-individual",
    BANK_TOKEN: "/api/driver/connect/custom/bank-token",
    ATTACH_BANK: "/api/driver/connect/custom/attach-bank",
    UPLOAD_DOCUMENT: "/api/driver/connect/custom/upload-document",
  },
} as const;
