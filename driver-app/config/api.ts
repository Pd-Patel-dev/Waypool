// API Configuration
// For development, use your local machine's IP address
// For Android emulator: use 10.0.2.2 instead of localhost
// For iOS simulator: use localhost
// For physical device: use your computer's IP address (e.g., 192.168.1.100)

const getApiUrl = (): string => {
  // You can set this via environment variable or change it here
  if (__DEV__) {
    // Development - adjust based on your setup
    // For Android emulator: 'http://10.0.2.2:3000'
    // For iOS simulator: 'http://localhost:3000'
    // For physical device: 'http://YOUR_COMPUTER_IP:3000' (e.g., 'http://192.168.1.100:3000')
    return 'http://localhost:3000';
  }
  // Production - replace with your production API URL
  return 'https://api.waypool.com';
};

export const API_BASE_URL = getApiUrl();

export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: '/api/driver/auth/signup',
    LOGIN: '/api/driver/auth/login',
    LOGOUT: '/api/driver/auth/logout',
    CHECK_EMAIL: '/api/driver/auth/check-email',
  },
} as const;

