import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { stripe } from '../../lib/stripe';

const router = express.Router();

/**
 * Helper function to get or create Stripe customer for a rider
 */
async function getOrCreateStripeCustomer(riderId: number, email: string, name: string): Promise<string> {
  // Check if user already has a Stripe customer ID stored
  // For now, we'll create a new customer each time, but you can store stripeCustomerId in users table
  // For production, add stripeCustomerId field to users table
  
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
  }

  // Create or retrieve Stripe customer
  // In production, you should store stripeCustomerId in your database
  // For now, we'll search by email or create new
  try {
    // Try to find existing customer by email
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    const existingCustomer = customers.data[0];
    if (existingCustomer) {
      return existingCustomer.id;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: email,
      name: name,
      metadata: {
        riderId: riderId.toString(),
      },
    });

    return customer.id;
  } catch (error: unknown) {
    console.error('Error creating/retrieving Stripe customer:', error);
    
    // Provide more specific error messages
    if (error && typeof error === 'object' && 'type' in error && error.type === 'StripeAuthenticationError') {
      throw new Error('Invalid Stripe API key. Please check your STRIPE_SECRET_KEY environment variable. It should start with "sk_test_" (test mode) or "sk_live_" (production mode).');
    }
    
    if (error instanceof Error) {
      throw new Error(`Stripe error: ${error.message}`);
    }
    
    throw new Error('Failed to create Stripe customer');
  }
}

/**
 * POST /api/rider/payment/attach-payment-method
 * Attach a payment method (tokenized by frontend) to a Stripe customer
 * Body: { riderId, paymentMethodId, paymentMethodType }
 */
router.post('/attach-payment-method', async (req: Request, res: Response) => {
  try {
    const { riderId, paymentMethodId, paymentMethodType } = req.body;


    // Validation
    if (!riderId || !paymentMethodId) {
      console.error('Missing required fields:', { riderId: !!riderId, paymentMethodId: !!paymentMethodId });
      return res.status(400).json({
        success: false,
        message: 'riderId and paymentMethodId are required',
      });
    }
    
    // Validate paymentMethodId format (should start with pm_)
    if (!paymentMethodId.startsWith('pm_')) {
      console.error('Invalid paymentMethodId format:', paymentMethodId.substring(0, 20));
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method ID format',
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured',
      });
    }

    // Verify rider exists
    const rider = await prisma.users.findUnique({
      where: { id: parseInt(riderId) },
      select: {
        id: true,
        email: true,
        fullName: true,
        isRider: true,
      },
    });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    if (!rider.isRider) {
      return res.status(403).json({
        success: false,
        message: 'User is not a rider',
      });
    }

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      rider.id,
      rider.email,
      rider.fullName
    );

    // Attach payment method to customer
    try {
      // First, verify the payment method exists and is valid
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      
      // Check if payment method is already attached to a customer
      if (paymentMethod.customer) {
        if (paymentMethod.customer === stripeCustomerId) {
          // Already attached to this customer
          return res.json({
            success: true,
            message: 'Payment method already saved',
            paymentMethodId: paymentMethodId,
          });
        } else {
          // Attached to different customer - detach first
          await stripe.paymentMethods.detach(paymentMethodId);
        }
      }
      
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Optionally set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });


      return res.json({
        success: true,
        message: 'Payment method saved successfully',
        paymentMethodId: paymentMethodId,
      });
    } catch (stripeError: unknown) {
      const errorObj = stripeError && typeof stripeError === 'object' ? stripeError : {};
      const errorCode = 'code' in errorObj && typeof errorObj.code === 'string' ? errorObj.code : undefined;
      const errorMessage = 'message' in errorObj && typeof errorObj.message === 'string' ? errorObj.message : 'Unknown error';
      const errorType = 'type' in errorObj && typeof errorObj.type === 'string' ? errorObj.type : undefined;
      const statusCode = 'statusCode' in errorObj && typeof errorObj.statusCode === 'number' ? errorObj.statusCode : undefined;
      
      console.error('Stripe error attaching payment method:', {
        code: errorCode,
        message: errorMessage,
        type: errorType,
        statusCode,
      });
      
      // Handle specific Stripe errors
      if (errorCode === 'resource_already_exists') {
        return res.status(409).json({
          success: false,
          message: 'This payment method is already saved',
        });
      }
      
      if (errorCode === 'resource_missing') {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found. Please try adding the card again.',
        });
      }

      return res.status(400).json({
        success: false,
        message: errorMessage || 'Failed to save payment method',
        ...(errorCode && { errorCode }),
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error attaching payment method:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * GET /api/rider/payment/payment-methods
 * Get all saved payment methods for a rider
 * Query params: riderId (required)
 */
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const riderId = req.query.riderId ? parseInt(req.query.riderId as string) : null;

    if (!riderId || isNaN(riderId)) {
      return res.status(400).json({
        success: false,
        message: 'riderId is required',
        paymentMethods: [],
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured',
        paymentMethods: [],
      });
    }

    // Verify rider exists
    const rider = await prisma.users.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isRider: true,
      },
    });

    if (!rider || !rider.isRider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
        paymentMethods: [],
      });
    }

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      rider.id,
      rider.email,
      rider.fullName
    );

    // List all payment methods for this customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    // Get customer to find default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    let defaultPaymentMethodId: string | null = null;
    
    if (customer && !('deleted' in customer) && customer.invoice_settings?.default_payment_method) {
      defaultPaymentMethodId = customer.invoice_settings.default_payment_method as string;
    }

    // Format payment methods for response
    const formattedMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type as 'card' | 'applePay' | 'googlePay',
      last4: pm.card?.last4,
      brand: pm.card?.brand,
      isDefault: pm.id === defaultPaymentMethodId,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      } : undefined,
      billingDetails: pm.billing_details ? {
        name: pm.billing_details.name || undefined,
        email: pm.billing_details.email || undefined,
      } : undefined,
    }));

    return res.json({
      success: true,
      paymentMethods: formattedMethods,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching payment methods:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
      paymentMethods: [],
    });
  }
});

