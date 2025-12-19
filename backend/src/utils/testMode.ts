/**
 * Test Mode Configuration
 * 
 * Allows bypassing security checks in development environment only.
 * NEVER enable in production!
 */

/**
 * Check if test mode is enabled
 * Only works in development environment
 */
export function isTestModeEnabled(): boolean {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const testMode = process.env.ENABLE_TEST_MODE === 'true';
  
  // Only allow test mode in development
  if (nodeEnv === 'production') {
    return false;
  }
  
  return testMode;
}

/**
 * @deprecated Test user IDs are no longer used in test mode.
 * Test mode now works with any normal user.
 * This function is kept for backwards compatibility but should not be used.
 */
export function getTestUserId(role: 'driver' | 'rider' = 'driver'): number {
  console.warn('⚠️  getTestUserId() is deprecated. Test mode now works with any user.');
  // Return a default value but this should not be used
  return 1;
}

/**
 * Bypass authentication check in test mode
 * Returns true if test mode is enabled and should bypass auth
 */
export function shouldBypassAuth(): boolean {
  return isTestModeEnabled();
}

/**
 * Validate and return user ID, bypassing validation in test mode if enabled
 * @param userId - User ID from request (can be null/undefined)
 * @param role - User role (driver or rider)
 * @returns Valid user ID from request (validation bypassed in test mode)
 */
export function getValidatedUserId(
  userId: number | string | null | undefined,
  role: 'driver' | 'rider' = 'driver'
): number {
  // If test mode is enabled, bypass validation but still use the provided userId
  if (shouldBypassAuth()) {
    if (!userId) {
      throw new Error(`${role} ID is required (even in test mode)`);
    }
    
    const parsedId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    
    if (isNaN(parsedId)) {
      throw new Error(`Invalid ${role} ID`);
    }
    
    logTestModeUsage(`Bypassing ${role} ID validation`, { userId: parsedId });
    return parsedId;
  }
  
  // Normal validation
  if (!userId) {
    throw new Error(`${role} ID is required`);
  }
  
  const parsedId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  
  if (isNaN(parsedId)) {
    throw new Error(`Invalid ${role} ID`);
  }
  
  return parsedId;
}

/**
 * Bypass ownership verification in test mode
 * Returns true if test mode is enabled and should bypass ownership checks
 */
export function shouldBypassOwnershipCheck(): boolean {
  return isTestModeEnabled();
}

/**
 * Log test mode usage for debugging
 */
export function logTestModeUsage(operation: string, details?: Record<string, any>): void {
  if (isTestModeEnabled()) {
    console.log(`🧪 TEST MODE: ${operation}`, details || '');
  }
}

/**
 * Check if ownership should be bypassed (for test mode)
 * Returns true if test mode is enabled and ownership check should be skipped
 */
export function shouldBypassOwnership(ownerId: number, requesterId: number): boolean {
  if (!shouldBypassAuth()) {
    return false;
  }
  
  // In test mode, bypass ownership checks
  logTestModeUsage('Bypassing ownership check', {
    ownerId,
    requesterId,
  });
  
  return true;
}
