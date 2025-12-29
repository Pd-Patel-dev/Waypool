/**
 * Standardized API Response Utilities
 * Provides consistent response format across all API endpoints
 */

import type { Response } from 'express';

/**
 * Error Codes Enum
 * Standardized error codes for client-side error handling
 */
export enum ErrorCode {
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  ACCOUNT_NOT_VERIFIED = 'ACCOUNT_NOT_VERIFIED',
  
  // Payment errors
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_METHOD_INVALID = 'PAYMENT_METHOD_INVALID',
  PAYMENT_METHOD_NOT_FOUND = 'PAYMENT_METHOD_NOT_FOUND',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  REFUND_FAILED = 'REFUND_FAILED',
  
  // Ride/Booking errors
  RIDE_NOT_FOUND = 'RIDE_NOT_FOUND',
  RIDE_FULL = 'RIDE_FULL',
  RIDE_CANCELLED = 'RIDE_CANCELLED',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  BOOKING_ALREADY_EXISTS = 'BOOKING_ALREADY_EXISTS',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  INVALID_PICKUP_PIN = 'INVALID_PICKUP_PIN',
  PICKUP_PIN_LOCKED = 'PICKUP_PIN_LOCKED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Service errors
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',
  PUSH_NOTIFICATION_ERROR = 'PUSH_NOTIFICATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  errors?: string[];
  code?: string;
}

/**
 * Standard Error Response Structure
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error?: string; // Detailed error (only in development)
  errors?: string[]; // Validation errors
  code?: string; // Error code for client-side handling
}

/**
 * Standard Success Response Structure
 */
export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data?: T;
}

/**
 * Send a standardized success response
 */
export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
  };

  return res.status(statusCode).json(response);
}

/**
 * Send a standardized error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400,
  options?: {
    error?: string; // Detailed error message
    errors?: string[]; // Validation errors
    code?: string | ErrorCode; // Error code
  }
): Response {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response: ErrorResponse = {
    success: false,
    message,
    ...(options?.errors && { errors: options.errors }),
    ...(options?.code && { code: String(options.code) }),
    // Only include detailed error in development
    ...(isDevelopment && options?.error && { error: options.error }),
  };

  return res.status(statusCode).json(response);
}

/**
 * Send a standardized validation error response
 */
export function sendValidationError(
  res: Response,
  message: string = 'Validation failed',
  errors: string[],
  statusCode: number = 400
): Response {
  return sendError(res, message, statusCode, { errors });
}

/**
 * Send a standardized not found error response
 */
export function sendNotFound(
  res: Response,
  resource: string = 'Resource',
  statusCode: number = 404
): Response {
  return sendError(res, `${resource} not found`, statusCode, {
    code: 'NOT_FOUND',
  });
}

/**
 * Send a standardized unauthorized error response
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized access',
  statusCode: number = 401
): Response {
  return sendError(res, message, statusCode, {
    code: 'UNAUTHORIZED',
  });
}

/**
 * Send a standardized forbidden error response
 */
export function sendForbidden(
  res: Response,
  message: string = 'Access forbidden',
  statusCode: number = 403
): Response {
  return sendError(res, message, statusCode, {
    code: 'FORBIDDEN',
  });
}

/**
 * Send a standardized internal server error response
 */
export function sendInternalError(
  res: Response,
  error: unknown,
  message: string = 'Internal server error'
): Response {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  // Log the full error for debugging
  console.error('❌ Internal Server Error:', error);
  if (error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }

  return sendError(res, message, 500, {
    error: errorMessage,
    code: 'INTERNAL_ERROR',
  });
}

/**
 * Send a standardized conflict error response
 */
export function sendConflict(
  res: Response,
  message: string,
  statusCode: number = 409
): Response {
  return sendError(res, message, statusCode, {
    code: 'CONFLICT',
  });
}

/**
 * Send a standardized bad request error response
 */
export function sendBadRequest(
  res: Response,
  message: string,
  statusCode: number = 400
): Response {
  return sendError(res, message, statusCode, {
    code: 'BAD_REQUEST',
  });
}

