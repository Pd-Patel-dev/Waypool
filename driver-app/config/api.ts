import { Platform } from "react-native";
import Constants from "expo-constants";

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
    if (Platform.OS === "android") {
      // For Android emulator: use 10.0.2.2 to access host machine
      // For physical Android device: use your computer's IP address
      return process.env.EXPO_PUBLIC_API_URL_ANDROID || "http://10.0.2.2:3000";
    } else if (Platform.OS === "ios") {
      // Check if running on physical device or simulator
      const isPhysicalDevice = Constants.isDevice;
      const isSimulator =
        !isPhysicalDevice || Constants.executionEnvironment === "storeClient";

      if (isPhysicalDevice && !isSimulator) {
        // For physical iOS device: use environment variable or fallback to localhost
        // Set EXPO_PUBLIC_API_URL_IOS_PHYSICAL in your .env file with your computer's IP
        // To find your IP: Mac/Linux: `ipconfig getifaddr en0` or `ifconfig | grep "inet "`
        const apiUrl =
          process.env.EXPO_PUBLIC_API_URL_IOS_PHYSICAL ||
          process.env.EXPO_PUBLIC_API_URL_IOS ||
          "http://localhost:3000";
        return apiUrl;
      } else {
        // For iOS simulator: use localhost
        const apiUrl =
          process.env.EXPO_PUBLIC_API_URL_IOS || "http://localhost:3000";
        return apiUrl;
      }
    } else {
      // For web or other platforms
      return process.env.EXPO_PUBLIC_API_URL_WEB || "http://localhost:3000";
    }
  }
  // Production - use environment variable or fallback
  return process.env.EXPO_PUBLIC_API_URL_PROD || "https://api.waypool.com";
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
