/**
 * Stripe Connect Helper Functions
 * Utilities for creating and managing Stripe Connect Express accounts
 */

import { stripe } from '../lib/stripe';
import { prisma } from '../lib/prisma';
import { formatPhoneToE164 } from './phone';

export interface StripeConnectAccount {
  accountId: string;
  email: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

/**
 * Get or create a Stripe Connect Express account for a driver
 * Prefills known fields to reduce onboarding questions
 */
export async function getOrCreateStripeConnectAccount(
  driverId: number
): Promise<StripeConnectAccount> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  // Get driver from database
  const driver = await prisma.users.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      stripeAccountId: true,
      isDriver: true,
    },
  });

  if (!driver || !driver.isDriver) {
    throw new Error('User is not a driver');
  }

  // If driver already has a Stripe account, retrieve and return it
  if (driver.stripeAccountId) {
    try {
      const account = await stripe.accounts.retrieve(driver.stripeAccountId);
      
      // Ensure business_type is set to 'individual'
      if (account.business_type && account.business_type !== 'individual') {
        await stripe.accounts.update(driver.stripeAccountId, {
          business_type: 'individual',
        });
        // Re-retrieve after update
        const updatedAccount = await stripe.accounts.retrieve(driver.stripeAccountId);
        return {
          accountId: updatedAccount.id,
          email: updatedAccount.email || driver.email,
          chargesEnabled: updatedAccount.charges_enabled || false,
          payoutsEnabled: updatedAccount.payouts_enabled || false,
          detailsSubmitted: updatedAccount.details_submitted || false,
        };
      }

      return {
        accountId: account.id,
        email: account.email || driver.email,
        chargesEnabled: account.charges_enabled || false,
        payoutsEnabled: account.payouts_enabled || false,
        detailsSubmitted: account.details_submitted || false,
      };
    } catch (error: any) {
      // Account might be deleted, create a new one
      console.log('⚠️ Existing Stripe account not found, creating new one:', error.message);
    }
  }

  // Verify Stripe Connect is enabled
  try {
    await stripe.accounts.list({ limit: 1 });
  } catch (connectCheckError: any) {
    if (
      connectCheckError?.message?.includes('signed up for Connect') ||
      (connectCheckError?.type === 'StripeInvalidRequestError' &&
        connectCheckError?.raw?.message?.includes('Connect'))
    ) {
      throw new Error(
        'Stripe Connect is not enabled. Please enable it in your Stripe Dashboard at https://dashboard.stripe.com/settings/connect'
      );
    }
  }

  // Format phone number to E.164 format (required by Stripe)
  const formattedPhone = formatPhoneToE164(driver.phoneNumber, '1');

  // Split full name into first and last name
  const nameParts = driver.fullName.trim().split(' ');
  const firstName = nameParts[0] || driver.fullName;
  const lastName = nameParts.slice(1).join(' ') || '';

  // Create new Stripe Connect Express account with prefilled fields
  // Prefilling reduces the number of questions during embedded onboarding
  const accountData: any = {
    type: 'express',
    country: 'US',
    email: driver.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    individual: {
      email: driver.email,
      first_name: firstName,
      last_name: lastName,
    },
  };

  // Only add phone if it's valid and formatted
  if (formattedPhone) {
    accountData.individual.phone = formattedPhone;
  }

  let account;
  try {
    account = await stripe.accounts.create(accountData);

    // Ensure business_type is explicitly set to 'individual'
    if (account.business_type !== 'individual') {
      account = await stripe.accounts.update(account.id, {
        business_type: 'individual',
      });
    }
  } catch (stripeError: any) {
    if (
      stripeError?.type === 'StripeInvalidRequestError' &&
      stripeError?.message?.includes('signed up for Connect')
    ) {
      throw new Error(
        'Stripe Connect is not enabled. Please enable it in your Stripe Dashboard at https://dashboard.stripe.com/settings/connect'
      );
    }
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

  return {
    accountId: account.id,
    email: account.email || driver.email,
    chargesEnabled: account.charges_enabled || false,
    payoutsEnabled: account.payouts_enabled || false,
    detailsSubmitted: account.details_submitted || false,
  };
}

