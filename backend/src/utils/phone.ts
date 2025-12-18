/**
 * Phone number utilities for formatting to E.164 format (required by Stripe)
 */

/**
 * Checks if a phone number looks like a test/placeholder number
 * Stripe rejects common test numbers like "1234567890"
 */
function isTestPhoneNumber(phoneNumber: string): boolean {
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Common test/placeholder patterns
  const testPatterns = [
    /^1234567890/,      // 1234567890
    /^1111111111/,      // 1111111111
    /^0000000000/,      // 0000000000
    /^123456789/,       // 123456789
    /^12345/,           // 12345
    /^(\d)\1{9,}$/,     // All same digits (e.g., 1111111111)
    /^123/,             // Starts with 123
  ];
  
  return testPatterns.some(pattern => pattern.test(digitsOnly));
}

/**
 * Formats a phone number to E.164 format
 * E.164 format: +[country code][number] (e.g., +1234567890)
 * 
 * @param phoneNumber - The phone number to format (can be in various formats)
 * @param defaultCountryCode - Default country code if not present (default: '1' for US)
 * @returns Formatted phone number in E.164 format, or null if invalid or test number
 */
export function formatPhoneToE164(
  phoneNumber: string | null | undefined,
  defaultCountryCode: string = '1'
): string | null {
  if (!phoneNumber) {
    return null;
  }

  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // If empty after removing non-digits, return null
  if (!digitsOnly) {
    return null;
  }

  // Check if it's a test/placeholder number - Stripe will reject these
  if (isTestPhoneNumber(phoneNumber)) {
    return null; // Return null so we skip adding it to Stripe
  }

  // If already starts with country code (e.g., "1" for US), use it
  // Otherwise, prepend the default country code
  let formatted: string;
  
  if (digitsOnly.startsWith(defaultCountryCode) && digitsOnly.length === 11) {
    // Already has country code
    formatted = `+${digitsOnly}`;
  } else if (digitsOnly.length === 10) {
    // US phone number without country code, add it
    formatted = `+${defaultCountryCode}${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // Already has US country code
    formatted = `+${digitsOnly}`;
  } else if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    // Valid length for international numbers
    formatted = `+${digitsOnly}`;
  } else {
    // Invalid length
    return null;
  }

  return formatted;
}

/**
 * Validates if a phone number is in a valid format for Stripe
 * Stripe requires E.164 format
 * 
 * @param phoneNumber - The phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidE164Phone(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) {
    return false;
  }

  // E.164 format: starts with +, followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

