import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { stripe } from '../../lib/stripe';
import { authenticate, requireRider } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { attachPaymentMethodValidation } from '../../middleware/validators/paymentValidators';
import { paymentRateLimiter } from '../../middleware/rateLimiter';
import { retryPayment, getPaymentStatus } from '../../services/paymentService';

const router = express.Router();

/**
 * POST /api/rider/payment/retry
 * Retry a failed payment with a new payment method
 * Body: { bookingId, paymentMethodId }
 * Note: riderId is obtained from JWT token (authenticated user)
 * Security: Rate limited to prevent payment retry abuse
 */
router.post('/retry', paymentRateLimiter, authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    // Get rider ID from JWT token (already verified by middleware)
    const riderId = req.user!.userId;
    const { bookingId, paymentMethodId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'Payment method ID is required',
      });
    }

    // Validate payment method ID format
    if (!paymentMethodId.startsWith('pm_') || paymentMethodId.length < 27) {
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

    // Verify booking belongs to this rider
    const booking = await prisma.bookings.findUnique({
      where: { id: parseInt(bookingId) },
      select: {
        id: true,
        riderId: true,
        paymentStatus: true,
        paymentIntentId: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.riderId !== riderId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to retry payment for this booking',
      });
    }

    // Check if payment retry is needed
    if (booking.paymentStatus !== 'failed' && booking.paymentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Payment retry is not needed. Current payment status: ${booking.paymentStatus}`,
      });
    }

    // Retry payment
    const result = await retryPayment(parseInt(bookingId), paymentMethodId);

    return res.json({
      success: true,
      message: result.message,
      paymentIntentId: result.paymentIntentId,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error retrying payment:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * GET /api/rider/payment/payment-methods
 * Get all saved payment methods for the rider
 * Note: riderId is obtained from JWT token (authenticated user)
 */
router.get('/payment-methods', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    // Get rider ID from JWT token (already verified by middleware)
    const riderId = req.user!.userId;

    if (!stripe) {
      return res.json({
        success: true,
        paymentMethods: [],
        message: 'Payment processing is not configured',
      });
    }

    // Get rider's Stripe customer ID
    const user = await prisma.users.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        email: true,
        fullName: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    // If no Stripe customer ID, return empty array
    if (!user.stripeCustomerId) {
      return res.json({
        success: true,
        paymentMethods: [],
        message: 'No payment methods found',
      });
    }

    try {
      // Get all payment methods for this customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
      });

      // Get customer to check default payment method
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      const defaultPaymentMethodId = typeof customer === 'object' && !customer.deleted
        ? customer.invoice_settings?.default_payment_method
        : null;

      // Format payment methods for frontend
      const formattedPaymentMethods = paymentMethods.data.map((pm) => {
        const isDefault = pm.id === defaultPaymentMethodId || paymentMethods.data.length === 1;
        const card = pm.card;

        return {
          id: pm.id,
          type: 'card' as const,
          last4: card?.last4 || '0000',
          brand: card?.brand || 'unknown',
          isDefault,
          card: {
            brand: card?.brand || 'unknown',
            last4: card?.last4 || '0000',
            expMonth: card?.exp_month || null,
            expYear: card?.exp_year || null,
          },
        };
      });

      return res.json({
        success: true,
        paymentMethods: formattedPaymentMethods,
        message: formattedPaymentMethods.length > 0 
          ? `${formattedPaymentMethods.length} payment method${formattedPaymentMethods.length !== 1 ? 's' : ''} found`
          : 'No payment methods found',
      });
    } catch (stripeError: any) {
      console.error('❌ Error fetching payment methods from Stripe:', stripeError);
      
      // If customer doesn't exist in Stripe, return empty array
      if (stripeError.code === 'resource_missing') {
        // Clear invalid customer ID from database
        await prisma.users.update({
          where: { id: riderId },
          data: { stripeCustomerId: null },
        });

        return res.json({
          success: true,
          paymentMethods: [],
          message: 'No payment methods found',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment methods',
        error: stripeError.message,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error getting payment methods:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * POST /api/rider/payment/attach-payment-method
 * Attach a payment method to the rider's Stripe customer
 * Body: { paymentMethodId, paymentMethodType }
 * Note: riderId is obtained from JWT token (authenticated user)
 * Security: Rate limited to prevent abuse
 */
router.post('/attach-payment-method', paymentRateLimiter, authenticate, requireRider, validate(attachPaymentMethodValidation), async (req: Request, res: Response) => {
  try {
    // Get rider ID from JWT token (already verified by middleware)
    const riderId = req.user!.userId;
    const { paymentMethodId, paymentMethodType = 'card' } = req.body;

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured',
      });
    }

    // Get or create Stripe customer for this rider
    const user = await prisma.users.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        email: true,
        fullName: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    let stripeCustomerId = user.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.fullName,
          metadata: {
            userId: String(user.id),
            userType: 'rider',
          },
        });

        stripeCustomerId = customer.id;

        // Save Stripe customer ID to database
        await prisma.users.update({
          where: { id: riderId },
          data: { stripeCustomerId: customer.id },
        });
      } catch (stripeError: any) {
        console.error('❌ Error creating Stripe customer:', stripeError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create payment account. Please try again.',
          error: stripeError.message,
        });
      }
    }

    // Attach payment method to customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Set as default payment method if it's the first one
      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: paymentMethodType,
      });

      if (paymentMethods.data.length === 1) {
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      return res.json({
        success: true,
        message: 'Payment method attached successfully',
        paymentMethodId,
        customerId: stripeCustomerId,
      });
    } catch (stripeError: any) {
      console.error('❌ Error attaching payment method:', stripeError);
      
      // Handle specific Stripe errors
      if (stripeError.code === 'resource_already_exists') {
        return res.status(409).json({
          success: false,
          message: 'This payment method is already attached to your account',
        });
      }

      if (stripeError.code === 'resource_missing') {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found. Please try adding the card again.',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to attach payment method. Please try again.',
        error: stripeError.message,
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
 * DELETE /api/rider/payment/payment-methods/:paymentMethodId
 * Delete a saved payment method
 * Note: riderId is obtained from JWT token (authenticated user)
 */
router.delete('/payment-methods/:paymentMethodId', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    // Get rider ID from JWT token (already verified by middleware)
    const riderId = req.user!.userId;
    const { paymentMethodId } = req.params;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'Payment method ID is required',
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment processing is not configured',
      });
    }

    // Get rider's Stripe customer ID
    const user = await prisma.users.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found',
      });
    }

    if (!user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: 'No payment methods found for this account',
      });
    }

    try {
      // Verify the payment method belongs to this customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      if (paymentMethod.customer !== user.stripeCustomerId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this payment method',
        });
      }

      // Detach payment method from customer (this doesn't delete it, just removes the association)
      await stripe.paymentMethods.detach(paymentMethodId);

      return res.json({
        success: true,
        message: 'Payment method deleted successfully',
      });
    } catch (stripeError: any) {
      console.error('❌ Error deleting payment method:', stripeError);
      
      if (stripeError.code === 'resource_missing') {
        return res.status(404).json({
          success: false,
          message: 'Payment method not found',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to delete payment method. Please try again.',
        error: stripeError.message,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error deleting payment method:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * GET /api/rider/payment/status/:bookingId
 * Get payment status for a booking
 * Note: riderId is obtained from JWT token (authenticated user)
 */
router.get('/status/:bookingId', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    // Get rider ID from JWT token (already verified by middleware)
    const riderId = req.user!.userId;
    
    // Validate bookingId parameter
    const bookingIdParam = req.params.bookingId;
    if (!bookingIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
      });
    }
    
    const bookingId = parseInt(bookingIdParam);
    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
      });
    }

    // Verify booking belongs to this rider
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        riderId: true,
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking.riderId !== riderId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view payment status for this booking',
      });
    }

    // Get payment status
    const paymentStatus = await getPaymentStatus(bookingId);

    return res.json({
      success: true,
      paymentStatus,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error getting payment status:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});


export default router;
