/**
 * Payment Service
 * Handles payment operations: capture, refund, retry
 */

import { stripe } from '../lib/stripe';
import { prisma } from '../lib/prisma';

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount: number;
  currency: string;
  message: string;
}

export interface CaptureResult {
  success: boolean;
  paymentIntentId: string;
  amount: number;
  currency: string;
  message: string;
}

/**
 * Capture a payment intent (convert authorization to actual charge)
 */
export async function capturePaymentIntent(
  paymentIntentId: string,
  amountToCapture?: number
): Promise<CaptureResult> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Retrieve the payment intent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        paymentIntentId,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        message: 'Payment already captured',
      };
    }

    if (paymentIntent.status !== 'requires_capture') {
      throw new Error(`Payment intent is in ${paymentIntent.status} status and cannot be captured`);
    }

    // Capture the payment intent
    const capturedIntent = await stripe.paymentIntents.capture(
      paymentIntentId,
      amountToCapture ? { amount_to_capture: Math.round(amountToCapture * 100) } : undefined
    );

    // Update booking payment status
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (booking) {
      await prisma.bookings.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'captured',
          paymentAmount: capturedIntent.amount / 100,
          paymentCurrency: capturedIntent.currency || 'usd',
        },
      });
    }

    return {
      success: true,
      paymentIntentId: capturedIntent.id,
      amount: capturedIntent.amount / 100,
      currency: capturedIntent.currency,
      message: 'Payment captured successfully',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to capture payment';
    console.error('Error capturing payment intent:', error);
    throw new Error(errorMessage);
  }
}

/**
 * Refund a payment (full or partial)
 */
export async function refundPayment(
  paymentIntentId: string,
  amount?: number,
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' = 'requested_by_customer'
): Promise<RefundResult> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Retrieve the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Get the charge ID from the payment intent
    // In Stripe API, we need to list charges for the payment intent
    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });

    if (!charges.data || charges.data.length === 0) {
      throw new Error('No charge found for this payment intent');
    }

    const firstCharge = charges.data[0];
    if (!firstCharge || !firstCharge.id) {
      throw new Error('Invalid charge data for this payment intent');
    }

    const chargeId = firstCharge.id;
    const refundAmount = amount ? Math.round(amount * 100) : undefined; // Convert to cents

    // Create refund - only include amount if specified (for partial refunds)
    const refundParams: any = {
      charge: chargeId,
      reason,
      metadata: {
        paymentIntentId,
        bookingId: paymentIntent.metadata?.bookingId || 'unknown',
      },
    };

    // Only include amount if specified (for partial refunds)
    // If not specified, Stripe will refund the full amount
    if (refundAmount !== undefined) {
      refundParams.amount = refundAmount;
    }

    const refund = await stripe.refunds.create(refundParams);

    // Update booking payment status
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (booking) {
      const refundAmountDollars = refund.amount / 100;
      const originalAmount = booking.paymentAmount || paymentIntent.amount / 100;
      const isFullRefund = refundAmountDollars >= originalAmount;

      await prisma.bookings.update({
        where: { id: booking.id },
        data: {
          paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
          refundAmount: refundAmountDollars,
          refundedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100,
      currency: refund.currency,
      message: 'Refund processed successfully',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to process refund';
    console.error('Error processing refund:', error);
    throw new Error(errorMessage);
  }
}

/**
 * Cancel a payment intent (release authorization without charging)
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<{ success: boolean; message: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Retrieve the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'canceled') {
      return {
        success: true,
        message: 'Payment intent already canceled',
      };
    }

    if (paymentIntent.status === 'succeeded') {
      throw new Error('Cannot cancel a payment that has already been captured');
    }

    // Cancel the payment intent
    await stripe.paymentIntents.cancel(paymentIntentId);

    // Update booking payment status
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (booking) {
      await prisma.bookings.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'failed',
        },
      });
    }

    return {
      success: true,
      message: 'Payment intent canceled successfully',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel payment intent';
    console.error('Error canceling payment intent:', error);
    throw new Error(errorMessage);
  }
}

/**
 * Retry a failed payment with a new payment method
 */
export async function retryPayment(
  bookingId: number,
  newPaymentMethodId: string
): Promise<{ success: boolean; paymentIntentId: string; message: string }> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  try {
    // Get booking details
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            fullName: true,
            stripeCustomerId: true,
          },
        },
        rides: {
          select: {
            id: true,
            pricePerSeat: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (!booking.paymentIntentId) {
      throw new Error('No payment intent found for this booking');
    }

    // Calculate total amount
    const subtotal = booking.numberOfSeats * booking.pricePerSeat;
    const totalAmount = Math.round(subtotal * 100); // Convert to cents

    // Get or create Stripe customer
    let stripeCustomerId = booking.users.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: booking.users.email,
        name: booking.users.fullName,
        metadata: {
          riderId: booking.riderId.toString(),
        },
      });
      stripeCustomerId = customer.id;

      // Store customer ID
      await prisma.users.update({
        where: { id: booking.riderId },
        data: { stripeCustomerId: customer.id },
      });
    }

    // Create new payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: newPaymentMethodId,
      payment_method_types: ['card'],
      capture_method: 'manual',
      confirmation_method: 'manual',
      confirm: true,
      metadata: {
        bookingId: bookingId.toString(),
        rideId: booking.rideId.toString(),
        riderId: booking.riderId.toString(),
        numberOfSeats: booking.numberOfSeats.toString(),
        isRetry: 'true',
        originalPaymentIntentId: booking.paymentIntentId,
      },
    });

    // Determine payment status
    let paymentStatus = 'pending';
    if (paymentIntent.status === 'requires_capture') {
      paymentStatus = 'authorized';
    } else if (paymentIntent.status === 'succeeded') {
      paymentStatus = 'captured';
    } else if (paymentIntent.status === 'canceled') {
      paymentStatus = 'failed';
    } else if (paymentIntent.status === 'requires_payment_method' || 
               paymentIntent.status === 'requires_confirmation' ||
               paymentIntent.status === 'requires_action' ||
               paymentIntent.status === 'processing') {
      paymentStatus = 'failed';
    }

    // Update booking with new payment intent
    await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        paymentIntentId: paymentIntent.id,
        paymentStatus,
        paymentAmount: totalAmount / 100,
        paymentCurrency: 'usd',
      },
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      message: 'Payment retry initiated successfully',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retry payment';
    console.error('Error retrying payment:', error);
    throw new Error(errorMessage);
  }
}

/**
 * Get payment status for a booking
 */
export async function getPaymentStatus(bookingId: number): Promise<{
  paymentIntentId: string | null;
  paymentStatus: string | null;
  paymentAmount: number | null;
  refundAmount: number | null;
  refundedAt: Date | null;
}> {
  const booking = await prisma.bookings.findUnique({
    where: { id: bookingId },
    select: {
      paymentIntentId: true,
      paymentStatus: true,
      paymentAmount: true,
      refundAmount: true,
      refundedAt: true,
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  return {
    paymentIntentId: booking.paymentIntentId,
    paymentStatus: booking.paymentStatus,
    paymentAmount: booking.paymentAmount,
    refundAmount: booking.refundAmount,
    refundedAt: booking.refundedAt,
  };
}

