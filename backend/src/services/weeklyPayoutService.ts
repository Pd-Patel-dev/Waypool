/**
 * Weekly Payout Service
 * Automatically processes weekly payouts for drivers based on their net earnings
 */

import { prisma } from '../lib/prisma';
import { stripe } from '../lib/stripe';
import { calculateRideEarnings } from '../utils/earnings';

interface WeeklyEarnings {
  driverId: number;
  netEarnings: number;
  rideCount: number;
}

/**
 * Calculate weekly net earnings for all drivers
 */
export async function calculateWeeklyEarningsForAllDrivers(): Promise<WeeklyEarnings[]> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Get all drivers
  const drivers = await prisma.users.findMany({
    where: {
      isDriver: true,
      stripeAccountId: { not: null },
      payoutsEnabled: true,
    },
    select: {
      id: true,
      stripeAccountId: true,
    },
  });

  const weeklyEarnings: WeeklyEarnings[] = [];

  for (const driver of drivers) {
    // Get completed rides from the last week
    const completedRides = await prisma.rides.findMany({
      where: {
        driverId: driver.id,
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
      const earnings = calculateRideEarnings(ride.pricePerSeat || 0, ride.bookings);
      totalNetEarnings += earnings.netEarnings;
    }

    // Only include drivers with earnings > $0
    if (totalNetEarnings > 0) {
      weeklyEarnings.push({
        driverId: driver.id,
        netEarnings: parseFloat(totalNetEarnings.toFixed(2)),
        rideCount: completedRides.length,
      });
    }
  }

  return weeklyEarnings;
}

/**
 * Process weekly payout for a single driver
 */
export async function processWeeklyPayoutForDriver(
  driverId: number,
  amount: number
): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const driver = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        stripeAccountId: true,
        payoutsEnabled: true,
      },
    });

    if (!driver || !driver.stripeAccountId) {
      return {
        success: false,
        error: 'Driver Stripe account not found',
      };
    }

    if (!driver.payoutsEnabled) {
      return {
        success: false,
        error: 'Payouts are not enabled for this driver',
      };
    }

    // Check account status
    const account = await stripe.accounts.retrieve(driver.stripeAccountId);
    if (!account.payouts_enabled) {
      return {
        success: false,
        error: 'Payouts are not enabled on Stripe account',
      };
    }

    // Check for pending payouts (avoid duplicate payouts)
    const existingPayout = await prisma.payouts.findFirst({
      where: {
        driverId: driverId,
        status: {
          in: ['pending', 'processing'],
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    if (existingPayout) {
      return {
        success: false,
        error: 'A payout is already pending for this driver',
      };
    }

    // Create payout
    const payout = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: driver.stripeAccountId,
      description: `Weekly payout for driver ${driverId}`,
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
        description: `Weekly payout for driver ${driverId}`,
      },
    });

    return {
      success: true,
      payoutId: payoutRecord.id.toString(),
    };
  } catch (error: any) {
    console.error(`Error processing payout for driver ${driverId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to process payout',
    };
  }
}

/**
 * Process weekly payouts for all eligible drivers
 */
export async function processWeeklyPayoutsForAllDrivers(): Promise<{
  totalProcessed: number;
  totalAmount: number;
  successes: number;
  failures: number;
  results: Array<{ driverId: number; success: boolean; amount: number; error?: string }>;
}> {
  const weeklyEarnings = await calculateWeeklyEarningsForAllDrivers();

  const results: Array<{ driverId: number; success: boolean; amount: number; error?: string }> = [];
  let successes = 0;
  let failures = 0;
  let totalAmount = 0;

  for (const earnings of weeklyEarnings) {
    const result = await processWeeklyPayoutForDriver(earnings.driverId, earnings.netEarnings);
    
    results.push({
      driverId: earnings.driverId,
      success: result.success,
      amount: earnings.netEarnings,
      ...(result.error && { error: result.error }),
    });

    if (result.success) {
      successes++;
      totalAmount += earnings.netEarnings;
    } else {
      failures++;
    }
  }

  return {
    totalProcessed: weeklyEarnings.length,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    successes,
    failures,
    results,
  };
}

/**
 * Update payout status from Stripe webhook
 */
export async function updatePayoutStatus(
  stripePayoutId: string,
  status: string,
  failureCode?: string,
  failureMessage?: string
): Promise<void> {
  await prisma.payouts.updateMany({
    where: { stripePayoutId: stripePayoutId },
    data: {
      status: status,
      failureCode: failureCode || null,
      failureMessage: failureMessage || null,
      updatedAt: new Date(),
    },
  });
}

