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
  
  // Handle payout events (these are the actual payouts to bank accounts)
  if (eventType === 'payout.paid') {
    const payout = event.data.object as any;
    await updatePayoutStatus(payout.id, 'paid');
  } else if (eventType === 'payout.failed') {
    const payout = event.data.object as any;
    await updatePayoutStatus(
      payout.id,
      'failed',
      payout.failure_code,
      payout.failure_message
    );
  } else if (eventType === 'payout.canceled') {
    const payout = event.data.object as any;
    await updatePayoutStatus(payout.id, 'canceled');
  } else if (eventType === 'payout.pending') {
    const payout = event.data.object as any;
    await updatePayoutStatus(payout.id, 'pending');
  } else if (eventType === 'payout.updated') {
    const payout = event.data.object as any;
    // Update status based on current payout status
    await updatePayoutStatus(
      payout.id,
      payout.status,
      payout.failure_code,
      payout.failure_message
    );
  } else if (eventType === 'account.updated') {
    // Update driver's Stripe account status when account is updated
    const account = event.data.object as any;
    try {
      const { prisma } = await import('../../lib/prisma');
      
      // Find driver by Stripe account ID
      const driver = await prisma.users.findUnique({
        where: { stripeAccountId: account.id },
        select: { id: true },
      });

      if (driver) {
        // Get external accounts (bank accounts)
        const externalAccounts = await stripe.accounts.listExternalAccounts(
          account.id,
          { object: 'bank_account', limit: 1 }
        );
        
        const bankAccount = externalAccounts.data[0] as any;

        // Update driver's account status and bank account info
        await prisma.users.update({
          where: { id: driver.id },
          data: {
            stripeAccountStatus: account.details_submitted ? 'enabled' : 'pending',
            payoutsEnabled: account.payouts_enabled || false,
            ...(bankAccount && {
              bankAccountId: bankAccount.id,
              bankAccountLast4: bankAccount.last4,
              bankAccountType: bankAccount.account_type,
              bankAccountStatus: bankAccount.status,
            }),
          },
        });

        console.log(`✅ Updated Stripe account status for driver ${driver.id}: payouts_enabled=${account.payouts_enabled}`);
      }
    } catch (error) {
      console.error('Error updating account status from webhook:', error);
    }
  } else {
    console.log(`Unhandled event type: ${eventType}`);
  }

  return sendSuccess(res, 'Webhook received');
});

export default router;