/**
 * DELETE /api/rider/payment/payment-methods/:paymentMethodId
 * Delete a saved payment method
 * Query params: riderId (required)
 */
router.delete('/payment-methods/:paymentMethodId', async (req: Request, res: Response) => {
  try {
    const paymentMethodId = req.params.paymentMethodId;
    const riderId = req.query.riderId ? parseInt(req.query.riderId as string) : null;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'Payment method ID is required',
      });
    }

    if (!riderId || isNaN(riderId)) {
      return res.status(400).json({
        success: false,
        message: 'riderId is required',
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured',
      });
    }

    // Verify rider exists
    const rider = await prisma.users.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isRider: true,
      },
    });

    if (!rider || !rider.isRider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    // Verify payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (!paymentMethod.customer) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found',
      });
    }

    // Get or create Stripe customer to verify ownership
    const stripeCustomerId = await getOrCreateStripeCustomer(
      rider.id,
      rider.email,
      rider.fullName
    );

    if (paymentMethod.customer !== stripeCustomerId) {
      return res.status(403).json({
        success: false,
        message: 'Payment method does not belong to this rider',
      });
    }

    // Detach payment method (removes from customer but doesn't delete it)
    await stripe.paymentMethods.detach(paymentMethodId);


    return res.json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error: unknown) {
    const errorObj = error && typeof error === 'object' ? error : {};
    const errorCode = 'code' in errorObj && typeof errorObj.code === 'string' ? errorObj.code : undefined;
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    console.error('Error deleting payment method:', error);
    
    if (errorCode === 'resource_missing') {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found',
      });
    }

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * POST /api/rider/payment/create-setup-intent
 * Create a SetupIntent for saving payment methods (alternative flow using PaymentSheet)
 * Body: { riderId, paymentMethodType, rideId }
 */
router.post('/create-setup-intent', async (req: Request, res: Response) => {
  try {
    const { riderId, paymentMethodType, rideId } = req.body;

    if (!riderId) {
      return res.status(400).json({
        success: false,
        message: 'riderId is required',
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured',
      });
    }

    // Verify rider exists
    const rider = await prisma.users.findUnique({
      where: { id: parseInt(riderId) },
      select: {
        id: true,
        email: true,
        fullName: true,
        isRider: true,
      },
    });

    if (!rider || !rider.isRider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      rider.id,
      rider.email,
      rider.fullName
    );

    // Create SetupIntent (for PaymentSheet flow)
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session', // For future payments
    });

    return res.json({
      success: true,
      setupIntentClientSecret: setupIntent.client_secret,
      paymentMethodId: setupIntent.payment_method as string | undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error creating setup intent:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

export default router;

