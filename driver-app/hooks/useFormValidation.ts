/**
 * Form Validation Hook
 * Provides real-time validation with immediate feedback for form fields
 */

import { useState, useCallback, useEffect } from 'react';
import {
  validateEmail,
  validatePhoneNumber,
  validateRequired,
  validatePassword,
  validateYear,
  validateNumberRange,
  validatePrice,
  validateDate,
  validateTime,
} from '@/utils/validation';

export interface ValidationErrors {
  [key: string]: string | undefined;
}

export interface ValidationRules {
  required?: boolean;
  email?: boolean;
  phoneNumber?: boolean;
  password?: boolean;
  year?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: (value: string | number) => { isValid: boolean; error?: string };
}

export interface FieldValidationConfig {
  [fieldName: string]: ValidationRules;
}

interface UseFormValidationOptions {
  /**
   * Validation rules for each field
   */
  rules: FieldValidationConfig;

  /**
   * Whether to validate on mount
   * @default false
   */
  validateOnMount?: boolean;

  /**
   * Whether to validate on blur (when field loses focus)
   * @default true
   */
  validateOnBlur?: boolean;

  /**
   * Whether to validate on change (real-time)
   * @default true
   */
  validateOnChange?: boolean;
}

interface UseFormValidationReturn {
  /**
   * Current validation errors
   */
  errors: ValidationErrors;

  /**
   * Set error for a specific field
   */
  setError: (field: string, error: string | undefined) => void;

  /**
   * Set multiple errors at once
   */
  setErrors: (errors: ValidationErrors) => void;

  /**
   * Clear all errors
   */
  clearErrors: () => void;

  /**
   * Clear error for a specific field
   */
  clearError: (field: string) => void;

  /**
   * Validate a single field
   */
  validateField: (field: string, value: string | number | null | undefined) => boolean;

  /**
   * Validate all fields
   */
  validateAll: (values: Record<string, string | number | null | undefined>) => boolean;

  /**
   * Get handler for field change events
   */
  handleFieldChange: (field: string) => (value: string) => void;

  /**
   * Get handler for field blur events
   */
  handleFieldBlur: (field: string) => (value: string) => void;

  /**
   * Check if form is valid
   */
  isValid: boolean;
}

/**
 * Custom hook for form validation with real-time feedback
 */
export function useFormValidation(
  options: UseFormValidationOptions
): UseFormValidationReturn {
  const {
    rules,
    validateOnMount = false,
    validateOnBlur = true,
    validateOnChange = true,
  } = options;

  const [errors, setErrorsState] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | null | undefined>>({});

  // Validate a single field based on its rules
  const validateField = useCallback(
    (field: string, value: string | number | null | undefined): boolean => {
      const fieldRules = rules[field];
      if (!fieldRules) return true;

      // Required validation
      if (fieldRules.required) {
        const result = validateRequired(value, field);
        if (!result.isValid) {
          setErrorsState((prev) => ({ ...prev, [field]: result.error }));
          return false;
        }
      }

      // Skip other validations if field is empty and not required
      if ((value === null || value === undefined || value === '') && !fieldRules.required) {
        setErrorsState((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
        return true;
      }

      let isValid = true;
      let errorMessage: string | undefined;

      // Email validation
      if (fieldRules.email && typeof value === 'string') {
        const result = validateEmail(value);
        if (!result.isValid) {
          isValid = false;
          errorMessage = result.error;
        }
      }

      // Phone number validation
      if (fieldRules.phoneNumber && typeof value === 'string') {
        const result = validatePhoneNumber(value);
        if (!result.isValid) {
          isValid = false;
          errorMessage = result.error;
        }
      }

      // Password validation
      if (fieldRules.password && typeof value === 'string') {
        const result = validatePassword(value);
        if (!result.isValid) {
          isValid = false;
          errorMessage = result.error;
        }
      }

      // Year validation
      if (fieldRules.year) {
        const result = validateYear(value);
        if (!result.isValid) {
          isValid = false;
          errorMessage = result.error;
        }
      }

      // Min/Max validation
      if (fieldRules.min !== undefined || fieldRules.max !== undefined) {
        if (typeof value === 'string' || typeof value === 'number') {
          const numValue = typeof value === 'string' ? parseFloat(value) : value;
          if (!isNaN(numValue)) {
            const result = validateNumberRange(
              numValue,
              fieldRules.min ?? -Infinity,
              fieldRules.max ?? Infinity,
              field
            );
            if (!result.isValid) {
              isValid = false;
              errorMessage = result.error;
            }
          }
        }
      }

      // Min/Max length validation
      if (fieldRules.minLength !== undefined || fieldRules.maxLength !== undefined) {
        if (typeof value === 'string') {
          const length = value.length;
          if (fieldRules.minLength !== undefined && length < fieldRules.minLength) {
            isValid = false;
            errorMessage = `${field} must be at least ${fieldRules.minLength} characters`;
          }
          if (fieldRules.maxLength !== undefined && length > fieldRules.maxLength) {
            isValid = false;
            errorMessage = `${field} must be at most ${fieldRules.maxLength} characters`;
          }
        }
      }

      // Custom validation
      if (fieldRules.custom && isValid) {
        const result = fieldRules.custom(value as string | number);
        if (!result.isValid) {
          isValid = false;
          errorMessage = result.error;
        }
      }

      // Update errors
      setErrorsState((prev) => {
        if (isValid) {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        } else {
          return { ...prev, [field]: errorMessage };
        }
      });

      return isValid;
    },
    [rules]
  );

  // Validate all fields
  const validateAll = useCallback(
    (values: Record<string, string | number | null | undefined>): boolean => {
      setFieldValues(values);
      let allValid = true;

      Object.keys(rules).forEach((field) => {
        const isValid = validateField(field, values[field]);
        if (!isValid) {
          allValid = false;
        }
        // Mark field as touched
        setTouchedFields((prev) => new Set(prev).add(field));
      });

      return allValid;
    },
    [rules, validateField]
  );

  // Handle field change
  const handleFieldChange = useCallback(
    (field: string) => (value: string) => {
      setFieldValues((prev) => ({ ...prev, [field]: value }));

      // Validate on change if enabled and field has been touched (or always if validateOnMount)
      if (validateOnChange && (touchedFields.has(field) || validateOnMount)) {
        validateField(field, value);
      }
    },
    [validateOnChange, validateOnMount, touchedFields, validateField]
  );

  // Handle field blur
  const handleFieldBlur = useCallback(
    (field: string) => (_e: any) => {
      // Mark field as touched
      setTouchedFields((prev) => new Set(prev).add(field));

      // Validate on blur if enabled
      if (validateOnBlur) {
        const value = fieldValues[field];
        validateField(field, value);
      }
    },
    [validateOnBlur, validateField, fieldValues]
  );

  // Set error for a specific field
  const setError = useCallback((field: string, error: string | undefined) => {
    setErrorsState((prev) => {
      if (error) {
        return { ...prev, [field]: error };
      } else {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      }
    });
  }, []);

  // Set multiple errors
  const setErrors = useCallback((newErrors: ValidationErrors) => {
    setErrorsState(newErrors);
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrorsState({});
  }, []);

  // Clear error for a specific field
  const clearError = useCallback((field: string) => {
    setErrorsState((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // Calculate if form is valid
  const isValid = Object.keys(errors).length === 0;

  return {
    errors,
    setError,
    setErrors,
    clearErrors,
    clearError,
    validateField,
    validateAll,
    handleFieldChange,
    handleFieldBlur,
    isValid,
  };
}

