/**
 * Stripe Connect Embedded Onboarding Routes
 * Handles AccountSession creation and status for embedded onboarding
 */

import express, { Request, Response } from 'express';
import { stripe } from '../../lib/stripe';
import { prisma } from '../../lib/prisma';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendNotFound,
  sendInternalError,
} from '../../utils/apiResponse';
import { getUserIdFromRequest } from '../../middleware/testModeAuth';
import { getValidatedUserId } from '../../utils/testMode';
import { getOrCreateStripeConnectAccount } from '../../utils/stripeConnect';

const router = express.Router();

/**
 * POST /api/driver/connect/account-session
 * Create AccountSession for Stripe Connect embedded onboarding
 */
router.post('/account-session', async (req: Request, res: Response) => {
  try {
    // Get driverId from body or authenticated user
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.body.driverId ? parseInt(req.body.driverId as string) : userIdFromRequest,
      'driver'
    );

    if (!driverId) {
      return sendUnauthorized(res, 'Driver authentication required');
    }

    if (!stripe) {
      return sendInternalError(res, new Error('Stripe is not configured'));
    }

    // Get or create Stripe Connect account
    const account = await getOrCreateStripeConnectAccount(driverId);

    // Create AccountSession for embedded onboarding
    const session = await stripe.accountSessions.create({
      account: account.accountId,
      components: {
        account_onboarding: {
          enabled: true,
        },
      },
    });

    return sendSuccess(res, 'AccountSession created', {
      clientSecret: session.client_secret,
    });
  } catch (error: any) {
    console.error('❌ Error creating AccountSession:', error);
    
    if (error.message?.includes('Stripe Connect is not enabled')) {
      return sendBadRequest(res, error.message);
    }

    return sendInternalError(res, error as Error, 'Failed to create AccountSession');
  }
});

/**
 * GET /api/driver/connect/status
 * Get Stripe Connect account status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Get driverId from query param or authenticated user
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.query.driverId ? parseInt(req.query.driverId as string) : userIdFromRequest,
      'driver'
    );

    if (!driverId) {
      return sendUnauthorized(res, 'Driver authentication required');
    }

    const driver = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
        payoutsEnabled: true,
      },
    });

    if (!driver) {
      return sendNotFound(res, 'Driver');
    }

    const hasAccount = !!driver.stripeAccountId;

    if (!hasAccount || !stripe || !driver.stripeAccountId) {
      return sendSuccess(res, 'Account status retrieved', {
        hasAccount: false,
        stripeAccountId: null,
        payoutsEnabled: false,
        chargesEnabled: false,
        currentlyDue: [],
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(driver.stripeAccountId);

    // Get requirements (what's currently due)
    const requirements = account.requirements as { currently_due?: string[] } | null;
    const currentlyDue = requirements?.currently_due || [];

    return sendSuccess(res, 'Account status retrieved', {
      hasAccount: true,
      stripeAccountId: account.id,
      payoutsEnabled: account.payouts_enabled || false,
      chargesEnabled: account.charges_enabled || false,
      currentlyDue: currentlyDue,
      detailsSubmitted: account.details_submitted || false,
    });
  } catch (error) {
    console.error('Error retrieving account status:', error);
    return sendInternalError(res, error as Error, 'Failed to retrieve account status');
  }
});

export default router;

