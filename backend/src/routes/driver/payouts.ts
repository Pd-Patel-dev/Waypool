/**
 * Driver Payout Routes
 * Handles Stripe Connect account creation, bank account linking, and payouts
 */

import express, { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
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
import { processWeeklyPayouts } from '../../services/weeklyPayoutService';

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

    // Proactive check: Verify Stripe Connect is enabled before attempting to create account
    // This provides a better user experience by catching the issue early
    try {
      // Try to list accounts (lightweight operation to verify Connect is enabled)
      await stripe.accounts.list({ limit: 1 });
    } catch (connectCheckError: any) {
      if (connectCheckError?.message?.includes('signed up for Connect') || 
          connectCheckError?.message?.includes('Connect') ||
          (connectCheckError?.type === 'StripeInvalidRequestError' && 
           connectCheckError?.raw?.message?.includes('Connect'))) {
        console.error('❌ Stripe Connect Error: Connect is not enabled on this Stripe account');
        return sendBadRequest(
          res,
          'Stripe Connect is not enabled on your Stripe account.\n\n' +
          'To enable Stripe Connect:\n' +
          '1. Go to: https://dashboard.stripe.com/settings/connect\n' +
          '2. Click "Get started" or "Enable Connect"\n' +
          '3. Complete the Connect setup process\n' +
          '4. Then try creating payout accounts again\n\n' +
          'Note: Stripe Connect is required for driver payouts functionality.'
        );
      }
      // If it's a different error (like permissions), continue - we'll catch it during account creation
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
      // Note: 'individual' is correct for most drivers (independent contractors)
      // Change to 'company' if drivers are businesses
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

    let account;
    try {
      account = await stripe.accounts.create(accountData);
      
      // Ensure business_type is explicitly set to 'individual' after creation
      // This prevents Stripe from asking for business details during onboarding
      if (account.business_type !== 'individual') {
        console.log('⚠️ Account business_type is not individual, updating...');
        account = await stripe.accounts.update(account.id, {
          business_type: 'individual',
        });
      }
    } catch (stripeError: any) {
      // Check if it's a Stripe Connect not enabled error
      if (stripeError?.type === 'StripeInvalidRequestError' && 
          stripeError?.message?.includes('signed up for Connect')) {
        console.error('❌ Stripe Connect Error: Connect is not enabled on this Stripe account');
        return sendBadRequest(
          res,
          'Stripe Connect is not enabled on your Stripe account. Please enable Stripe Connect in your Stripe Dashboard at https://dashboard.stripe.com/settings/connect. Once enabled, you can create Connect accounts for drivers.'
        );
      }
      
      // Re-throw other Stripe errors
      throw stripeError;
    }

    // Update driver with Stripe account ID
    await prisma.users.update({
      where: { id: driverId },
      data: {
        stripeAccountId: account.id,
        stripeAccountStatus: account.details_submitted ? 'enabled' : 'pending',
      },
    });

    // Create account link for onboarding
    // Note: Stripe will only show individual fields since business_type is set to 'individual'
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
    console.error('❌ Error creating Stripe Connect account:', error);
    
    // Check if it's a Stripe error with more details
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any;
      if (stripeError.type === 'StripeInvalidRequestError') {
        return sendBadRequest(res, stripeError.message || 'Stripe request failed. Please check your Stripe configuration.');
      }
    }
    
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

    // Retrieve account and ensure it's set to 'individual' business type
    // This prevents Stripe from asking for business details during onboarding
    let account;
    try {
      account = await stripe.accounts.retrieve(driver.stripeAccountId);
      
      // If business_type is not 'individual', update it
      if (account.business_type && account.business_type !== 'individual') {
        console.log('⚠️ Account business_type is not individual, updating to individual...');
        account = await stripe.accounts.update(driver.stripeAccountId, {
          business_type: 'individual',
        });
      } else if (!account.business_type) {
        // If business_type is not set, set it to 'individual'
        console.log('⚠️ Account business_type is not set, setting to individual...');
        account = await stripe.accounts.update(driver.stripeAccountId, {
          business_type: 'individual',
        });
      }
    } catch (error) {
      console.error('Error retrieving/updating account:', error);
      // Continue anyway - account link creation might still work
    }

    // Create account link for onboarding
    // Stripe will only show individual fields since business_type is set to 'individual'
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

    // Step 1: Create Transfer FROM platform account TO driver's connected account balance
    // This moves money into the driver's Stripe balance
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: driver.stripeAccountId,
      description: description || `Earnings payout for driver ${driverId}`,
      metadata: {
        driverId: driverId.toString(),
        type: 'driver_earnings',
      },
    });

    console.log(`✅ Transfer created: ${transfer.id} - $${amount} to connected account ${driver.stripeAccountId}`);

    // Step 2: Create Payout FROM driver's connected account TO their bank account
    // This moves money from the connected account's balance to the driver's actual bank account
    // We need to use the connected account context (stripeAccount header)
    let payout;
    try {
      payout = await stripe.payouts.create(
        {
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          description: description || `Payout to bank account for driver ${driverId}`,
          metadata: {
            driverId: driverId.toString(),
            transferId: transfer.id,
            type: 'driver_earnings',
          },
        },
        {
          stripeAccount: driver.stripeAccountId, // Create payout in connected account context
        }
      );

      const arrivalInfo = payout.arrival_date 
        ? new Date(payout.arrival_date * 1000).toISOString() 
        : 'pending (check Stripe dashboard)';
      console.log(`✅ Payout created: ${payout.id} - $${amount} to bank account`);
      console.log(`   Status: ${payout.status}, Arrival: ${arrivalInfo}`);
      console.log(`   Note: Payouts typically take 2-5 business days to reach bank account`);
    } catch (payoutError: any) {
      console.error(`❌ Error creating payout for connected account ${driver.stripeAccountId}:`, payoutError);
      
      // If payout creation fails, the transfer still succeeded, so we should still save the record
      // But warn the user that they need to manually create a payout or wait for automatic payout
      return sendBadRequest(
        res,
        `Transfer created successfully, but payout to bank account failed: ${payoutError.message}. ` +
        `The funds are in your Stripe account balance and will be paid out automatically based on your payout schedule, ` +
        `or you can create a payout manually from the Stripe dashboard.`
      );
    }

    // Save payout record in database
    const payoutRecord = await prisma.payouts.create({
      data: {
        driverId: driverId,
        stripePayoutId: payout.id, // Store the actual payout ID (not transfer ID)
        amount: amount,
        currency: 'usd',
        status: payout.status === 'paid' ? 'completed' : payout.status === 'pending' ? 'pending' : 'pending',
        payoutMethod: 'bank_account',
        description: description || `Payout to bank account for driver ${driverId}`,
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
      },
    });

    // Provide status explanation
    const statusExplanation = payout.status === 'pending' 
      ? 'Payout is pending - this is normal. Stripe payouts typically take 2-5 business days to reach your bank account.'
      : payout.status === 'paid'
      ? 'Payout completed - funds should be in your bank account.'
      : `Payout status: ${payout.status}`;

    return sendSuccess(res, 'Payout initiated successfully', {
      payoutId: payoutRecord.id,
      stripePayoutId: payout.id,
      transferId: transfer.id,
      amount: amount,
      status: payout.status,
      arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
      statusExplanation: statusExplanation,
      message: 'Funds transferred to your connected account and payout created to your bank account. ' + statusExplanation,
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
 * Get recent payout history for driver
 * Shows only actual Stripe payouts (not transfers) with status and availability dates
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

    // Get driver's Stripe account ID
    const driver = await prisma.users.findUnique({
      where: { id: driverId },
      select: { stripeAccountId: true },
    });

    if (!driver?.stripeAccountId || !stripe) {
      return sendSuccess(res, 'No payout history available', {
        payouts: [],
        total: 0,
        limit,
        offset,
        message: 'No Stripe account found. Complete payout setup to receive payouts.',
      });
    }

    // Fetch actual Stripe payouts from the connected account
    // These are the real payouts that go to the driver's bank account
    let stripePayouts: any[] = [];
    let totalPayouts = 0;

    try {
      const payoutsList = await stripe.payouts.list(
        {
          limit: limit + offset, // Fetch more to account for offset
        },
        {
          stripeAccount: driver.stripeAccountId, // View payouts in connected account context
        }
      );

      totalPayouts = payoutsList.data.length;

      // Map Stripe payouts with detailed status and availability information
      stripePayouts = payoutsList.data
        .slice(offset, offset + limit) // Apply offset and limit
        .map((p) => {
          const arrivalDate = p.arrival_date ? new Date(p.arrival_date * 1000) : null;
          const now = new Date();
          const isAvailable = arrivalDate && arrivalDate <= now;
          const daysUntilAvailable = arrivalDate && arrivalDate > now
            ? Math.ceil((arrivalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          // Determine status display
          let statusDisplay = p.status;
          let statusMessage = '';
          
          switch (p.status) {
            case 'paid':
              statusDisplay = 'completed';
              statusMessage = isAvailable 
                ? 'Funds are available in your bank account'
                : `Funds will be available on ${arrivalDate?.toLocaleDateString()}`;
              break;
            case 'pending':
              statusDisplay = 'pending';
              statusMessage = arrivalDate
                ? `Funds will be available on ${arrivalDate.toLocaleDateString()} (${daysUntilAvailable} day${daysUntilAvailable !== 1 ? 's' : ''} away)`
                : 'Payout is being processed by Stripe. This is normal - bank transfers typically take 2-5 business days.';
              break;
            case 'in_transit':
              statusDisplay = 'in_transit';
              statusMessage = arrivalDate
                ? `Funds are in transit, will arrive on ${arrivalDate.toLocaleDateString()}`
                : 'Funds are in transit to your bank account';
              break;
            case 'canceled':
              statusDisplay = 'canceled';
              statusMessage = 'Payout was canceled';
              break;
            case 'failed':
              statusDisplay = 'failed';
              statusMessage = p.failure_message || 'Payout failed';
              break;
            default:
              statusDisplay = p.status;
              statusMessage = 'Processing payout';
          }

          return {
            id: p.id,
            stripePayoutId: p.id,
            amount: p.amount / 100, // Convert from cents
            currency: p.currency,
            status: statusDisplay,
            statusMessage: statusMessage,
            stripeStatus: p.status, // Original Stripe status
            payoutMethod: p.type || 'bank_account', // 'bank' or 'card'
            description: p.description || `Payout to bank account`,
            failureCode: p.failure_code || null,
            failureMessage: p.failure_message || null,
            arrivalDate: arrivalDate,
            isAvailable: isAvailable,
            daysUntilAvailable: daysUntilAvailable,
            createdAt: new Date(p.created * 1000),
            updatedAt: new Date(p.created * 1000), // Stripe payouts don't have an 'updated' field
          };
        });
    } catch (stripeError: any) {
      console.error('Error fetching Stripe payouts:', stripeError);
      return sendBadRequest(
        res,
        `Unable to fetch payout history: ${stripeError.message || 'Stripe API error'}`
      );
    }

    return sendSuccess(res, 'Payout history retrieved', {
      payouts: stripePayouts,
      total: totalPayouts,
      limit,
      offset,
      message: 'Showing recent payouts to your bank account with status and availability dates.',
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

/**
 * PUT /api/driver/payouts/update-account
 * Update Stripe Connect account information (for in-app onboarding)
 */
router.put('/update-account', async (req: Request, res: Response) => {
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

    const {
      ssnLast4,
      dob,
      address,
      city,
      state,
      postalCode,
      bankAccountToken,
    } = req.body;

    // IMPORTANT: Stripe Connect Express accounts don't allow updating 'individual' fields via API
    // Individual information (SSN, DOB, address) must be collected via:
    // 1. Account links (hosted onboarding) - requires user to complete on Stripe's site
    // 2. Embedded Components (Stripe.js SDK) - requires web-based implementation
    // 
    // For in-app onboarding, we can ONLY link bank accounts via API
    // Individual info must be collected separately via account links

    // Only link bank account if token provided (this works via API)
    if (!bankAccountToken) {
      return sendBadRequest(res, 'Bank account token is required');
    }

    let account;
    
    try {
      // Link bank account (this is the only thing we can do via API for Express accounts)
      await stripe.accounts.createExternalAccount(driver.stripeAccountId, {
        external_account: bankAccountToken,
        default_for_currency: true,
      });
    } catch (bankError: any) {
      console.error('Error linking bank account:', bankError);
      if (bankError.type === 'StripeInvalidRequestError') {
        return sendBadRequest(res, bankError.message || 'Failed to link bank account');
      }
      if (bankError.type === 'StripePermissionError') {
        return sendBadRequest(
          res,
          'Unable to link bank account. Please ensure your Stripe Connect account is properly set up.'
        );
      }
      throw bankError;
    }

    // Retrieve current account status
    account = await stripe.accounts.retrieve(driver.stripeAccountId);

    // Update database
    await prisma.users.update({
      where: { id: driverId },
      data: {
        stripeAccountStatus: account.details_submitted ? 'enabled' : 'pending',
        payoutsEnabled: account.payouts_enabled || false,
      },
    });

    // Get external accounts
    const externalAccounts = await stripe.accounts.listExternalAccounts(
      driver.stripeAccountId,
      { object: 'bank_account', limit: 1 }
    );
    
    const bankAccount = externalAccounts.data[0] as any;

    // Check if individual info is still needed
    const needsIndividualInfo = !!(ssnLast4 || dob || address || city || state || postalCode);
    const requirements = account.requirements;
    const hasIndividualRequirements = requirements?.currently_due?.some((req: string) => 
      req.includes('individual') || req.includes('ssn') || req.includes('dob') || req.includes('address')
    ) || false;

    return sendSuccess(res, 'Bank account linked successfully', {
      accountId: account.id,
      status: account.details_submitted ? 'enabled' : 'pending',
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements,
      bankAccount: bankAccount
        ? {
            id: bankAccount.id,
            last4: bankAccount.last4,
            bankName: bankAccount.bank_name,
            accountType: bankAccount.account_type,
            status: bankAccount.status,
          }
        : null,
      // Note: Individual info cannot be updated via API for Express accounts
      // User will need to complete it via account link if required by Stripe
      needsIndividualInfo: needsIndividualInfo || hasIndividualRequirements,
      message: needsIndividualInfo || hasIndividualRequirements
        ? 'Bank account linked. Individual information (SSN, DOB, address) must be completed via Stripe account link. You can complete this later from the payouts screen.'
        : 'Bank account linked successfully.',
    });
  } catch (error: any) {
    console.error('Error updating account:', error);
    
    if (error.type === 'StripePermissionError' || error.code === 'oauth_not_supported') {
      return sendBadRequest(
        res,
        'Individual information cannot be updated directly via API for Express accounts. Please use Stripe account links or complete onboarding through the Stripe dashboard.'
      );
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return sendBadRequest(res, error.message || 'Invalid account information');
    }

    return sendInternalError(res, error as Error, 'Failed to update account');
  }
});

/**
 * POST /api/driver/payouts/create-bank-account-token
 * Create a bank account token for linking (client-side should use Stripe.js)
 * This endpoint is for server-side token creation if needed
 */
router.post('/create-bank-account-token', async (req: Request, res: Response) => {
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

    const { accountNumber, routingNumber, accountHolderName, accountType } = req.body;

    if (!accountNumber || !routingNumber || !accountHolderName) {
      return sendBadRequest(res, 'Account number, routing number, and account holder name are required');
    }

    // Validate routing number format (US routing numbers are 9 digits)
    const cleanedRoutingNumber = routingNumber.replace(/\D/g, '');
    if (cleanedRoutingNumber.length !== 9) {
      return sendBadRequest(res, 'Routing number must be exactly 9 digits');
    }

    // Validate routing number checksum (US routing numbers use a checksum algorithm)
    // For test mode, Stripe accepts specific test routing numbers
    // Valid test routing numbers: 110000000 (always succeeds), 110000000 (for ACH)
    // In production, we'd validate the checksum, but for now we'll let Stripe validate
    
    // Validate account number (must be at least 4 digits)
    const cleanedAccountNumber = accountNumber.replace(/\D/g, '');
    if (cleanedAccountNumber.length < 4) {
      return sendBadRequest(res, 'Account number must be at least 4 digits');
    }

    // For test mode, suggest using Stripe test routing number if invalid
    const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
    const testRoutingNumbers = ['110000000', '110000000']; // Stripe test routing numbers

    // Create bank account token
    // Note: In production, this should be done client-side with Stripe.js for security
    // This endpoint is provided as a fallback
    const token = await stripe.tokens.create({
      bank_account: {
        country: 'US',
        currency: 'usd',
        account_number: cleanedAccountNumber,
        routing_number: cleanedRoutingNumber,
        account_holder_name: accountHolderName.trim(),
        account_holder_type: 'individual',
      },
    }, {
      stripeAccount: driver.stripeAccountId,
    });

    return sendSuccess(res, 'Bank account token created', {
      token: token.id,
    });
  } catch (error: any) {
    console.error('Error creating bank account token:', error);
    
    if (error.type === 'StripeInvalidRequestError') {
      // Provide user-friendly error messages for common Stripe errors
      if (error.code === 'routing_number_invalid') {
        const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
        const message = isTestMode
          ? 'Invalid routing number. For testing, please use Stripe test routing number: 110000000'
          : 'Invalid routing number. Please check that you entered a valid 9-digit US bank routing number. The routing number must pass validation checks.';
        return sendBadRequest(res, message);
      }
      if (error.code === 'account_number_invalid') {
        return sendBadRequest(
          res,
          'Invalid account number. Please check that you entered the correct account number.'
        );
      }
      if (error.message) {
        return sendBadRequest(res, error.message);
      }
      return sendBadRequest(res, 'Invalid bank account information. Please check your details and try again.');
    }

    return sendInternalError(res, error as Error, 'Failed to create bank account token');
  }
});

/**
 * GET /api/driver/payouts/account-requirements
 * Get account requirements (what information is still needed)
 */
router.get('/account-requirements', async (req: Request, res: Response) => {
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
      select: { stripeAccountId: true },
    });

    if (!driver || !driver.stripeAccountId) {
      return sendBadRequest(res, 'Stripe Connect account not found. Please create one first.');
    }

    if (!stripe) {
      return sendInternalError(res, new Error('Stripe is not configured'));
    }

    const account = await stripe.accounts.retrieve(driver.stripeAccountId);

    return sendSuccess(res, 'Account requirements retrieved', {
      requirements: account.requirements,
      detailsSubmitted: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      currentlyDue: account.requirements?.currently_due || [],
      eventuallyDue: account.requirements?.eventually_due || [],
      pastDue: account.requirements?.past_due || [],
      disabledReason: account.requirements?.disabled_reason || null,
    });
  } catch (error) {
    console.error('Error retrieving account requirements:', error);
    return sendInternalError(res, error as Error, 'Failed to retrieve account requirements');
  }
});

/**
 * DELETE /api/driver/payouts/delete-account
 * Delete/unlink Stripe Connect account
 */
router.delete('/delete-account', async (req: Request, res: Response) => {
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
        payoutsEnabled: true,
      },
    });

    if (!driver) {
      return sendNotFound(res, 'Driver');
    }

    if (!driver.stripeAccountId) {
      return sendBadRequest(res, 'No Stripe Connect account found to delete');
    }

    // Check if there are pending payouts
    const pendingPayouts = await prisma.payouts.count({
      where: {
        driverId: driverId,
        status: {
          in: ['pending', 'processing'],
        },
      },
    });

    if (pendingPayouts > 0) {
      return sendBadRequest(
        res,
        `Cannot delete account with ${pendingPayouts} pending payout(s). Please wait for payouts to complete first.`
      );
    }

    if (!stripe) {
      return sendInternalError(res, new Error('Stripe is not configured'));
    }

    // Delete the Stripe Connect account
    try {
      await stripe.accounts.del(driver.stripeAccountId);
    } catch (stripeError: any) {
      // If account is already deleted or doesn't exist, that's okay
      if (stripeError.type !== 'StripeInvalidRequestError' || !stripeError.message.includes('No such account')) {
        console.error('Error deleting Stripe account:', stripeError);
        // Continue to clean up database even if Stripe deletion fails
      }
    }

    // Clear Stripe account data from database
    await prisma.users.update({
      where: { id: driverId },
      data: {
        stripeAccountId: null,
        stripeAccountStatus: null,
        bankAccountId: null,
        bankAccountLast4: null,
        bankAccountType: null,
        bankAccountStatus: null,
        payoutsEnabled: false,
      },
    });

    return sendSuccess(res, 'Stripe Connect account deleted successfully', {
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting Stripe Connect account:', error);
    return sendInternalError(res, error as Error, 'Failed to delete Stripe Connect account');
  }
});

