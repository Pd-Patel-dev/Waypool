/**
 * Weekly Payout Service
 * Automatically processes weekly payouts for all drivers with available earnings
 */

import { prisma } from '../lib/prisma';
import { stripe } from '../lib/stripe';
import { calculateRideEarnings } from '../utils/earnings';

interface WeeklyPayoutResult {
  driverId: number;
  success: boolean;
  amount?: number;
  transferId?: string;
  payoutId?: string;
  error?: string;
}

/**
 * Process weekly payout for a single driver
 */
async function processDriverWeeklyPayout(driverId: number): Promise<WeeklyPayoutResult> {
  try {
    // Get driver with Stripe account
    const driver = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        stripeAccountId: true,
        isDriver: true,
      },
    });

    if (!driver || !driver.isDriver || !driver.stripeAccountId) {
      return {
        driverId,
        success: false,
        error: 'Driver does not have a Stripe Connect account',
      };
    }

    // Verify Stripe is configured
    if (!stripe) {
      return {
        driverId,
        success: false,
        error: 'Stripe is not configured',
      };
    }

    // Check if payouts are enabled
    const account = await stripe.accounts.retrieve(driver.stripeAccountId);
    if (!account.payouts_enabled) {
      return {
        driverId,
        success: false,
        error: 'Payouts are not enabled for this account',
      };
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
      const earnings = calculateRideEarnings(ride.pricePerSeat || 0, ride.bookings);
      totalNetEarnings += earnings.netEarnings;
    }

    // Check for pending payouts that haven't been processed yet
    const pendingPayouts = await prisma.payouts.aggregate({
      where: {
        driverId: driverId,
        status: {
          in: ['pending', 'processing'],
        },
        createdAt: {
          gte: oneWeekAgo,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const pendingAmount = pendingPayouts._sum.amount || 0;
    const availableBalance = Math.max(0, totalNetEarnings - pendingAmount);

    // Skip if no earnings available
    if (availableBalance <= 0) {
      return {
        driverId,
        success: true,
        amount: 0,
        error: 'No earnings available for payout',
      };
    }

    // Step 1: Create Transfer FROM platform account TO driver's connected account balance
    const transfer = await stripe.transfers.create({
      amount: Math.round(availableBalance * 100), // Convert to cents
      currency: 'usd',
      destination: driver.stripeAccountId,
      description: `Weekly payout for driver ${driverId}`,
      metadata: {
        driverId: driverId.toString(),
        type: 'weekly_payout',
        period: `week_${oneWeekAgo.toISOString()}_${new Date().toISOString()}`,
      },
    });

    console.log(`✅ Weekly transfer created for driver ${driverId}: ${transfer.id} - $${availableBalance}`);

    // Step 2: Create Payout FROM driver's connected account TO their bank account
    const payout = await stripe.payouts.create(
      {
        amount: Math.round(availableBalance * 100), // Convert to cents
        currency: 'usd',
        description: `Weekly payout to bank account for driver ${driverId}`,
        metadata: {
          driverId: driverId.toString(),
          transferId: transfer.id,
          type: 'weekly_payout',
        },
      },
      {
        stripeAccount: driver.stripeAccountId, // Create payout in connected account context
      }
    );

    console.log(`✅ Weekly payout created for driver ${driverId}: ${payout.id} - $${availableBalance} (arrival: ${payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : 'pending'})`);

    // Save payout record in database
    await prisma.payouts.create({
      data: {
        driverId: driverId,
        stripePayoutId: payout.id,
        amount: availableBalance,
        currency: 'usd',
        status: payout.status === 'paid' ? 'completed' : payout.status === 'pending' ? 'pending' : 'pending',
        payoutMethod: 'bank_account',
        description: `Weekly automatic payout for driver ${driverId}`,
        arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
      },
    });

    return {
      driverId,
      success: true,
      amount: availableBalance,
      transferId: transfer.id,
      payoutId: payout.id,
    };
  } catch (error: any) {
    console.error(`❌ Error processing weekly payout for driver ${driverId}:`, error);
    return {
      driverId,
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Process weekly payouts for all eligible drivers
 */
export async function processWeeklyPayouts(): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: WeeklyPayoutResult[];
}> {
  console.log('🔄 Starting weekly payout process...');

  try {
    // Get all drivers with Stripe Connect accounts
    const drivers = await prisma.users.findMany({
      where: {
        isDriver: true,
        stripeAccountId: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });

    console.log(`📊 Found ${drivers.length} drivers with Stripe accounts`);

    // Process payouts for all drivers
    const results = await Promise.all(
      drivers.map((driver) => processDriverWeeklyPayout(driver.id))
    );

    const successful = results.filter((r) => r.success && (r.amount || 0) > 0).length;
    const failed = results.filter((r) => !r.success || (r.amount || 0) === 0).length;

    console.log(`✅ Weekly payout process completed: ${successful} successful, ${failed} skipped/failed`);

    return {
      total: drivers.length,
      successful,
      failed,
      results,
    };
  } catch (error: any) {
    console.error('❌ Error in weekly payout process:', error);
    throw error;
  }
}

/**
 * Initialize weekly payout scheduler
 * This should be called from the main server file
 */
export function initializeWeeklyPayoutScheduler() {
  // Run weekly payouts every Monday at 9:00 AM
  const scheduleWeeklyPayouts = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();

    // If it's Monday and 9 AM, run payouts
    if (dayOfWeek === 1 && hour === 9) {
      processWeeklyPayouts().catch((error) => {
        console.error('❌ Scheduled weekly payout failed:', error);
      });
    }
  };

  // Check every hour if it's time to run payouts
  setInterval(scheduleWeeklyPayouts, 60 * 60 * 1000); // Check every hour

  // Also run immediately if it's the right time
  scheduleWeeklyPayouts();

  console.log('📅 Weekly payout scheduler initialized (runs every Monday at 9:00 AM)');
}

/**
 * Update payout status in database based on Stripe webhook events
 * @param stripePayoutId - Stripe payout ID
 * @param status - New status ('paid', 'pending', 'failed', 'canceled', 'in_transit')
 * @param failureCode - Optional failure code
 * @param failureMessage - Optional failure message
 */
export async function updatePayoutStatus(
  stripePayoutId: string,
  status: 'paid' | 'pending' | 'failed' | 'canceled' | 'in_transit' | 'completed',
  failureCode?: string | null,
  failureMessage?: string | null
): Promise<void> {
  try {
    // Map Stripe status to our database status
    let dbStatus: string;
    switch (status) {
      case 'paid':
        dbStatus = 'completed';
        break;
      case 'pending':
      case 'in_transit':
        dbStatus = 'pending';
        break;
      case 'failed':
        dbStatus = 'failed';
        break;
      case 'canceled':
        dbStatus = 'canceled';
        break;
      default:
        dbStatus = status;
    }

    // Update payout record in database
    await prisma.payouts.updateMany({
      where: {
        stripePayoutId: stripePayoutId,
      },
      data: {
        status: dbStatus,
        ...(failureCode && { failureCode }),
        ...(failureMessage && { failureMessage }),
      },
    });

    console.log(`✅ Updated payout status: ${stripePayoutId} -> ${dbStatus}`);
  } catch (error: any) {
    console.error(`❌ Error updating payout status for ${stripePayoutId}:`, error);
    throw error;
  }
}
