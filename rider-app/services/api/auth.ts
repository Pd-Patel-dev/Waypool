import { API_URL, API_CONFIG } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { storeTokens } from '@/utils/tokenStorage';
import { getValidAccessToken } from '@/utils/tokenRefresh';
import type { ApiError } from './types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  verificationCode: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    isDriver?: boolean;
    isRider?: boolean;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    profilePicture?: string;
    emailVerified?: boolean;
  };
  data?: {
    user?: {
      id: string;
      email: string;
      role: string;
      isDriver?: boolean;
      isRider?: boolean;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      profilePicture?: string;
      emailVerified?: boolean;
    };
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
  };
  token?: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Fetch with timeout support using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_CONFIG.timeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    // Check if it's an abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TypeError('Network request timed out');
    }
    
    throw error;
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    // Get valid access token (will refresh if expired)
    const token = await getValidAccessToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    // Use fetchWithTimeout instead of fetch
    const response = await fetchWithTimeout(url, {
      ...options,
      headers,
    });

    // If token expired (401), try to refresh and retry once
    if (response.status === 401 && token) {
      logger.debug('Received 401, attempting token refresh', undefined, 'fetchWithAuth');
      const newToken = await getValidAccessToken();
      
      if (newToken && newToken !== token) {
        // Retry request with new token
        const retryHeaders = {
          ...headers,
          'Authorization': `Bearer ${newToken}`,
        };
        
        return fetchWithTimeout(url, {
          ...options,
          headers: retryHeaders,
        });
      }
    }

    return response;
  } catch (error: unknown) {
    // Re-throw network errors with more context
    if (error instanceof TypeError) {
      if (error.message.includes('Network request failed')) {
        logger.error('Network request failed', { url, error }, 'fetchWithAuth');
      } else if (error.message.includes('timed out')) {
        logger.error('Request timed out', { url, timeout: API_CONFIG.timeout }, 'fetchWithAuth');
      }
      throw error; // Re-throw to be handled by caller
    }
    throw error;
  }
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const loginUrl = `${API_URL}/api/rider/auth/login`;
  logger.info(`Attempting login to: ${loginUrl}`, undefined, 'login');
  
  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    logger.debug(`Login response status: ${response.status}`, undefined, 'login');
    
    if (!response.ok) {
      logger.error(`Login failed with status ${response.status}`, { status: response.status, url: loginUrl }, 'login');
    }

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Login failed',
        status: response.status,
      } as ApiError;
    }

    // Store tokens securely
    if (result.data?.tokens?.accessToken) {
      await storeTokens(result.data.tokens.accessToken, result.data.tokens.refreshToken);
    } else if (result.tokens?.accessToken) {
      await storeTokens(result.tokens.accessToken, result.tokens.refreshToken);
    } else if (result.token) {
      // Legacy format - store as access token only
      await storeTokens(result.token);
    }

    // Normalize response format - ensure user is at top level
    if (result.data?.user && !result.user) {
      result.user = result.data.user;
    }

    return result;
  } catch (error: unknown) {
    // Handle network errors specifically
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      logger.error(
        `Network request failed for login. API URL: ${loginUrl}. Make sure: 1) Backend is running, 2) Device and computer are on same network, 3) IP address is correct (${API_URL})`,
        { url: loginUrl, error },
        'login'
      );
      throw {
        message: `Cannot connect to server at ${API_URL}. Please ensure: 1) Backend server is running, 2) Your device and computer are on the same Wi-Fi network, 3) Firewall allows connections on port 3000.`,
        status: 0,
      } as ApiError;
    }
    
    if (isApiError(error)) {
      throw error;
    }
    
    logger.error('Login error', error, 'login');
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  const url = `${API_URL}/api/rider/auth/signup`;
  
  try {
    logger.debug('Signing up user', { email: data.email }, 'signup');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    // Check if response is valid
    if (!response) {
      throw {
        message: 'No response from server. Please check if the backend server is running.',
        status: 0,
      } as ApiError;
    }

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse JSON response', jsonError, 'signup');
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status || 500,
      } as ApiError;
    }

    if (!response.ok) {
      logger.error('Signup failed', result, 'signup');
      throw {
        message: result.message || 'Signup failed',
        status: response.status,
        errors: result.errors,
      } as ApiError;
    }

    logger.debug('Signup response received', { 
      success: result.success, 
      hasUser: !!result.user,
      hasData: !!result.data 
    }, 'signup');

    // Store tokens securely
    if (result.data?.tokens?.accessToken) {
      await storeTokens(result.data.tokens.accessToken, result.data.tokens.refreshToken);
      logger.debug('Tokens stored from result.data', undefined, 'signup');
    } else if (result.tokens?.accessToken) {
      await storeTokens(result.tokens.accessToken, result.tokens.refreshToken);
      logger.debug('Tokens stored from result.tokens', undefined, 'signup');
    } else if (result.token) {
      // Legacy format - store as access token only
      await storeTokens(result.token);
      logger.debug('Token stored from result.token (legacy)', undefined, 'signup');
    }

    // Normalize response format - ensure user is at top level
    if (result.data?.user && !result.user) {
      result.user = result.data.user;
      logger.debug('User normalized from result.data.user', undefined, 'signup');
    }

    // Ensure success flag is set
    if (!result.success && result.data) {
      result.success = true;
    }

    logger.info('Signup successful', { userId: result.user?.id, email: result.user?.email }, 'signup');
    return result;
  } catch (error: unknown) {
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      logger.error('Network connectivity issue', {
        apiUrl: API_URL,
        url,
        message: 'Ensure backend server is running and API_URL is correct',
      }, 'signup');
      
      throw {
        message: `Cannot connect to server at ${API_URL}. Please ensure the backend server is running.`,
        status: 0,
      } as ApiError;
    }
    
    if (isApiError(error)) {
      throw error;
    }
    
    logger.error('Error during signup', error, 'signup');
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

export { fetchWithAuth };

