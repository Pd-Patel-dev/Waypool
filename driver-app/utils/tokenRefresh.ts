import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from './tokenStorage';

/**
 * Refresh the access token using the refresh token
 * @returns New access token or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await getRefreshToken();
    
    if (!refreshToken) {
      console.warn('No refresh token available');
      return null;
    }

    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const result = await response.json();

    if (!response.ok) {
      // If refresh fails, clear tokens and require re-authentication
      console.error('Token refresh failed:', result.message);
      await clearTokens();
      return null;
    }

    // Handle both old and new response formats
    const responseData = result.data || result;
    const newAccessToken = responseData.tokens?.accessToken || responseData.accessToken || responseData.token;
    const newRefreshToken = responseData.tokens?.refreshToken || responseData.refreshToken;

    if (!newAccessToken) {
      console.error('No access token in refresh response');
      await clearTokens();
      return null;
    }

    // Store new tokens
    await storeTokens(newAccessToken, newRefreshToken);

    return newAccessToken;
  } catch (error) {
    console.error('Error refreshing token:', error);
    await clearTokens();
    return null;
  }
}

/**
 * Base64 decode helper for React Native
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
    console.error('Base64 decode error:', error);
    throw error;
  }
}

/**
 * Check if token is expired (basic check - assumes JWT format)
 */
export function isTokenExpired(token: string): boolean {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
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

    return false;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return false;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 * @returns Valid access token or null if unavailable
 */
export async function getValidAccessToken(): Promise<string | null> {
  try {
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return null;
    }

    // Check if token is expired or about to expire
    if (isTokenExpired(accessToken)) {
      console.debug('Access token expired, refreshing');
      const newToken = await refreshAccessToken();
      return newToken;
    }

    return accessToken;
  } catch (error) {
    console.error('Error getting valid access token:', error);
    return null;
  }
}

