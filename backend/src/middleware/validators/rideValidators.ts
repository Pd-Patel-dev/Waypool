/**
 * Validation schemas for ride-related endpoints
 */

import { body, param, query } from 'express-validator';

/**
 * Validation for creating a new ride (POST /api/driver/rides)
 */
export const createRideValidation = [
  // Driver info
  body('driverName')
    .trim()
    .notEmpty()
    .withMessage('Driver name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Driver name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Driver name contains invalid characters'),
  
  body('driverPhone')
    .trim()
    .notEmpty()
    .withMessage('Driver phone is required')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  
  // Car info
  body('carMake')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Car make must be between 1 and 50 characters'),
  
  body('carModel')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Car model must be between 1 and 50 characters'),
  
  body('carYear')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Car year must be a valid year'),
  
  body('carColor')
    .optional()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Car color must be between 1 and 30 characters'),
  
  // Pickup location
  body('fromAddress')
    .trim()
    .notEmpty()
    .withMessage('Pickup address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Pickup address must be between 5 and 200 characters'),
  
  body('fromCity')
    .trim()
    .notEmpty()
    .withMessage('Pickup city is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Pickup city must be between 2 and 100 characters'),
  
  body('fromState')
    .trim()
    .notEmpty()
    .withMessage('Pickup state is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Pickup state must be between 2 and 50 characters'),
  
  body('fromZipCode')
    .optional({ values: 'falsy' }) // Treat empty strings, null, undefined as optional
    .custom((value) => {
      // If value is provided and not empty, validate format
      if (value && typeof value === 'string' && value.trim().length > 0) {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(value.trim())) {
          throw new Error('Invalid zip code format. Must be 5 digits (e.g., 12345) or 5+4 format (e.g., 12345-6789)');
        }
      }
      return true;
    }),
  
  body('fromLatitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pickup latitude must be between -90 and 90'),
  
  body('fromLongitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Pickup longitude must be between -180 and 180'),
  
  // Destination
  body('toAddress')
    .trim()
    .notEmpty()
    .withMessage('Destination address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Destination address must be between 5 and 200 characters'),
  
  body('toCity')
    .trim()
    .notEmpty()
    .withMessage('Destination city is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Destination city must be between 2 and 100 characters'),
  
  body('toState')
    .trim()
    .notEmpty()
    .withMessage('Destination state is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Destination state must be between 2 and 50 characters'),
  
  body('toZipCode')
    .optional({ values: 'falsy' }) // Treat empty strings, null, undefined as optional
    .custom((value) => {
      // If value is provided and not empty, validate format
      if (value && typeof value === 'string' && value.trim().length > 0) {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(value.trim())) {
          throw new Error('Invalid zip code format. Must be 5 digits (e.g., 12345) or 5+4 format (e.g., 12345-6789)');
        }
      }
      return true;
    }),
  
  body('toLatitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Destination latitude must be between -90 and 90'),
  
  body('toLongitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Destination longitude must be between -180 and 180'),
  
  // Departure
  body('departureDate')
    .trim()
    .notEmpty()
    .withMessage('Departure date is required')
    .matches(/^\d{2}\/\d{2}\/\d{4}$/)
    .withMessage('Departure date must be in MM/DD/YYYY format'),
  
  body('departureTime')
    .trim()
    .notEmpty()
    .withMessage('Departure time is required')
    .matches(/^\d{1,2}:\d{2}\s?(AM|PM|am|pm)$/)
    .withMessage('Departure time must be in HH:MM AM/PM format'),
  
  // Seats and pricing
  body('availableSeats')
    .isInt({ min: 1, max: 8 })
    .withMessage('Available seats must be between 1 and 8'),
  
  body('pricePerSeat')
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Price per seat must be between 0 and 10000'),
  
  // Optional fields
  body('distance')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Distance must be between 0 and 10000 miles'),
  
  body('estimatedTimeMinutes')
    .optional()
    .isInt({ min: 1, max: 10080 })
    .withMessage('Estimated time must be between 1 and 10080 minutes (7 days)'),
  
  body('isRecurring')
    .optional()
    .isBoolean()
    .withMessage('isRecurring must be a boolean'),
  
  body('recurringPattern')
    .optional()
    .trim()
    .isIn(['daily', 'weekly', 'monthly'])
    .withMessage('Recurring pattern must be daily, weekly, or monthly'),
  
  body('recurringEndDate')
    .optional()
    .trim()
    .matches(/^\d{2}\/\d{2}\/\d{4}$/)
    .withMessage('Recurring end date must be in MM/DD/YYYY format'),
  
  body('isDraft')
    .optional()
    .isBoolean()
    .withMessage('isDraft must be a boolean'),
];

