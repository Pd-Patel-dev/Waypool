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
 * Get test user ID for bypassing authentication
 * Returns a default test user ID when test mode is enabled
 * 
 * @throws Error if test user ID is invalid (NaN)
 */
export function getTestUserId(role: 'driver' | 'rider' = 'driver'): number {
  // Default test user IDs (you can customize these)
  const testDriverId = parseInt(process.env.TEST_DRIVER_ID || '1', 10);
  const testRiderId = parseInt(process.env.TEST_RIDER_ID || '1', 10);
  
  const testId = role === 'driver' ? testDriverId : testRiderId;
  
  if (isNaN(testId)) {
    throw new Error(
      `Invalid TEST_${role.toUpperCase()}_ID in .env file. ` +
      `Expected a number, got: ${process.env[`TEST_${role.toUpperCase()}_ID`] || 'undefined'}. ` +
      `Please set a valid user ID in your .env file.`
    );
  }
  
  return testId;
}

/**
 * Bypass authentication check in test mode
 * Returns true if test mode is enabled and should bypass auth
 */
export function shouldBypassAuth(): boolean {
  return isTestModeEnabled();
}

/**
 * Validate and return user ID, bypassing in test mode if enabled
 * @param userId - User ID from request (can be null/undefined)
 * @param role - User role (driver or rider)
 * @returns Valid user ID (either from request or test mode default)
 */
export function getValidatedUserId(
  userId: number | string | null | undefined,
  role: 'driver' | 'rider' = 'driver'
): number {
  // If test mode is enabled, return test user ID
  if (shouldBypassAuth()) {
    const testId = getTestUserId(role);
    console.log(`🧪 TEST MODE: Using test ${role} ID: ${testId}`);
    return testId;
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
