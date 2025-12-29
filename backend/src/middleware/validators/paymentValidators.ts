/**
 * Validation schemas for payment-related endpoints
 */

import { body, param } from 'express-validator';

/**
 * Validation for attaching a payment method (POST /api/rider/payment/attach-payment-method)
 * Note: riderId is obtained from JWT token, not from request body
 */
export const attachPaymentMethodValidation = [
  body('paymentMethodId')
    .trim()
    .notEmpty()
    .withMessage('Payment method ID is required')
    .matches(/^pm_[a-zA-Z0-9]{24,}$/)
    .withMessage('Invalid payment method ID format. Must start with "pm_" and be a valid Stripe payment method ID'),
  
  body('paymentMethodType')
    .optional()
    .trim()
    .isIn(['card', 'bank_account', 'us_bank_account'])
    .withMessage('Payment method type must be card, bank_account, or us_bank_account'),
];

/**
 * Validation for payment method ID
 */
export const paymentMethodIdValidation = [
  body('paymentMethodId')
    .trim()
    .notEmpty()
    .withMessage('Payment method ID is required')
    .matches(/^pm_[a-zA-Z0-9]+$/)
    .withMessage('Invalid payment method ID format'),
];

