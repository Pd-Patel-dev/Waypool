/**
 * Validation schemas for booking-related endpoints
 */

import { body, param, query } from 'express-validator';

/**
 * Validation for creating a booking (POST /api/rider/rides/book)
 * Note: rideId and riderId come from body, not query params
 */
export const createBookingValidation = [
  // Body params
  body('rideId')
    .isInt({ min: 1 })
    .withMessage('Ride ID is required and must be a valid integer'),
  
  body('riderId')
    .isInt({ min: 1 })
    .withMessage('Rider ID is required and must be a valid integer'),
  
  // Booking details
  body('pickupAddress')
    .trim()
    .notEmpty()
    .withMessage('Pickup address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Pickup address must be between 5 and 200 characters'),
  
  body('pickupCity')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Pickup city must be between 2 and 100 characters'),
  
  body('pickupState')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Pickup state must be between 2 and 50 characters'),
  
  body('pickupZipCode')
    .optional()
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Invalid zip code format'),
  
  body('pickupLatitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pickup latitude must be between -90 and 90'),
  
  body('pickupLongitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Pickup longitude must be between -180 and 180'),
  
  body('numberOfSeats')
    .isInt({ min: 1, max: 8 })
    .withMessage('Number of seats must be between 1 and 8'),
  
  body('paymentMethodId')
    .optional()
    .trim()
    .matches(/^pm_[a-zA-Z0-9]+$/)
    .withMessage('Invalid payment method ID format'),
];

/**
 * Validation for updating a booking (PUT /api/rider/bookings/:id)
 */
export const updateBookingValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid booking ID'),
  
  query('riderId')
    .isInt({ min: 1 })
    .withMessage('Rider ID is required and must be a valid integer'),
  
  body('pickupAddress')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Pickup address must be between 5 and 200 characters'),
  
  body('pickupCity')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Pickup city must be between 2 and 100 characters'),
  
  body('pickupState')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Pickup state must be between 2 and 50 characters'),
  
  body('pickupZipCode')
    .optional()
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Invalid zip code format'),
  
  body('pickupLatitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pickup latitude must be between -90 and 90'),
  
  body('pickupLongitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Pickup longitude must be between -180 and 180'),
  
  body('numberOfSeats')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('Number of seats must be between 1 and 8'),
];

/**
 * Validation for booking ID parameter
 */
export const bookingIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid booking ID'),
];

