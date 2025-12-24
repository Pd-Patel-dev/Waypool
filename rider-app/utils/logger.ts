/**
 * Centralized Logging Utility
 * Provides environment-aware logging that only logs in development mode
 * Prevents performance degradation and information leakage in production
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  context?: string;
}

class Logger {
  private isDevelopment: boolean;
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 100;

  constructor() {
    // Only log in development mode
    this.isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, data?: unknown, context?: string): void {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, message, data, context);
      console.debug(`[DEBUG]${context ? ` [${context}]` : ''}`, message, data || '');
    }
  }

  /**
   * Log info messages (only in development)
   */
  info(message: string, data?: unknown, context?: string): void {
    if (this.isDevelopment) {
      this.log(LogLevel.INFO, message, data, context);
      console.log(`[INFO]${context ? ` [${context}]` : ''}`, message, data || '');
    }
  }

  /**
   * Log warning messages (only in development)
   */
  warn(message: string, data?: unknown, context?: string): void {
    if (this.isDevelopment) {
      this.log(LogLevel.WARN, message, data, context);
      console.warn(`[WARN]${context ? ` [${context}]` : ''}`, message, data || '');
    }
  }

  /**
   * Log error messages (always logged, but with context)
   */
  error(message: string, error?: unknown, context?: string): void {
    // Errors are always logged, but formatted properly
    const logEntry = this.log(LogLevel.ERROR, message, error, context);
    
    if (this.isDevelopment) {
      console.error(`[ERROR]${context ? ` [${context}]` : ''}`, message, error || '');
    } else {
      // In production, you might want to send errors to a logging service
      // For now, we'll just store them silently
      this.sendToLoggingService(logEntry);
    }
  }

  /**
   * Internal log method that stores log entries
   */
  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    context?: string
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      context,
    };

    // Store in history (only in development)
    if (this.isDevelopment) {
      this.logHistory.push(entry);
      if (this.logHistory.length > this.maxHistorySize) {
        this.logHistory.shift();
      }
    }

    return entry;
  }

  /**
   * Send error to logging service (for production)
   * This can be extended to send to services like Sentry, LogRocket, etc.
   */
  private sendToLoggingService(entry: LogEntry): void {
    // TODO: Implement production logging service integration
    // Example: Sentry.captureException(entry.data);
  }

  /**
   * Get log history (only in development)
   */
  getHistory(): LogEntry[] {
    if (!this.isDevelopment) {
      return [];
    }
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.isDevelopment;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logDebug = (message: string, data?: unknown, context?: string) =>
  logger.debug(message, data, context);
export const logInfo = (message: string, data?: unknown, context?: string) =>
  logger.info(message, data, context);
export const logWarn = (message: string, data?: unknown, context?: string) =>
  logger.warn(message, data, context);
export const logError = (message: string, error?: unknown, context?: string) =>
  logger.error(message, error, context);

