/**
 * Stripe Webhook Handler for Payouts
 * Handles Stripe webhook events related to payouts
 */

import express, { Request, Response } from 'express';
import { stripe } from '../../lib/stripe';
import { updatePayoutStatus } from '../../services/weeklyPayoutService';
import { sendSuccess, sendInternalError } from '../../utils/apiResponse';

const router = express.Router();

/**
 * POST /api/driver/payouts/webhook
 * Handle Stripe webhook events for payouts
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig || !stripe) {
    return res.status(400).send('Missing stripe-signature header or Stripe not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  const eventType = event.type as string;
  
  if (eventType === 'transfer.paid') {
    const transferPaid = event.data.object as any;
    await updatePayoutStatus(transferPaid.id, 'paid');
  } else if (eventType === 'transfer.failed') {
    const transferFailed = event.data.object as any;
    await updatePayoutStatus(
      transferFailed.id,
      'failed',
      transferFailed.failure_code,
      transferFailed.failure_message
    );
  } else if (eventType === 'transfer.canceled') {
    const transferCanceled = event.data.object as any;
    await updatePayoutStatus(transferCanceled.id, 'canceled');
  } else if (eventType === 'account.updated') {
    // Update driver's Stripe account status
    const account = event.data.object as any;
    // You can add logic here to update the driver's account status in the database
  } else {
    console.log(`Unhandled event type: ${eventType}`);
  }

  return sendSuccess(res, 'Webhook received');
});

export default router;

