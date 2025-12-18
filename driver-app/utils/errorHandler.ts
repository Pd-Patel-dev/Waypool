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
 * Type guard to check if error has message property
 */
function hasMessage(error: unknown): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string';
}

/**
 * Type guard to check if error has status property
 */
function hasStatus(error: unknown): error is { status: number } {
  return typeof error === 'object' && error !== null && 'status' in error && typeof (error as any).status === 'number';
}

/**
 * Type guard to check if error has errors array
 */
function hasErrors(error: unknown): error is { errors: string[] } {
  return typeof error === 'object' && error !== null && 'errors' in error && Array.isArray((error as any).errors);
}

/**
 * Get error message safely
 */
function getErrorMessage(error: unknown): string {
  if (hasMessage(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Get error status safely
 */
function getErrorStatus(error: unknown): number | undefined {
  if (hasStatus(error)) {
    return error.status;
  }
  return undefined;
}

/**
 * Parse API error response into standardized AppError
 */
export function parseApiError(error: UnknownError): AppError {
  const errorMessage = getErrorMessage(error);
  const errorStatus = getErrorStatus(error);
  const hasErrorsArray = hasErrors(error);

  // Network errors (no response from server)
  if (errorMessage.includes('Network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
    // Check for specific network error types
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: errorMessage || 'Network timeout',
        userMessage: 'The request took too long. Please check your internet connection and try again.',
        recoverable: true,
        retryable: true,
      };
    }
    
    if (errorMessage.includes('CORS') || errorMessage.includes('cors')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: errorMessage || 'CORS error',
        userMessage: 'Connection blocked. Please contact support if this issue persists.',
        recoverable: false,
        retryable: false,
      };
    }

    return {
      code: ErrorCode.NETWORK_ERROR,
      message: errorMessage || 'Network request failed',
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      recoverable: true,
      retryable: true,
    };
  }

  // Authentication errors
  if (errorStatus === 401 || errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return {
      code: ErrorCode.AUTHENTICATION_ERROR,
      message: errorMessage || 'Authentication failed',
      userMessage: 'Your session has expired. Please log in again.',
      recoverable: true,
      retryable: false,
    };
  }

  // Validation errors
  if (errorStatus === 400 || (hasErrorsArray && error.errors.length > 0)) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: errorMessage || 'Validation failed',
      userMessage: (hasErrorsArray ? error.errors.join('\n') : '') || errorMessage || 'Please check your input and try again.',
      recoverable: true,
      retryable: false,
    };
  }

  // Server errors
  if (errorStatus !== undefined && (errorStatus === 500 || errorStatus >= 500)) {
    let userMessage = 'The server is experiencing issues. Please try again later.';
    
    if (errorStatus === 503) {
      userMessage = 'The service is temporarily unavailable. Please try again in a few moments.';
    } else if (errorStatus === 504) {
      userMessage = 'The server took too long to respond. Please try again.';
    } else if (errorStatus === 502) {
      userMessage = 'The server is not responding correctly. Please try again later.';
    }

    return {
      code: ErrorCode.SERVER_ERROR,
      message: errorMessage || 'Server error',
      userMessage,
      recoverable: true,
      retryable: true,
    };
  }

  // Permission errors
  if (errorStatus === 403 || errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
    return {
      code: ErrorCode.PERMISSION_ERROR,
      message: errorMessage || 'Permission denied',
      userMessage: 'You don\'t have permission to perform this action.',
      recoverable: false,
      retryable: false,
    };
  }

  // Unknown errors
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: errorMessage || 'An unexpected error occurred',
    userMessage: errorMessage || 'Something went wrong. Please try again.',
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

