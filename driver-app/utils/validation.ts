/**
 * Centralized input validation utilities
 * Provides reusable validation functions for forms
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

/**
 * Validate phone number (US format: 10 digits)
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: 'Phone number is required' };
  }

  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length !== 10) {
    return { isValid: false, error: 'Please enter a valid 10-digit phone number' };
  }

  return { isValid: true };
}

/**
 * Validate password
 */
export function validatePassword(password: string, minLength: number = 6): ValidationResult {
  if (!password || password.length === 0) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < minLength) {
    return { isValid: false, error: `Password must be at least ${minLength} characters long` };
  }

  return { isValid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: string | number | null | undefined, fieldName: string): ValidationResult {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number | string,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }

  if (num < min || num > max) {
    return { isValid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { isValid: true };
}

/**
 * Validate price (must be positive number)
 */
export function validatePrice(price: string | number, fieldName: string = 'Price'): ValidationResult {
  const num = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }

  if (num < 0) {
    return { isValid: false, error: `${fieldName} must be a positive number` };
  }

  return { isValid: true };
}

/**
 * Validate year (for car year)
 */
export function validateYear(year: string | number): ValidationResult {
  const num = typeof year === 'string' ? parseInt(year, 10) : year;
  const currentYear = new Date().getFullYear();
  const minYear = 1900;
  const maxYear = currentYear + 1; // Allow next year

  if (isNaN(num)) {
    return { isValid: false, error: 'Please enter a valid year' };
  }

  if (num < minYear || num > maxYear) {
    return { isValid: false, error: `Year must be between ${minYear} and ${maxYear}` };
  }

  return { isValid: true };
}

/**
 * Validate date string
 */
export function validateDate(dateString: string, fieldName: string = 'Date'): ValidationResult {
  if (!dateString || dateString.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: `Please enter a valid ${fieldName.toLowerCase()}` };
  }

  // Check if date is in the past (for departure dates, should be future)
  if (date < new Date()) {
    return { isValid: false, error: `${fieldName} cannot be in the past` };
  }

  return { isValid: true };
}

/**
 * Validate ZIP code (US format: 5 digits or 5+4 format)
 */
export function validateZipCode(zipCode: string): ValidationResult {
  if (!zipCode || zipCode.trim().length === 0) {
    return { isValid: true }; // ZIP code is optional
  }

  const zipRegex = /^\d{5}(-\d{4})?$/;
  if (!zipRegex.test(zipCode.trim())) {
    return { isValid: false, error: 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)' };
  }

  return { isValid: true };
}

