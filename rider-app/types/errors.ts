/**
 * Error Type Definitions
 * Provides proper typing for error handling throughout the application
 */

import { ApiError } from '@/services/api';

/**
 * Base error interface for all application errors
 */
export interface AppErrorBase {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * Network error - occurs when network requests fail
 */
export interface NetworkError extends AppErrorBase {
  type: 'NETWORK_ERROR';
  originalError?: unknown;
  url?: string;
  method?: string;
}

/**
 * API error - occurs when API requests fail
 */
export interface ApiErrorType extends AppErrorBase {
  type: 'API_ERROR';
  status?: number;
  response?: unknown;
}

/**
 * Validation error - occurs when input validation fails
 */
export interface ValidationError extends AppErrorBase {
  type: 'VALIDATION_ERROR';
  field?: string;
  value?: unknown;
}

/**
 * Authentication error - occurs when authentication fails
 */
export interface AuthenticationError extends AppErrorBase {
  type: 'AUTHENTICATION_ERROR';
  statusCode: 401 | 403;
}

/**
 * Unknown error - fallback for untyped errors
 */
export interface UnknownError extends AppErrorBase {
  type: 'UNKNOWN_ERROR';
  originalError: unknown;
}

/**
 * Union type for all error types
 */
export type TypedError = 
  | NetworkError 
  | ApiErrorType 
  | ValidationError 
  | AuthenticationError 
  | UnknownError;

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as ApiError).message === 'string' &&
    ('status' in error || 'statusCode' in error)
  );
}

/**
 * Type guard to check if error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as NetworkError).type === 'NETWORK_ERROR'
  );
}

/**
 * Type guard to check if error is an Error object
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isApiError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'An unknown error occurred';
}

/**
 * Safely extract error status code from unknown error
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isApiError(error)) {
    return error.status;
  }
  if (typeof error === 'object' && error !== null) {
    if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
      return (error as { status: number }).status;
    }
    if ('statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
      return (error as { statusCode: number }).statusCode;
    }
  }
  return undefined;
}

/**
 * Convert unknown error to typed error
 */
export function toTypedError(error: unknown, context?: string): TypedError {
  const message = getErrorMessage(error);
  const status = getErrorStatus(error);

  // Check for authentication errors
  if (status === 401 || status === 403) {
    return {
      type: 'AUTHENTICATION_ERROR',
      message,
      statusCode: status as 401 | 403,
    };
  }

  // Check for API errors
  if (isApiError(error)) {
    return {
      type: 'API_ERROR',
      message,
      status,
      response: error,
    };
  }

  // Check for network errors (TypeError with fetch-related messages)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'NETWORK_ERROR',
      message: 'Network request failed',
      originalError: error,
    };
  }

  // Check for validation errors (status 400 or 422)
  if (status === 400 || status === 422) {
    return {
      type: 'VALIDATION_ERROR',
      message,
    };
  }

  // Default to unknown error
  return {
    type: 'UNKNOWN_ERROR',
    message,
    originalError: error,
  };
}

