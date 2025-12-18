/**
 * Driver Payout Routes
 * Handles Stripe Connect account creation, bank account linking, and payouts
 */

import express, { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { stripe } from '../../lib/stripe';
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendNotFound,
  sendInternalError,
} from '../../utils/apiResponse';
import { getUserIdFromRequest } from '../../middleware/testModeAuth';
import { getValidatedUserId } from '../../utils/testMode';
import { formatPhoneToE164 } from '../../utils/phone';

const router = express.Router();

/**
 * POST /api/driver/payouts/connect-account
 * Create or retrieve Stripe Connect account for driver
 */
router.post('/connect-account', async (req: Request, res: Response) => {
  try {
    // Get driverId from body or authenticated user
    let driverId: number;
    try {
      const userIdFromRequest = getUserIdFromRequest(req, 'driver');
      driverId = getValidatedUserId(
        req.body.driverId ? parseInt(req.body.driverId as string) : userIdFromRequest,
        'driver'
      );
    } catch {
      return sendUnauthorized(res, 'Driver authentication required');
    }

    if (!driverId) {
      return sendUnauthorized(res, 'Driver authentication required');
    }

    // Check if driver exists and is a driver
    const driver = await prisma.users.findUnique({
      where: { id: driverId },
    });

    if (!driver || !driver.isDriver) {
      return sendBadRequest(res, 'User is not a driver');
    }

    if (!stripe) {
      return sendInternalError(res, new Error('Stripe is not configured'));
    }

    // If driver already has a Stripe account, return it
    if (driver.stripeAccountId) {
      try {
        const account = await stripe.accounts.retrieve(driver.stripeAccountId);
        return sendSuccess(res, 'Stripe Connect account retrieved', {
          accountId: account.id,
          status: account.details_submitted ? 'enabled' : 'pending',
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          email: account.email,
        });
      } catch (error) {
        // Account might be deleted, create a new one
        console.error('Error retrieving Stripe account:', error);
      }
    }

    // Format phone number to E.164 format (required by Stripe)
    const formattedPhone = formatPhoneToE164(driver.phoneNumber, '1');
    
    // Create new Stripe Connect account
    const accountData: any = {
      type: 'express', // Express accounts for quick onboarding
      country: 'US',
      email: driver.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        email: driver.email,
        first_name: driver.fullName.split(' ')[0] || driver.fullName,
        last_name: driver.fullName.split(' ').slice(1).join(' ') || '',
      },
    };

    // Only add phone if it's valid and formatted
    if (formattedPhone) {
      accountData.individual.phone = formattedPhone;
    }

    const account = await stripe.accounts.create(accountData);

    // Update driver with Stripe account ID
    await prisma.users.update({
      where: { id: driverId },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: account.details_submitted ? 'enabled' : 'pending',
      },
    });

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/driver/payouts/return`,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/driver/payouts/success`,
      type: 'account_onboarding',
    });

    return sendSuccess(res, 'Stripe Connect account created', {
      accountId: account.id,
      onboardingUrl: accountLink.url,
      status: 'pending',
    });
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    return sendInternalError(res, error as Error, 'Failed to create Stripe Connect account');
  }
});

/**
 * GET /api/driver/payouts/account-status
 * Get Stripe Connect account status
 */
router.get('/account-status', async (req: Request, res: Response) => {
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
        bankAccountId: true,
        bankAccountLast4: true,
        bankAccountType: true,
        bankAccountStatus: true,
        payoutsEnabled: true,
      },
    });

    if (!driver) {
      return sendNotFound(res, 'Driver');
    }

    if (!driver.stripeAccountId || !stripe) {
      return sendSuccess(res, 'No Stripe account found', {
        hasAccount: false,
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(driver.stripeAccountId);

    // Get external accounts (bank accounts)
    const externalAccounts = await stripe.accounts.listExternalAccounts(
      driver.stripeAccountId,
      { object: 'bank_account', limit: 1 }
    );

    const bankAccount = externalAccounts.data[0] as any;

    return sendSuccess(res, 'Account status retrieved', {
      hasAccount: true,
      accountId: account.id,
      status: account.details_submitted ? 'enabled' : 'pending',
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      bankAccount: bankAccount
        ? {
            id: bankAccount.id,
            last4: bankAccount.last4,
            bankName: bankAccount.bank_name,
            accountType: bankAccount.account_type,
            status: bankAccount.status,
          }
        : null,
      requirements: account.requirements,
    });
  } catch (error) {
    console.error('Error retrieving account status:', error);
    return sendInternalError(res, error as Error, 'Failed to retrieve account status');
  }
});

/**
 * POST /api/driver/payouts/create-account-link
 * Create account link for onboarding or updating account
 */