/**
 * POST /api/driver/payouts/reset-stripe-status
 * Reset/clear Stripe status in database (for testing)
 * This clears database fields WITHOUT deleting the Stripe account
 */
router.post('/reset-stripe-status', async (req: Request, res: Response) => {
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
      select: {
        id: true,
        stripeAccountId: true,
      },
    });

    if (!driver) {
      return sendNotFound(res, 'Driver');
    }

    // Clear all Stripe-related fields in database
    // NOTE: This does NOT delete the Stripe account - it only clears local database fields
    await prisma.users.update({
      where: { id: driverId },
      data: {
        stripeAccountId: null,
        stripeAccountStatus: null,
        stripeOnboardingStatus: "not_started",
        stripeRequirementsDue: Prisma.JsonNull, // Prisma Json field - use JsonNull
        bankAccountId: null,
        bankAccountLast4: null,
        bankAccountType: null,
        bankAccountStatus: null,
        payoutsEnabled: false,
      } as any, // stripeCapabilities may not be in schema yet
    });

    console.log(`✅ Reset Stripe status for driver ${driverId} (account ${driver.stripeAccountId || 'none'} still exists in Stripe)`);

    return sendSuccess(res, 'Stripe status reset successfully', {
      reset: true,
      note: 'Database fields cleared. Stripe account still exists in Stripe (if any).',
    });
  } catch (error) {
    console.error('Error resetting Stripe status:', error);
    return sendInternalError(res, error as Error, 'Failed to reset Stripe status');
  }
});

/**
 * POST /api/driver/payouts/process-weekly
 * Manually trigger weekly payout process (for testing/admin use)
 * This endpoint processes weekly payouts for all eligible drivers
 */
router.post('/process-weekly', async (req: Request, res: Response) => {
  try {
    // Optional: Add admin authentication here
    // For now, allowing any authenticated driver to trigger (useful for testing)
    
    console.log('🔄 Manual weekly payout process triggered');

    const result = await processWeeklyPayouts();

    return sendSuccess(res, 'Weekly payout process completed', {
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      results: result.results.map((r) => ({
        driverId: r.driverId,
        success: r.success,
        amount: r.amount,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error('Error processing weekly payouts:', error);
    return sendInternalError(res, error as Error, 'Failed to process weekly payouts');
  }
});

export default router;

