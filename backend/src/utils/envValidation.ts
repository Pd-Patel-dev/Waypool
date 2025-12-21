/**
 * Environment Variable Validation Utility
 * Validates critical environment variables at startup to prevent runtime errors
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates Stripe secret key format
 * Stripe keys should start with 'sk_test_' (test) or 'sk_live_' (production)
 */
function validateStripeKey(key: string | undefined): { isValid: boolean; error?: string } {
  if (!key) {
    return { isValid: false, error: 'STRIPE_SECRET_KEY is not set' };
  }

  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
    return {
      isValid: false,
      error: `Invalid Stripe secret key format. Keys should start with "sk_test_" (test) or "sk_live_" (production). Current key starts with: ${key.substring(0, 5)}...`,
    };
  }

  // Additional validation: key should be at least 32 characters (typical Stripe key length)
  if (key.length < 32) {
    return {
      isValid: false,
      error: 'Stripe secret key appears to be too short. Please check your STRIPE_SECRET_KEY.',
    };
  }

  return { isValid: true };
}

/**
 * Validates Expo access token format
 * Expo tokens are typically long alphanumeric strings
 */
function validateExpoToken(token: string | undefined): { isValid: boolean; error?: string; warning?: string } {
  if (!token) {
    // Expo token is optional, so this is just a warning
    return {
      isValid: true,
      warning: 'EXPO_ACCESS_TOKEN is not set. Push notifications may have rate limits without an access token.',
    };
  }

  // Expo tokens are typically long strings (50+ characters)
  if (token.length < 20) {
    return {
      isValid: false,
      error: 'EXPO_ACCESS_TOKEN appears to be too short. Please check your token.',
    };
  }

  // Basic format check: should contain alphanumeric characters and possibly hyphens/underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    return {
      isValid: false,
      error: 'EXPO_ACCESS_TOKEN contains invalid characters. Token should only contain alphanumeric characters, hyphens, and underscores.',
    };
  }

  return { isValid: true };
}

/**
 * Validates database URL format
 */
function validateDatabaseUrl(url: string | undefined): { isValid: boolean; error?: string } {
  if (!url) {
    return { isValid: false, error: 'DATABASE_URL is not set' };
  }

  // Check if it's a valid PostgreSQL connection string
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    return {
      isValid: false,
      error: 'DATABASE_URL should start with "postgresql://" or "postgres://"',
    };
  }

  return { isValid: true };
}

/**
 * Validates PIN encryption secret
 */
function validatePinSecret(secret: string | undefined, isProduction: boolean): { isValid: boolean; error?: string; warning?: string } {
  if (!secret) {
    if (isProduction) {
      return { isValid: false, error: 'PIN_ENCRYPTION_SECRET is required in production' };
    }
    return {
      isValid: true,
      warning: 'PIN_ENCRYPTION_SECRET is not set. Using default (development only).',
    };
  }

  // Secret should be at least 32 characters for security
  if (secret.length < 32) {
    return {
      isValid: false,
      error: 'PIN_ENCRYPTION_SECRET should be at least 32 characters long for security.',
    };
  }

  return { isValid: true };
}

/**
 * Validates all critical environment variables
 * @param options - Validation options
 * @returns Validation result with errors and warnings
 */
export function validateEnvironmentVariables(options: {
  strict?: boolean; // If true, fail on warnings in production
} = {}): ValidationResult {
  const { strict = false } = options;
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Validate DATABASE_URL (critical)
  const dbValidation = validateDatabaseUrl(process.env.DATABASE_URL);
  if (!dbValidation.isValid) {
    errors.push(`Database: ${dbValidation.error}`);
  }

  // Validate STRIPE_SECRET_KEY (required for payments)
  const stripeValidation = validateStripeKey(process.env.STRIPE_SECRET_KEY);
  if (!stripeValidation.isValid) {
    if (isProduction || strict) {
      errors.push(`Stripe: ${stripeValidation.error}`);
    } else {
      warnings.push(`Stripe: ${stripeValidation.error} (Payment features will not work)`);
    }
  }

  // Validate EXPO_ACCESS_TOKEN (optional but recommended)
  const expoValidation = validateExpoToken(process.env.EXPO_ACCESS_TOKEN);
  if (!expoValidation.isValid) {
    errors.push(`Expo: ${expoValidation.error}`);
  } else if (expoValidation.warning) {
    warnings.push(`Expo: ${expoValidation.warning}`);
  }

  // Validate PIN_ENCRYPTION_SECRET (required in production)
  const pinValidation = validatePinSecret(process.env.PIN_ENCRYPTION_SECRET, isProduction);
  if (!pinValidation.isValid) {
    errors.push(`PIN Encryption: ${pinValidation.error}`);
  } else if (pinValidation.warning) {
    warnings.push(`PIN Encryption: ${pinValidation.warning}`);
  }

  // Validate JWT_SECRET (required in production, should be strong)
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProduction || strict) {
      errors.push('JWT_SECRET is required in production');
    } else {
      warnings.push('JWT_SECRET is not set. Using default (INSECURE - development only)');
    }
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET should be at least 32 characters long for security');
  } else if (jwtSecret === 'your-secret-key-change-in-production') {
    warnings.push('JWT_SECRET is using default value. Please change it in production!');
  }

  // Validate Gmail API credentials (optional but recommended for email functionality)
  const gmailClientId = process.env.GMAIL_CLIENT_ID;
  const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
  const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const gmailSenderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken || !gmailSenderEmail) {
    warnings.push('Gmail API credentials not configured. Email sending will be disabled. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_SENDER_EMAIL to enable email notifications.');
  } else {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(gmailSenderEmail)) {
      warnings.push(`GMAIL_SENDER_EMAIL appears to be invalid: ${gmailSenderEmail}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates and logs environment variables at startup
 * Throws error if critical variables are missing in production
 */
export function validateAndLogEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const result = validateEnvironmentVariables({ strict: isProduction });


  if (result.errors.length > 0) {
    console.error('❌ Environment Variable Errors:');
    result.errors.forEach((error) => {
      console.error(`   - ${error}`);
    });
    console.error('');

    if (isProduction) {
      console.error('🚨 CRITICAL: Server cannot start in production with missing/invalid environment variables.');
      console.error('   Please fix the errors above and restart the server.\n');
      process.exit(1);
    } else {
      console.warn('⚠️  WARNING: Some environment variables are missing or invalid.');
      console.warn('   Server will start, but some features may not work correctly.\n');
    }
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Variable Warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
    console.warn('');
  }

  if (result.isValid && result.warnings.length === 0) {
  } else if (result.isValid) {
  }
}

