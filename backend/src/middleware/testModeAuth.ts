/**
 * Test Mode Authentication Middleware
 * 
 * Bypasses authentication checks when test mode is enabled.
 * Only works in development environment.
 */

import type { Request, Response, NextFunction } from 'express';
import { isTestModeEnabled, logTestModeUsage } from '../utils/testMode';

/**
 * Extend Express Request to include test mode info
 */
declare global {
  namespace Express {
    interface Request {
      testMode?: boolean;
      testUserRole?: 'driver' | 'rider';
    }
  }
}

/**
 * Middleware to mark test mode when enabled
 * In test mode, we bypass authentication but still use the actual user ID from the request
 */
export function testModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (isTestModeEnabled()) {
    // Determine role from route path
    const isDriverRoute = req.path.startsWith('/api/driver');
    const isRiderRoute = req.path.startsWith('/api/rider');
    
    const role = isDriverRoute ? 'driver' : isRiderRoute ? 'rider' : 'driver';
    
    req.testMode = true;
    req.testUserRole = role;
    
    logTestModeUsage('Request received (test mode enabled)', {
      path: req.path,
      method: req.method,
      role,
    });
  }
  
  next();
}

/**
 * Helper to get user ID from request (with test mode support)
 * In test mode, we bypass validation but still use the actual user ID from the request
 */
export function getUserIdFromRequest(
  req: Request,
  role: 'driver' | 'rider' = 'driver'
): number {
  // Extract user ID from body or query (works in both test mode and normal mode)
  const userId = req.body[`${role}Id`] || req.query[`${role}Id`] || req.body.userId || req.query.userId;
  
  if (!userId) {
    throw new Error(`${role} ID is required`);
  }
  
  const parsedId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  
  if (isNaN(parsedId)) {
    throw new Error(`Invalid ${role} ID`);
  }
  
  // In test mode, log that we're bypassing authentication but using the actual user ID
  if (req.testMode) {
    logTestModeUsage(`Using ${role} ID from request (bypassing auth)`, { userId: parsedId });
  }
  
  return parsedId;
}
