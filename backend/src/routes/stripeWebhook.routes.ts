/**
 * Stripe Webhook Routes
 * Handles Stripe webhook events for Connect Custom accounts
 * IMPORTANT: This endpoint must use raw body parsing (not JSON)
 */

import express, { Request, Response } from "express";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";
import { retrieveConnectStatus } from "../services/stripeConnectCustom.service";

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events
 *
 * NOTE: This route must be mounted BEFORE express.json() middleware
 * to receive raw body for signature verification
 */
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Security: Verify all required components are present
    if (!sig) {
      console.error("❌ Webhook signature missing");
      return res.status(400).send("Webhook signature missing");
    }

    if (!webhookSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET environment variable not set");
      return res.status(500).send("Webhook secret not configured");
    }

    if (!stripe) {
      console.error("❌ Stripe client not initialized");
      return res.status(500).send("Stripe client not configured");
    }

    // Security: Verify request body exists
    if (!req.body || req.body.length === 0) {
      console.error("❌ Webhook request body is empty", {
        timestamp: new Date().toISOString(),
        ip: req.ip || req.socket.remoteAddress,
      });
      return res.status(400).send("Webhook request body is empty");
    }
    
    // Security: Validate body size (Stripe webhooks are typically < 100KB)
    const MAX_WEBHOOK_BODY_SIZE = 100 * 1024; // 100KB
    if (req.body.length > MAX_WEBHOOK_BODY_SIZE) {
      console.error("❌ Webhook request body too large", {
        size: req.body.length,
        maxSize: MAX_WEBHOOK_BODY_SIZE,
        timestamp: new Date().toISOString(),
        ip: req.ip || req.socket.remoteAddress,
      });
      return res.status(400).send("Webhook request body too large");
    }

    let event;

    try {
      // Verify webhook signature using Stripe's recommended method
      // This validates that the request came from Stripe and hasn't been tampered with
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      
      // Security: Validate event structure
      if (!event.id || !event.type || !event.data) {
        console.error("❌ Invalid webhook event structure", {
          eventId: event.id,
          eventType: event.type,
          timestamp: new Date().toISOString(),
        });
        return res.status(400).send("Invalid webhook event structure");
      }
      
      // Log successful verification (without sensitive data)
      console.log(`✅ Webhook signature verified for event: ${event.type} (ID: ${event.id})`, {
        timestamp: new Date().toISOString(),
        livemode: event.livemode,
      });
    } catch (err: any) {
      // Security: Log failed verification attempts (potential security issue)
      console.error("❌ Webhook signature verification failed:", {
        error: err.message,
        type: err.type,
        // Don't log the signature itself for security
      });
      
      // Return generic error to prevent information leakage
      return res.status(400).send(`Webhook Error: Signature verification failed`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case "account.updated":
          await handleAccountUpdated(event.data.object as any);
          break;

        case "capability.updated":
          await handleCapabilityUpdated(event.data.object as any);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Return a response to acknowledge receipt of the event
      res.json({ received: true });
    } catch (error: any) {
      console.error("Error handling webhook event:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);

/**
 * Handle account.updated event
 */
async function handleAccountUpdated(account: any) {
  try {
    const accountId = account.id;

    // Find user by stripeAccountId
    const user = await prisma.users.findUnique({
      where: { stripeAccountId: accountId },
      select: { id: true },
    });

    if (!user) {
      console.log(`No user found for Stripe account: ${accountId}`);
      return;
    }

    // Get updated requirements
    const requirements = account.requirements || {};
    const currentlyDue = (requirements.currently_due || []) as string[];
    const eventuallyDue = (requirements.eventually_due || []) as string[];
    const pastDue = (requirements.past_due || []) as string[];
    const disabledReason = requirements.disabled_reason || null;

    // Determine onboarding status
    let onboardingStatus = "pending";
    if (account.payouts_enabled && account.charges_enabled) {
      onboardingStatus = "verified";
    } else if (disabledReason) {
      onboardingStatus = "restricted";
    }

    // Update user record
    await prisma.users.update({
      where: { id: user.id },
      data: {
        stripeOnboardingStatus: onboardingStatus,
        stripeAccountStatus: account.payouts_enabled ? "enabled" : "pending",
        payoutsEnabled: account.payouts_enabled || false,
        stripeRequirementsDue: {
          currentlyDue,
          eventuallyDue,
          pastDue,
          disabledReason,
        },
      },
    });

    console.log(`✅ Updated user ${user.id} from account.updated webhook`);
  } catch (error) {
    console.error("Error handling account.updated:", error);
    throw error;
  }
}

/**
 * Handle capability.updated event
 */
async function handleCapabilityUpdated(capability: any) {
  try {
    const accountId = capability.account;

    // Find user by stripeAccountId
    const user = await prisma.users.findUnique({
      where: { stripeAccountId: accountId },
      select: { id: true },
    });

    if (!user) {
      console.log(`No user found for Stripe account: ${accountId}`);
      return;
    }

    // Refresh status to get latest requirements
    const status = await retrieveConnectStatus(user.id);

    console.log(`✅ Updated user ${user.id} from capability.updated webhook`);
  } catch (error) {
    console.error("Error handling capability.updated:", error);
    throw error;
  }
}

/**
 * Handle payment_intent.succeeded event
 * Payment was successfully captured
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  try {
    const paymentIntentId = paymentIntent.id;
    const bookingId = paymentIntent.metadata?.bookingId;

    // Find booking by payment intent ID
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
      include: { rides: true },
    });

    if (!booking) {
      console.log(`No booking found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Update booking payment status
    await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'captured',
        paymentAmount: paymentIntent.amount / 100, // Convert cents to dollars
        paymentCurrency: paymentIntent.currency || 'usd',
      },
    });

    console.log(`✅ Payment captured for booking ${booking.id} (PaymentIntent: ${paymentIntentId})`);
  } catch (error) {
    console.error("Error handling payment_intent.succeeded:", error);
    throw error;
  }
}

/**
 * Handle payment_intent.payment_failed event
 * Payment authorization or capture failed
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  try {
    const paymentIntentId = paymentIntent.id;

    // Find booking by payment intent ID
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (!booking) {
      console.log(`No booking found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Update booking payment status
    await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'failed',
      },
    });

    console.log(`❌ Payment failed for booking ${booking.id} (PaymentIntent: ${paymentIntentId})`);
  } catch (error) {
    console.error("Error handling payment_intent.payment_failed:", error);
    throw error;
  }
}

/**
 * Handle payment_intent.canceled event
 * Payment intent was canceled
 */
async function handlePaymentIntentCanceled(paymentIntent: any) {
  try {
    const paymentIntentId = paymentIntent.id;

    // Find booking by payment intent ID
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (!booking) {
      console.log(`No booking found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Update booking payment status
    await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'failed',
      },
    });

    console.log(`⚠️ Payment canceled for booking ${booking.id} (PaymentIntent: ${paymentIntentId})`);
  } catch (error) {
    console.error("Error handling payment_intent.canceled:", error);
    throw error;
  }
}

/**
 * Handle payment_intent.amount_capturable_updated event
 * Payment was authorized and is ready to be captured
 */
async function handlePaymentIntentAmountCapturableUpdated(paymentIntent: any) {
  try {
    const paymentIntentId = paymentIntent.id;

    // Find booking by payment intent ID
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (!booking) {
      console.log(`No booking found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Update booking payment status to authorized
    await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'authorized',
      },
    });

    console.log(`✅ Payment authorized for booking ${booking.id} (PaymentIntent: ${paymentIntentId})`);
  } catch (error) {
    console.error("Error handling payment_intent.amount_capturable_updated:", error);
    throw error;
  }
}

/**
 * Handle charge.refunded event
 * Full or partial refund was processed
 */
async function handleChargeRefunded(charge: any) {
  try {
    const paymentIntentId = charge.payment_intent;

    if (!paymentIntentId) {
      console.log(`No payment intent ID in charge: ${charge.id}`);
      return;
    }

    // Find booking by payment intent ID
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (!booking) {
      console.log(`No booking found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Get refund amount (in cents, convert to dollars)
    const refundAmount = charge.amount_refunded / 100;
    const originalAmount = charge.amount / 100;
    const isFullRefund = refundAmount >= originalAmount;

    // Update booking payment status
    await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
        refundAmount,
        refundedAt: new Date(),
      },
    });

    console.log(`✅ Refund processed for booking ${booking.id}: $${refundAmount} (PaymentIntent: ${paymentIntentId})`);
  } catch (error) {
    console.error("Error handling charge.refunded:", error);
    throw error;
  }
}

/**
 * Handle refund.created event
 * Refund was created (may still be pending)
 */
async function handleRefundCreated(refund: any) {
  try {
    const chargeId = refund.charge;
    const paymentIntentId = refund.payment_intent;

    if (!paymentIntentId) {
      console.log(`No payment intent ID in refund: ${refund.id}`);
      return;
    }

    // Find booking by payment intent ID
    const booking = await prisma.bookings.findFirst({
      where: { paymentIntentId },
    });

    if (!booking) {
      console.log(`No booking found for payment intent: ${paymentIntentId}`);
      return;
    }

    // Get refund amount (in cents, convert to dollars)
    const refundAmount = refund.amount / 100;
    const originalAmount = refund.payment_intent_object?.amount / 100 || booking.paymentAmount || 0;
    const isFullRefund = refundAmount >= originalAmount;

    // Update booking payment status
    await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
        refundAmount,
        refundedAt: new Date(),
      },
    });

    console.log(`✅ Refund created for booking ${booking.id}: $${refundAmount} (Refund: ${refund.id})`);
  } catch (error) {
    console.error("Error handling refund.created:", error);
    throw error;
  }
}

export default router;
