import { API_URL } from '@/config/api';
import { getAccessToken, getRefreshToken, storeTokens, clearTokens, migrateTokensFromAsyncStorage } from './tokenStorage';
import { logger } from './logger';
import { isApiError } from '@/types/errors';
import type { ApiError } from '@/services/api/types';

/**
 * Refresh the access token using the refresh token
 * @returns New access token or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await getRefreshToken();
    
    if (!refreshToken) {
      logger.warn('No refresh token available', undefined, 'tokenRefresh');
      return null;
    }

    logger.debug('Refreshing access token', undefined, 'tokenRefresh');

    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const result = await response.json();

    if (!response.ok) {
      // If refresh fails, clear tokens and require re-authentication
      logger.error('Token refresh failed', { status: response.status, message: result.message }, 'tokenRefresh');
      await clearTokens();
      throw {
        message: result.message || 'Token refresh failed',
        status: response.status,
      } as ApiError;
    }

    // Handle both old and new response formats
    const responseData = result.data || result;
    const newAccessToken = responseData.tokens?.accessToken || responseData.accessToken || responseData.token;
    const newRefreshToken = responseData.tokens?.refreshToken || responseData.refreshToken;

    if (!newAccessToken) {
      logger.error('No access token in refresh response', undefined, 'tokenRefresh');
      await clearTokens();
      return null;
    }

    // Store new tokens
    await storeTokens(newAccessToken, newRefreshToken);

    logger.debug('Access token refreshed successfully', undefined, 'tokenRefresh');
    return newAccessToken;
  } catch (error: unknown) {
    if (isApiError(error)) {
      throw error;
    }
    logger.error('Error refreshing token', error, 'tokenRefresh');
    await clearTokens();
    return null;
  }
}

/**
 * Base64 decode helper for React Native
 * Uses atob if available (web/Expo), otherwise uses a manual implementation
 */
function base64Decode(str: string): string {
  try {
    // Replace URL-safe base64 characters
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
    
    // Try using atob (available in React Native/Expo web environment)
    if (typeof atob !== 'undefined') {
      return atob(paddedBase64);
    }
    
    // Fallback: Manual base64 decode for React Native
    // Base64 character set
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    
    for (let i = 0; i < paddedBase64.length; i += 4) {
      const enc1 = chars.indexOf(paddedBase64.charAt(i));
      const enc2 = chars.indexOf(paddedBase64.charAt(i + 1));
      const enc3 = chars.indexOf(paddedBase64.charAt(i + 2));
      const enc4 = chars.indexOf(paddedBase64.charAt(i + 3));
      
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      
      output += String.fromCharCode(chr1);
      
      if (enc3 !== 64) {
        output += String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        output += String.fromCharCode(chr3);
      }
    }
    
    return output;
  } catch (error) {
    logger.error('Base64 decode error', error, 'tokenRefresh');
    throw error;
  }
}

/**
 * Check if token is expired (basic check - assumes JWT format)
 * Note: This is a simple check. For production, decode and check exp claim.
 */
export function isTokenExpired(token: string): boolean {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Not a JWT, assume not expired
      return false;
    }

    // Decode the payload (second part)
    const decodedPayload = base64Decode(parts[1]);
    const payload = JSON.parse(decodedPayload);
    
    // Check if token has expiration claim
    if (payload.exp) {
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      // Add 5 minute buffer to refresh before actual expiration
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      
      return currentTime >= (expirationTime - bufferTime);
    }

    // No expiration claim, assume not expired
    return false;
  } catch (error) {
    logger.error('Error checking token expiration', error, 'tokenRefresh');
    // On error, assume not expired to avoid unnecessary refreshes
    return false;
  }
}

// Track if migration has been attempted to avoid repeated attempts
let migrationAttempted = false;
// Track if we've already logged "no token" message to avoid spam
let hasLoggedNoToken = false;

/**
 * Get a valid access token, refreshing if necessary
 * @returns Valid access token or null if unavailable
 */
export async function getValidAccessToken(): Promise<string | null> {
  try {
    // Try to migrate tokens from AsyncStorage only once
    if (!migrationAttempted) {
      migrationAttempted = true;
      await migrateTokensFromAsyncStorage();
    }
    
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      // Only log once per session to avoid spam
      if (!hasLoggedNoToken) {
        logger.debug('No access token found', undefined, 'tokenRefresh');
        hasLoggedNoToken = true;
      }
      return null;
    }

    // Reset the flag if we have a token (user logged in)
    hasLoggedNoToken = false;

    // Check if token is expired or about to expire
    if (isTokenExpired(accessToken)) {
      logger.debug('Access token expired, refreshing', undefined, 'tokenRefresh');
      const newToken = await refreshAccessToken();
      return newToken;
    }

    return accessToken;
  } catch (error) {
    logger.error('Error getting valid access token', error, 'tokenRefresh');
    return null;
  }
}