router.post('/create-account-link', async (req: Request, res: Response) => {
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

    const driver = await prisma.users.findUnique({
      where: { id: driverId },
      select: { stripeAccountId: true },
    });

    if (!driver || !driver.stripeAccountId) {
      return sendBadRequest(res, 'Stripe Connect account not found. Please create one first.');
    }

    if (!stripe) {
      return sendInternalError(res, new Error('Stripe is not configured'));
    }

    const accountLink = await stripe.accountLinks.create({
      account: driver.stripeAccountId,
      refresh_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/driver/payouts/return`,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/driver/payouts/success`,
      type: req.body.type || 'account_onboarding', // 'account_onboarding' or 'account_update'
    });

    return sendSuccess(res, 'Account link created', {
      url: accountLink.url,
    });
  } catch (error) {
    console.error('Error creating account link:', error);
    return sendInternalError(res, error as Error, 'Failed to create account link');
  }
});

/**
 * POST /api/driver/payouts/initiate
 * Initiate a payout to driver's bank account
 */
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    // Get driverId from body or authenticated user
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.body.driverId ? parseInt(req.body.driverId as string) : userIdFromRequest,
      'driver'
    );
    const { amount, description } = req.body;

    if (!driverId) {
      return sendUnauthorized(res, 'Driver authentication required');
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return sendBadRequest(res, 'Valid amount is required');
    }

    const driver = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
        payoutsEnabled: true,
      },
    });

    if (!driver || !driver.stripeAccountId) {
      return sendBadRequest(res, 'Stripe Connect account not found. Please set up your account first.');
    }

    if (!stripe) {
      return sendInternalError(res, new Error('Stripe is not configured'));
    }

    // Check account status
    const account = await stripe.accounts.retrieve(driver.stripeAccountId);
    if (!account.payouts_enabled) {
      return sendBadRequest(res, 'Payouts are not enabled for your account. Please complete account setup.');
    }

    // Create payout
    const payout = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: driver.stripeAccountId,
      description: description || `Weekly payout for driver ${driverId}`,
    });

    // Save payout record
    const payoutRecord = await prisma.payouts.create({
      data: {
        driverId: driverId,
        stripePayoutId: payout.id,
        amount: amount,
        currency: 'usd',
        status: 'pending',
        payoutMethod: 'bank_account',
        description: description || `Weekly payout for driver ${driverId}`,
      },
    });

    return sendSuccess(res, 'Payout initiated successfully', {
      payoutId: payoutRecord.id,
      stripePayoutId: payout.id,
      amount: amount,
      status: 'pending',
      arrivalDate: null, // Stripe Transfer doesn't have arrival_date, only Payouts do
    });
  } catch (error: any) {
    console.error('Error initiating payout:', error);
    
    // Handle Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return sendBadRequest(res, error.message);
    }

    return sendInternalError(res, error as Error, 'Failed to initiate payout');
  }
});

/**
 * GET /api/driver/payouts/history
 * Get payout history for driver
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    // Get driverId from query param or authenticated user
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.query.driverId ? parseInt(req.query.driverId as string) : userIdFromRequest,
      'driver'
    );
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!driverId) {
      return sendUnauthorized(res, 'Driver authentication required');
    }

    const payouts = await prisma.payouts.findMany({
      where: { driverId: driverId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.payouts.count({
      where: { driverId: driverId },
    });

    return sendSuccess(res, 'Payout history retrieved', {
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        payoutMethod: p.payoutMethod,
        description: p.description,
        failureCode: p.failureCode,
        failureMessage: p.failureMessage,
        arrivalDate: p.arrivalDate,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error retrieving payout history:', error);
    return sendInternalError(res, error as Error, 'Failed to retrieve payout history');
  }
});

/**
 * GET /api/driver/payouts/balance
 * Get available balance for payout (weekly net earnings)
 */
router.get('/balance', async (req: Request, res: Response) => {
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

    // Calculate weekly net earnings (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const completedRides = await prisma.rides.findMany({
      where: {
        driverId: driverId,
        status: 'completed',
        updatedAt: {
          gte: oneWeekAgo,
        },
      },
      include: {
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'completed'],
            },
          },
          select: {
            numberOfSeats: true,
          },
        },
      },
    });

    // Calculate total net earnings for the week
    let totalNetEarnings = 0;
    for (const ride of completedRides) {
      const { calculateRideEarnings } = await import('../../utils/earnings');
      const earnings = calculateRideEarnings(ride.pricePerSeat || 0, ride.bookings);
      totalNetEarnings += earnings.netEarnings;
    }

    // Get pending payouts
    const pendingPayouts = await prisma.payouts.aggregate({
      where: {
        driverId: driverId,
        status: {
          in: ['pending', 'processing'],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const availableBalance = totalNetEarnings - (pendingPayouts._sum.amount || 0);

    return sendSuccess(res, 'Balance retrieved', {
      weeklyNetEarnings: parseFloat(totalNetEarnings.toFixed(2)),
      pendingPayouts: parseFloat((pendingPayouts._sum.amount || 0).toFixed(2)),
      availableBalance: Math.max(0, parseFloat(availableBalance.toFixed(2))),
      currency: 'usd',
    });
  } catch (error) {
    console.error('Error calculating balance:', error);
    return sendInternalError(res, error as Error, 'Failed to calculate balance');
  }
});

export default router;

