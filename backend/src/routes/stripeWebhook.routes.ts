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

    if (!sig || !webhookSecret || !stripe) {
      console.error("Missing webhook signature or secret");
      return res.status(400).send("Webhook signature or secret missing");
    }

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
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
      } as any, // Will be properly typed after migration
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

export default router;
