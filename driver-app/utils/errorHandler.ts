/**
 * Centralized error handling utility
 * Provides consistent error messages and error recovery mechanisms
 */

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Unknown error type for catch blocks
 */
export type UnknownError = 
  | Error 
  | { message?: string; status?: number; errors?: string[] }
  | unknown;

/**
 * Parse API error response into standardized AppError
 */
export function parseApiError(error: UnknownError): AppError {
  // Network errors (no response from server)
  if (error?.message?.includes('Network') || error?.message?.includes('fetch') || error?.message?.includes('Failed to fetch')) {
    // Check for specific network error types
    if (error?.message?.includes('timeout') || error?.message?.includes('TIMEOUT')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: error.message || 'Network timeout',
        userMessage: 'The request took too long. Please check your internet connection and try again.',
        recoverable: true,
        retryable: true,
      };
    }
    
    if (error?.message?.includes('CORS') || error?.message?.includes('cors')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: error.message || 'CORS error',
        userMessage: 'Connection blocked. Please contact support if this issue persists.',
        recoverable: false,
        retryable: false,
      };
    }

    return {
      code: ErrorCode.NETWORK_ERROR,
      message: error.message || 'Network request failed',
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      recoverable: true,
      retryable: true,
    };
  }

  // Authentication errors
  if (error?.status === 401 || error?.message?.includes('unauthorized') || error?.message?.includes('authentication')) {
    return {
      code: ErrorCode.AUTHENTICATION_ERROR,
      message: error.message || 'Authentication failed',
      userMessage: 'Your session has expired. Please log in again.',
      recoverable: true,
      retryable: false,
    };
  }

  // Validation errors
  if (error?.status === 400 || error?.errors?.length > 0) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: error.message || 'Validation failed',
      userMessage: error.errors?.join('\n') || error.message || 'Please check your input and try again.',
      recoverable: true,
      retryable: false,
    };
  }

  // Server errors
  if (error?.status === 500 || error?.status >= 500) {
    let userMessage = 'The server is experiencing issues. Please try again later.';
    
    if (error?.status === 503) {
      userMessage = 'The service is temporarily unavailable. Please try again in a few moments.';
    } else if (error?.status === 504) {
      userMessage = 'The server took too long to respond. Please try again.';
    } else if (error?.status === 502) {
      userMessage = 'The server is not responding correctly. Please try again later.';
    }

    return {
      code: ErrorCode.SERVER_ERROR,
      message: error.message || 'Server error',
      userMessage,
      recoverable: true,
      retryable: true,
    };
  }

  // Permission errors
  if (error?.status === 403 || error?.message?.includes('permission') || error?.message?.includes('forbidden')) {
    return {
      code: ErrorCode.PERMISSION_ERROR,
      message: error.message || 'Permission denied',
      userMessage: 'You don\'t have permission to perform this action.',
      recoverable: false,
      retryable: false,
    };
  }

  // Unknown errors
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: error?.message || 'An unexpected error occurred',
    userMessage: error?.message || 'Something went wrong. Please try again.',
    recoverable: true,
    retryable: true,
  };
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: UnknownError): string {
  const appError = parseApiError(error);
  return appError.userMessage;
}

/**
 * Check if error is recoverable (user can try again)
 */
export function isRecoverableError(error: UnknownError): boolean {
  const appError = parseApiError(error);
  return appError.recoverable;
}

/**
 * Check if error is retryable (should retry automatically)
 */
export function isRetryableError(error: UnknownError): boolean {
  const appError = parseApiError(error);
  return appError.retryable;
}

