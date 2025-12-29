/**
 * Request Logging Middleware
 * Logs all API requests, payment transactions, and authentication attempts
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Simple logger utility for request logging
 */
const logger = {
  info: (message: string, data?: any, context?: string) => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    console.log(`[${timestamp}] ${contextStr} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: any, context?: string) => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    console.warn(`[${timestamp}] ${contextStr} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, data?: any, context?: string) => {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    console.error(`[${timestamp}] ${contextStr} ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
};

interface LoggedRequest extends Request {
  startTime?: number;
}

/**
 * Determine if a request should be logged based on path
 */
function shouldLogRequest(path: string): boolean {
  // Don't log health checks excessively
  if (path === '/health') {
    return false;
  }
  
  // Log all API requests
  if (path.startsWith('/api')) {
    return true;
  }
  
  return false;
}

/**
 * Determine if a request is a payment transaction
 */
function isPaymentRequest(path: string, method: string): boolean {
  const paymentPaths = [
    '/api/rider/payment',
    '/api/webhooks/stripe',
    '/api/driver/payouts',
  ];
  
  return paymentPaths.some(paymentPath => path.includes(paymentPath)) && 
         (method === 'POST' || method === 'PUT' || method === 'PATCH');
}

/**
 * Determine if a request is an authentication attempt
 */
function isAuthRequest(path: string, method: string): boolean {
  const authPaths = [
    '/api/driver/auth/login',
    '/api/driver/auth/signup',
    '/api/rider/auth/login',
    '/api/rider/auth/signup',
    '/api/driver/auth/verify-email',
    '/api/rider/auth/verify-email',
    '/api/driver/auth/send-otp',
    '/api/rider/auth/send-otp',
  ];
  
  return authPaths.some(authPath => path.includes(authPath)) && method === 'POST';
}

/**
 * Sanitize sensitive data from request body for logging
 */
function sanitizeBody(body: any, path: string): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'refreshToken',
    'accessToken',
    'apiKey',
    'secret',
    'cardNumber',
    'cvv',
    'cvc',
    'pin',
    'pickupPin',
    'verificationCode',
    'otp',
    'code',
  ];

  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  // For payment methods, only log the ID, not full details
  if (path.includes('/payment') && sanitized.paymentMethodId) {
    sanitized.paymentMethodId = sanitized.paymentMethodId.substring(0, 10) + '...';
  }

  return sanitized;
}

/**
 * Request logging middleware
 */
export function requestLogger(req: LoggedRequest, res: Response, next: NextFunction): void {
  if (!shouldLogRequest(req.path)) {
    return next();
  }

  req.startTime = Date.now();
  const startTime = req.startTime;

  // Log request start
  const requestType = isPaymentRequest(req.path, req.method) 
    ? 'PAYMENT' 
    : isAuthRequest(req.path, req.method)
    ? 'AUTH'
    : 'API';

  const logData: any = {
    type: requestType,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  // Add user ID if available (from JWT)
  if ((req as any).user?.userId) {
    logData.userId = (req as any).user.userId;
    logData.userType = (req as any).user.userType || 'unknown';
  }

  // Log request body (sanitized)
  if (req.body && Object.keys(req.body).length > 0) {
    logData.body = sanitizeBody(req.body, req.path);
  }

  // Log query parameters (except sensitive ones)
  if (req.query && Object.keys(req.query).length > 0) {
    const sanitizedQuery = { ...req.query };
    if (sanitizedQuery.token) {
      sanitizedQuery.token = '***REDACTED***';
    }
    logData.query = sanitizedQuery;
  }

  // Log the request
  logger.info(`[${requestType}] ${req.method} ${req.path}`, logData, 'requestLogger');

  // Log response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseData: any = {
      type: requestType,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };

    // Add user ID if available
    if ((req as any).user?.userId) {
      responseData.userId = (req as any).user.userId;
    }

    // Log payment transactions with more detail
    if (isPaymentRequest(req.path, req.method)) {
      responseData.paymentTransaction = true;
      if (req.body?.paymentMethodId) {
        responseData.paymentMethodId = req.body.paymentMethodId.substring(0, 10) + '...';
      }
      if (req.body?.bookingId) {
        responseData.bookingId = req.body.bookingId;
      }
      if (req.body?.amount) {
        responseData.amount = req.body.amount;
      }
    }

    // Log authentication attempts with more detail
    if (isAuthRequest(req.path, req.method)) {
      responseData.authAttempt = true;
      responseData.success = res.statusCode < 400;
    }

    // Use appropriate log level
    if (res.statusCode >= 500) {
      logger.error(`[${requestType}] ${req.method} ${req.path} - ${res.statusCode}`, responseData, 'requestLogger');
    } else if (res.statusCode >= 400) {
      logger.warn(`[${requestType}] ${req.method} ${req.path} - ${res.statusCode}`, responseData, 'requestLogger');
    } else {
      logger.info(`[${requestType}] ${req.method} ${req.path} - ${res.statusCode}`, responseData, 'requestLogger');
    }
  });

  next();
}

