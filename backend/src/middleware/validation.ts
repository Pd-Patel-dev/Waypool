/**
 * Input Validation Middleware
 * Provides validation utilities and error handling for express-validator
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { sendValidationError } from '../utils/apiResponse';

/**
 * Middleware to handle validation errors
 * Returns 400 Bad Request if validation fails
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => {
      if ('msg' in error && typeof error.msg === 'string') {
        return error.msg;
      }
      if ('type' in error && 'path' in error) {
        return `${(error as any).type}: ${(error as any).path}`;
      }
      return 'Validation error';
    });
    
    sendValidationError(res, 'Validation failed', errorMessages);
    return;
  }
  
  next();
};

/**
 * Run multiple validation chains and handle errors
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));
    
    // Check for errors
    handleValidationErrors(req, res, next);
  };
};

/**
 * Sanitize string input - trim whitespace and remove dangerous characters
 */
export const sanitizeString = (value: string | undefined): string | undefined => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  // Trim whitespace
  return value.trim();
};

/**
 * Sanitize number input - ensure it's a valid number
 */
export const sanitizeNumber = (value: any): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? undefined : num;
};

/**
 * Sanitize integer input - ensure it's a valid integer
 */
export const sanitizeInteger = (value: any): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const num = typeof value === 'string' ? parseInt(value, 10) : Math.floor(Number(value));
  return isNaN(num) ? undefined : num;
};

