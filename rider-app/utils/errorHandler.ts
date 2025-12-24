/**
 * Centralized Error Handling Utility
 * Provides consistent error handling across the application
 */

import { Alert } from 'react-native';
import { ApiError } from '@/services/api';
import { logger } from './logger';

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  statusCode?: number;
  userFriendlyMessage: string;
}

/**
 * Determine error type from error object
 */
function getErrorType(error: unknown): ErrorType {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    
    if (status === 401 || status === 403) {
      return ErrorType.AUTHENTICATION;
    }
    if (status === 404) {
      return ErrorType.NOT_FOUND;
    }
    if (status === 400 || status === 422) {
      return ErrorType.VALIDATION;
    }
    if (status >= 500) {
      return ErrorType.SERVER;
    }
    if (status === 0 || !status) {
      return ErrorType.NETWORK;
    }
  }
  
  // Check for network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ErrorType.NETWORK;
  }
  
  return ErrorType.UNKNOWN;
}

/**
 * Extract user-friendly error message
 */
function getUserFriendlyMessage(error: unknown, type: ErrorType): string {
  // If error has a user-friendly message, use it
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (message && typeof message === 'string') {
      // Check if it's already user-friendly (not technical)
      if (!message.includes('Error:') && !message.includes('at ') && !message.includes('stack')) {
        return message;
      }
    }
  }

  // Default messages based on error type
  switch (type) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case ErrorType.AUTHENTICATION:
      return 'Your session has expired. Please log in again.';
    case ErrorType.VALIDATION:
      return 'Please check your input and try again.';
    case ErrorType.NOT_FOUND:
      return 'The requested item could not be found.';
    case ErrorType.SERVER:
      return 'Server error occurred. Please try again later.';
    case ErrorType.UNKNOWN:
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Extract error message from error object
 */
function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unknown error occurred';
}

/**
 * Process and normalize error
 */
export function processError(error: unknown): AppError {
  const type = getErrorType(error);
  const message = extractErrorMessage(error);
  const userFriendlyMessage = getUserFriendlyMessage(error, type);
  
  const statusCode = error && typeof error === 'object' && 'status' in error
    ? (error as { status?: number }).status
    : undefined;

  return {
    type,
    message,
    originalError: error,
    statusCode,
    userFriendlyMessage,
  };
}

/**
 * Log error for debugging (only in development)
 */
function logError(error: AppError, context?: string): void {
  logger.error(
    `${error.type}: ${error.message}`,
    {
      userFriendlyMessage: error.userFriendlyMessage,
      statusCode: error.statusCode,
      originalError: error.originalError,
    },
    context || 'ErrorHandler'
  );
}

/**
 * Handle error with user notification
 * @param error - Error to handle
 * @param options - Handling options
 */
export function handleError(
  error: unknown,
  options: {
    context?: string;
    showAlert?: boolean;
    alertTitle?: string;
    onError?: (appError: AppError) => void;
    silent?: boolean; // For errors that should be handled silently (e.g., optional operations)
  } = {}
): AppError {
  const {
    context,
    showAlert = false,
    alertTitle = 'Error',
    onError,
    silent = false,
  } = options;

  const appError = processError(error);
  
  // Log error (only in development and if not silent)
  if (!silent) {
    logError(appError, context);
  }

  // Show alert if requested
  if (showAlert && !silent) {
    Alert.alert(alertTitle, appError.userFriendlyMessage);
  }

  // Call custom error handler if provided
  if (onError) {
    onError(appError);
  }

  return appError;
}

/**
 * Handle error silently (for optional operations)
 */
export function handleErrorSilently(error: unknown, context?: string): AppError {
  return handleError(error, { context, silent: true });
}

/**
 * Handle error with alert
 */
export function handleErrorWithAlert(
  error: unknown,
  options: {
    context?: string;
    title?: string;
    onError?: (appError: AppError) => void;
  } = {}
): AppError {
  return handleError(error, {
    ...options,
    showAlert: true,
    alertTitle: options.title || 'Error',
  });
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const appError = processError(error);
  return appError.type === ErrorType.NETWORK;
}

/**
 * Check if error is an authentication error
 */
export function isAuthenticationError(error: unknown): boolean {
  const appError = processError(error);
  return appError.type === ErrorType.AUTHENTICATION;
}

/**
 * Get error message for display
 */
export function getErrorMessage(error: unknown): string {
  const appError = processError(error);
  return appError.userFriendlyMessage;
}

