/**
 * Validation schemas for profile update endpoints
 */

import { body } from 'express-validator';

/**
 * Validation for updating driver profile
 */
export const updateDriverProfileValidation = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name contains invalid characters'),
  
  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  
  body('photoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
  
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),
  
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
];

/**
 * Validation for updating rider profile
 */
export const updateRiderProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name contains invalid characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name contains invalid characters'),
  
  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  
  body('photoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Photo URL must be a valid URL'),
];

