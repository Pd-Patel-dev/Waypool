import Stripe from 'stripe';

// Initialize Stripe with secret key from environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables. Payment features will not work.');
} else {
  // Validate key format
  if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
    console.error('❌ Invalid Stripe secret key format. Keys should start with "sk_test_" (test) or "sk_live_" (production).');
    console.error('   Current key starts with:', stripeSecretKey.substring(0, 5) + '...');
    console.error('   Please check your STRIPE_SECRET_KEY in the .env file.');
  }
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover', // Stripe API version - use latest stable
    })
  : null;

export default stripe;

