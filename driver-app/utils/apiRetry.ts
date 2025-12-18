/**
 * API retry utility with exponential backoff
 * Provides automatic retry mechanism for failed API calls
 */

import { isRetryableError as isRetryableErrorFromHandler } from './errorHandler';

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry (default: 1000ms = 1 second)
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds (default: 10000ms = 10 seconds)
   */
  maxDelay?: number;

  /**
   * Exponential backoff multiplier (default: 2)
   */
  backoffMultiplier?: number;

  /**
   * Additional retryable HTTP status codes
   */
  retryableStatusCodes?: number[];

  /**
   * Whether to use error handler's retryable check (default: true)
   */
  useErrorHandler?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'retryableStatusCodes'>> & { retryableStatusCodes: number[] } = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
  useErrorHandler: true,
};

/**
 * Sleep/delay utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Get error message safely
 */
function getErrorMessage(error: unknown): string {
  if (hasMessage(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '';
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
 * Check if error is retryable
 * Integrates with errorHandler to use centralized retry logic
 */
function isRetryableError(error: unknown, options: Required<Omit<RetryOptions, 'retryableStatusCodes'>> & { retryableStatusCodes: number[] }): boolean {
  // Use error handler's retryable check if enabled (default behavior)
  if (options.useErrorHandler) {
    try {
      return isRetryableErrorFromHandler(error);
    } catch {
      // Fall through to manual check if error handler fails
    }
  }

  const errorStatus = getErrorStatus(error);
  const errorMessage = getErrorMessage(error).toLowerCase();

  // Manual retryable check as fallback
  // Network errors (no status code) are usually retryable
  if (errorStatus === undefined) {
    // Check for network-related error messages
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('networkerror') ||
      errorMessage.includes('network request failed')
    ) {
      // CORS errors should not be retried
      if (errorMessage.includes('cors')) {
        return false;
      }
      return true;
    }
  }

  // Check if status code is in retryable list
  if (errorStatus !== undefined && options.retryableStatusCodes.includes(errorStatus)) {
    return true;
  }

  // 5xx server errors are generally retryable
  if (errorStatus !== undefined && errorStatus >= 500 && errorStatus < 600) {
    return true;
  }

  // 408 (Request Timeout) and 429 (Too Many Requests) are retryable
  if (errorStatus === 408 || errorStatus === 429) {
    return true;
  }

  // 4xx client errors (except 408, 429) are generally NOT retryable
  if (errorStatus !== undefined && errorStatus >= 400 && errorStatus < 500) {
    return false;
  }

  return false;
}

/**
 * Execute API call with retry logic and exponential backoff
 * 
 * @param apiCall - Function that returns a Promise for the API call
 * @param options - Retry configuration options
 * @returns Promise that resolves with the API response or rejects after all retries fail
 * 
 * @example
 * ```typescript
 * const data = await retryApiCall(
 *   () => fetch('/api/endpoint').then(r => r.json()),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    retryableStatusCodes: options.retryableStatusCodes || DEFAULT_OPTIONS.retryableStatusCodes,
  };

  let lastError: any;
  let delay = opts.initialDelay;

  // Try initial attempt + maxRetries
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Attempt the API call
      return await apiCall();
    } catch (error: unknown) {
      lastError = error;

      // Don't retry if it's the last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error, opts)) {
        // Not retryable, break immediately
        break;
      }

      // Calculate delay with exponential backoff, capped at maxDelay
      const currentDelay = Math.min(delay, opts.maxDelay);
      
      // Wait before retrying
      await sleep(currentDelay);

      // Increase delay exponentially for next retry
      delay *= opts.backoffMultiplier;
    }
  }

  // All retries failed, throw the last error
  throw lastError;
}

/**
 * Wrapper for fetch with automatic retry logic
 * 
 * @param url - URL to fetch
 * @param options - Fetch options (RequestInit)
 * @param retryOptions - Retry configuration
 * @returns Promise that resolves with Response
 * 
 * @example
 * ```typescript
 * const response = await fetchWithRetry('/api/endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryApiCall(
    async () => {
      const response = await fetch(url, options);

      // If response is not ok, throw an error with status
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & { status: number; response: Response };
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    },
    retryOptions
  );
}

