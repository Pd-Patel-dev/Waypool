/**
 * Test Mode Authentication Middleware
 * 
 * Bypasses authentication checks when test mode is enabled.
 * Only works in development environment.
 */

import type { Request, Response, NextFunction } from 'express';
import { isTestModeEnabled, getTestUserId, logTestModeUsage } from '../utils/testMode';

/**
 * Extend Express Request to include test mode user info
 */
declare global {
  namespace Express {
    interface Request {
      testMode?: boolean;
      testUserId?: number;
      testUserRole?: 'driver' | 'rider';
    }
  }
}

/**
 * Middleware to inject test user info when test mode is enabled
 * This should be applied before authentication checks
 */
export function testModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (isTestModeEnabled()) {
    try {
      // Determine role from route path
      const isDriverRoute = req.path.startsWith('/api/driver');
      const isRiderRoute = req.path.startsWith('/api/rider');
      
      const role = isDriverRoute ? 'driver' : isRiderRoute ? 'rider' : 'driver';
      
      req.testMode = true;
      req.testUserId = getTestUserId(role);
      req.testUserRole = role;
      
      logTestModeUsage('Request received', {
        path: req.path,
        method: req.method,
        role,
        testUserId: req.testUserId,
      });
    } catch (error) {
      // If test user ID is invalid, log error but don't crash
      console.error('❌ TEST MODE ERROR:', error instanceof Error ? error.message : String(error));
      console.error('   Please check your .env file:');
      console.error('   - TEST_DRIVER_ID must be a valid number');
      console.error('   - TEST_RIDER_ID must be a valid number');
      console.error('   - Run: npx ts-node scripts/check-test-users.ts to validate');
      // Don't set test mode if ID is invalid
      req.testMode = false;
    }
  }
  
  next();
}

/**
 * Helper to get user ID from request (with test mode support)
 */
export function getUserIdFromRequest(
  req: Request,
  role: 'driver' | 'rider' = 'driver'
): number {
  // If test mode is enabled, use test user ID
  if (req.testMode && req.testUserId) {
    return req.testUserId;
  }
  
  // Normal extraction from body or query
  const userId = req.body[`${role}Id`] || req.query[`${role}Id`] || req.body.userId || req.query.userId;
  
  if (!userId) {
    throw new Error(`${role} ID is required`);
  }
  
  const parsedId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  
  if (isNaN(parsedId)) {
    throw new Error(`Invalid ${role} ID`);
  }
  
  return parsedId;
}
