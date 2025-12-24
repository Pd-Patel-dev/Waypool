import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

// Storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Legacy AsyncStorage keys (for migration)
const LEGACY_TOKEN_KEY = 'token';
const LEGACY_REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Securely store access token
 */
export async function storeAccessToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    logger.debug('Access token stored securely', undefined, 'tokenStorage');
  } catch (error) {
    logger.error('Failed to store access token', error, 'tokenStorage');
    throw new Error('Failed to store access token securely');
  }
}

/**
 * Securely retrieve access token
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    return token;
  } catch (error) {
    logger.error('Failed to retrieve access token', error, 'tokenStorage');
    return null;
  }
}

/**
 * Securely store refresh token
 */
export async function storeRefreshToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    logger.debug('Refresh token stored securely', undefined, 'tokenStorage');
  } catch (error) {
    logger.error('Failed to store refresh token', error, 'tokenStorage');
    throw new Error('Failed to store refresh token securely');
  }
}

/**
 * Securely retrieve refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return token;
  } catch (error) {
    logger.error('Failed to retrieve refresh token', error, 'tokenStorage');
    return null;
  }
}

/**
 * Store both access and refresh tokens
 */
export async function storeTokens(accessToken: string, refreshToken?: string): Promise<void> {
  try {
    await storeAccessToken(accessToken);
    if (refreshToken) {
      await storeRefreshToken(refreshToken);
    }
  } catch (error) {
    logger.error('Failed to store tokens', error, 'tokenStorage');
    throw error;
  }
}

/**
 * Clear all stored tokens
 */
export async function clearTokens(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    logger.debug('All tokens cleared', undefined, 'tokenStorage');
  } catch (error) {
    logger.error('Failed to clear tokens', error, 'tokenStorage');
    // Don't throw - clearing tokens should be best-effort
  }
}

/**
 * Check if user has a valid access token
 */
export async function hasAccessToken(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null && token.length > 0;
}

/**
 * Migrate tokens from AsyncStorage to SecureStore (one-time migration)
 * This should be called on app startup to migrate existing tokens
 */
export async function migrateTokensFromAsyncStorage(): Promise<void> {
  try {
    // Check if we already have tokens in secure storage
    const existingToken = await getAccessToken();
    if (existingToken) {
      // Already migrated, no need to do anything
      logger.debug('Tokens already in secure storage, skipping migration', undefined, 'tokenStorage');
      return;
    }

    // Try to get tokens from AsyncStorage
    const legacyToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
    const legacyRefreshToken = await AsyncStorage.getItem(LEGACY_REFRESH_TOKEN_KEY);

    if (legacyToken) {
      // Migrate to secure storage
      await storeAccessToken(legacyToken);
      if (legacyRefreshToken) {
        await storeRefreshToken(legacyRefreshToken);
      }

      // Clear from AsyncStorage after successful migration
      await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
      if (legacyRefreshToken) {
        await AsyncStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
      }

      logger.debug('Tokens migrated from AsyncStorage to SecureStore', undefined, 'tokenStorage');
    }
  } catch (error) {
    logger.error('Error migrating tokens from AsyncStorage', error, 'tokenStorage');
    // Don't throw - migration failure shouldn't break the app
  }
}

