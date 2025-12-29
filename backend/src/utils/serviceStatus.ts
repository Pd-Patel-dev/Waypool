/**
 * Service Status Check Utilities
 * Provides status checks for various services (Stripe, Gmail, etc.)
 */

import { stripe } from '../lib/stripe';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  details?: Record<string, any>;
}

/**
 * Check Stripe service status
 */
export async function checkStripeStatus(): Promise<ServiceStatus> {
  try {
    if (!stripe) {
      return {
        name: 'Stripe',
        status: 'down',
        message: 'Stripe is not configured',
        details: {
          configured: false,
        },
      };
    }

    // Try to retrieve balance (lightweight check that validates API key)
    try {
      await stripe.balance.retrieve();
      return {
        name: 'Stripe',
        status: 'healthy',
        message: 'Stripe API is accessible',
        details: {
          configured: true,
          connected: true,
        },
      };
    } catch (error: any) {
      // If it's an auth error, Stripe is configured but credentials are invalid
      if (error?.code === 'api_key_expired' || error?.code === 'authentication_required') {
        return {
          name: 'Stripe',
          status: 'degraded',
          message: 'Stripe API key is invalid or expired',
          details: {
            configured: true,
            connected: false,
            error: error.message,
          },
        };
      }
      throw error;
    }
  } catch (error: any) {
    return {
      name: 'Stripe',
      status: 'down',
      message: `Stripe check failed: ${error.message || 'Unknown error'}`,
      details: {
        configured: !!stripe,
        error: error.message,
      },
    };
  }
}

/**
 * Check Gmail API service status
 */
export async function checkGmailStatus(): Promise<ServiceStatus> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    return {
      name: 'Gmail API',
      status: 'down',
      message: 'Gmail API is not configured',
      details: {
        configured: false,
        missing: [
          !clientId && 'GMAIL_CLIENT_ID',
          !clientSecret && 'GMAIL_CLIENT_SECRET',
          !refreshToken && 'GMAIL_REFRESH_TOKEN',
          !senderEmail && 'GMAIL_SENDER_EMAIL',
        ].filter(Boolean),
      },
    };
  }

  // Basic validation - actual connection test would require OAuth token refresh
  // which is expensive, so we just check if credentials are present
  return {
    name: 'Gmail API',
    status: 'healthy',
    message: 'Gmail API credentials are configured',
    details: {
      configured: true,
      senderEmail: senderEmail,
    },
  };
}

/**
 * Check Expo Push Notification service status
 */
export async function checkExpoStatus(): Promise<ServiceStatus> {
  const expoToken = process.env.EXPO_ACCESS_TOKEN;

  if (!expoToken) {
    return {
      name: 'Expo Push Notifications',
      status: 'degraded',
      message: 'Expo access token not configured (push notifications may have rate limits)',
      details: {
        configured: false,
      },
    };
  }

  return {
    name: 'Expo Push Notifications',
    status: 'healthy',
    message: 'Expo access token is configured',
    details: {
      configured: true,
    },
  };
}

/**
 * Check all service statuses
 */
export async function checkAllServices(): Promise<ServiceStatus[]> {
  const [stripeStatus, gmailStatus, expoStatus] = await Promise.all([
    checkStripeStatus(),
    checkGmailStatus(),
    checkExpoStatus(),
  ]);

  return [stripeStatus, gmailStatus, expoStatus];
}

