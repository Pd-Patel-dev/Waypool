import Stripe from 'stripe';

// Initialize Stripe with secret key from environment variables
// Note: Environment validation is done at startup in index.ts
// This module just initializes Stripe with the validated key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover', // Stripe API version - use latest stable
      timeout: 300000, // 5 minutes timeout for file uploads (default is 80 seconds)
      maxNetworkRetries: 2, // Retry network errors up to 2 times
    })
  : null;

export default stripe;