/**
 * Validation for updating a ride (PUT /api/driver/rides/:id)
 */
export const updateRideValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ride ID'),
  
  // All fields are optional for updates, but if provided, must be valid
  body('driverName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Driver name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Driver name contains invalid characters'),
  
  body('driverPhone')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  
  body('carMake')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Car make must be between 1 and 50 characters'),
  
  body('carModel')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Car model must be between 1 and 50 characters'),
  
  body('carYear')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Car year must be a valid year'),
  
  body('carColor')
    .optional()
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Car color must be between 1 and 30 characters'),
  
  body('fromAddress')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Pickup address must be between 5 and 200 characters'),
  
  body('fromCity')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Pickup city must be between 2 and 100 characters'),
  
  body('fromState')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Pickup state must be between 2 and 50 characters'),
  
  body('fromZipCode')
    .optional({ values: 'falsy' }) // Treat empty strings, null, undefined as optional
    .custom((value) => {
      // If value is provided and not empty, validate format
      if (value && typeof value === 'string' && value.trim().length > 0) {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(value.trim())) {
          throw new Error('Invalid zip code format. Must be 5 digits (e.g., 12345) or 5+4 format (e.g., 12345-6789)');
        }
      }
      return true;
    }),
  
  body('fromLatitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Pickup latitude must be between -90 and 90'),
  
  body('fromLongitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Pickup longitude must be between -180 and 180'),
  
  body('toAddress')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Destination address must be between 5 and 200 characters'),
  
  body('toCity')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Destination city must be between 2 and 100 characters'),
  
  body('toState')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Destination state must be between 2 and 50 characters'),
  
  body('toZipCode')
    .optional({ values: 'falsy' }) // Treat empty strings, null, undefined as optional
    .custom((value) => {
      // If value is provided and not empty, validate format
      if (value && typeof value === 'string' && value.trim().length > 0) {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(value.trim())) {
          throw new Error('Invalid zip code format. Must be 5 digits (e.g., 12345) or 5+4 format (e.g., 12345-6789)');
        }
      }
      return true;
    }),
  
  body('toLatitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Destination latitude must be between -90 and 90'),
  
  body('toLongitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Destination longitude must be between -180 and 180'),
  
  body('departureDate')
    .optional()
    .trim()
    .matches(/^\d{2}\/\d{2}\/\d{4}$/)
    .withMessage('Departure date must be in MM/DD/YYYY format'),
  
  body('departureTime')
    .optional()
    .trim()
    .matches(/^\d{1,2}:\d{2}\s?(AM|PM|am|pm)$/)
    .withMessage('Departure time must be in HH:MM AM/PM format'),
  
  body('availableSeats')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('Available seats must be between 1 and 8'),
  
  body('pricePerSeat')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Price per seat must be between 0 and 10000'),
  
  body('distance')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Distance must be between 0 and 10000 miles'),
  
  body('estimatedTimeMinutes')
    .optional()
    .isInt({ min: 1, max: 10080 })
    .withMessage('Estimated time must be between 1 and 10080 minutes'),
];

/**
 * Validation for ride ID parameter
 */
export const rideIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ride ID'),
];

/**
 * Validation for starting a ride
 */
export const startRideValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ride ID'),
  
  query('driverId')
    .isInt({ min: 1 })
    .withMessage('Driver ID is required and must be a valid integer'),
];

/**
 * Validation for completing a ride
 */
export const completeRideValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ride ID'),
  
  body('driverLatitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Driver latitude must be between -90 and 90'),
  
  body('driverLongitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Driver longitude must be between -180 and 180'),
];

