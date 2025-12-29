import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Rate limiter for authentication endpoints (login, signup)
 * Prevents brute force attacks
 * 
 * Limits:
 * - 5 requests per 15 minutes per IP
 * - Stricter than general API to prevent credential stuffing
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 900;
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      retryAfter,
    });
  },
  // Skip rate limiting in test mode
  skip: (req: Request) => {
    return process.env.ENABLE_TEST_MODE === 'true';
  },
});

/**
 * Rate limiter for email sending endpoints (OTP, verification codes)
 * Prevents email spam and abuse
 * 
 * Limits:
 * - 3 requests per 15 minutes per IP
 * - Stricter to prevent email bombing
 */
export const emailRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 email requests per windowMs
  message: {
    success: false,
    message: 'Too many email requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 900;
    res.status(429).json({
      success: false,
      message: 'Too many email requests. Please try again after 15 minutes.',
      retryAfter,
    });
  },
  skip: (req: Request) => {
    return process.env.ENABLE_TEST_MODE === 'true';
  },
});

/**
 * General API rate limiter
 * Prevents DDoS attacks and API abuse
 * 
 * Limits:
 * - 100 requests per 15 minutes per IP
 * - More lenient for normal API usage
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 900;
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP. Please try again later.',
      retryAfter,
    });
  },
  skip: (req: Request) => {
    return process.env.ENABLE_TEST_MODE === 'true';
  },
});

/**
 * Rate limiter for payment endpoints
 * Prevents payment fraud and abuse
 * 
 * Limits:
 * - 10 requests per 15 minutes per IP
 * - Stricter than general API to prevent payment method enumeration
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 payment requests per windowMs
  message: {
    success: false,
    message: 'Too many payment requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 900;
    res.status(429).json({
      success: false,
      message: 'Too many payment requests. Please try again after 15 minutes.',
      retryAfter,
    });
  },
  skip: (req: Request) => {
    return process.env.ENABLE_TEST_MODE === 'true';
  },
});

/**
 * Strict rate limiter for sensitive operations
 * Used for password reset, account deletion, etc.
 * 
 * Limits:
 * - 3 requests per hour per IP
 * - Very strict for sensitive operations
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    success: false,
    message: 'Too many requests for this operation. Please try again after 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 3600;
    res.status(429).json({
      success: false,
      message: 'Too many requests for this operation. Please try again after 1 hour.',
      retryAfter,
    });
  },
  skip: (req: Request) => {
    return process.env.ENABLE_TEST_MODE === 'true';
  },
});

