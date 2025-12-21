import type { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { sendUnauthorized } from '../utils/apiResponse';

/**
 * Extend Express Request to include user info from JWT
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      sendUnauthorized(res, 'Authorization header missing');
      return;
    }

    // Extract token from "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      sendUnauthorized(res, 'Invalid authorization header format. Use: Bearer <token>');
      return;
    }

    const token = parts[1];

    if (!token) {
      sendUnauthorized(res, 'Token missing');
      return;
    }

    // Verify token
    try {
      const payload = verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';
      sendUnauthorized(res, message);
      return;
    }
  } catch (error) {
    sendUnauthorized(res, 'Authentication failed');
    return;
  }
}

/**
 * Authorization middleware - ensures user is a driver
 */
export function requireDriver(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendUnauthorized(res, 'Authentication required');
    return;
  }

  if (req.user.role !== 'driver') {
    sendUnauthorized(res, 'Driver access required');
    return;
  }

  next();
}

/**
 * Authorization middleware - ensures user is a rider
 */
export function requireRider(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendUnauthorized(res, 'Authentication required');
    return;
  }

  if (req.user.role !== 'rider') {
    sendUnauthorized(res, 'Rider access required');
    return;
  }

  next();
}

/**
 * Optional authentication - attaches user if token is present, but doesn't fail if missing
 * Useful for routes that work for both authenticated and unauthenticated users
 */
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
        try {
          req.user = verifyToken(parts[1]);
        } catch (error) {
          // Invalid token, but continue without user
          delete req.user;
        }
      }
    }
  } catch (error) {
    // Continue without user
    delete req.user;
  }

  next();
}

