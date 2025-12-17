import express, { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * GET /api/driver/earnings
 * Get earnings data for a driver
 * Query params: driverId (required)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid driver ID is required',
      });
    }

    // Get all completed rides for this driver
    const completedRides = await prisma.rides.findMany({
      where: {
        driverId: driverId,
        status: 'completed',
      },
      include: {
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'completed'], // Include both confirmed and completed bookings
            },
          },
          select: {
            numberOfSeats: true,
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Calculate earnings based on booked seats only
    // Business model: Driver earns based on price per seat × number of booked seats
    let totalEarnings = 0;
    let totalRides = 0;
    let totalSeatsBooked = 0;
    let totalDistance = 0;

    const earningsByDate: { [key: string]: number } = {};
    const rideDetails: Array<{
      rideId: number;
      date: string;
      displayDate?: string;
      from: string;
      to: string;
      seatsBooked: number;
      pricePerSeat: number;
      distance: number;
      earnings: number;
    }> = [];

    completedRides.forEach((ride) => {
      const seatsBooked = ride.bookings.reduce((sum, booking) => sum + (booking.numberOfSeats || 1), 0);
      const distance = ride.distance || 0;
      const pricePerSeat = ride.pricePerSeat || 0;
      
      // Calculate earnings: only based on booked seats
      const rideEarnings = seatsBooked * pricePerSeat;

      totalEarnings += rideEarnings;
      totalRides += 1;
      totalSeatsBooked += seatsBooked;
      totalDistance += distance;

      // Group by date (formatted for display)
      const displayDate = new Date(ride.updatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      earningsByDate[displayDate] = (earningsByDate[displayDate] || 0) + rideEarnings;

      // Add to ride details with ISO date for proper parsing
      rideDetails.push({
        rideId: ride.id,
        date: ride.updatedAt.toISOString(), // Use ISO format for easy parsing
        displayDate: displayDate, // Keep formatted date for display
        from: ride.fromCity || ride.fromAddress,
        to: ride.toCity || ride.toAddress,
        seatsBooked,
        pricePerSeat: parseFloat(pricePerSeat.toFixed(2)),
        distance,
        earnings: parseFloat(rideEarnings.toFixed(2)),
      });
    });

    // Calculate average earnings per ride
    const averageEarnings = totalRides > 0 ? totalEarnings / totalRides : 0;

    // Get this week's earnings
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeekRides = completedRides.filter(
      (ride) => new Date(ride.updatedAt) >= oneWeekAgo
    );

    const thisWeekEarnings = thisWeekRides.reduce((sum, ride) => {
      const seatsBooked = ride.bookings.reduce((s, b) => s + (b.numberOfSeats || 1), 0);
      const pricePerSeat = ride.pricePerSeat || 0;
      return sum + (seatsBooked * pricePerSeat);
    }, 0);

    // Get this month's earnings
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const thisMonthRides = completedRides.filter(
      (ride) => new Date(ride.updatedAt) >= oneMonthAgo
    );

    const thisMonthEarnings = thisMonthRides.reduce((sum, ride) => {
      const seatsBooked = ride.bookings.reduce((s, b) => s + (b.numberOfSeats || 1), 0);
      const pricePerSeat = ride.pricePerSeat || 0;
      return sum + (seatsBooked * pricePerSeat);
    }, 0);

    console.log(`✅ Calculated earnings for driver ${driverId}: $${totalEarnings.toFixed(2)}`);

    return res.json({
      success: true,
      earnings: {
        total: parseFloat(totalEarnings.toFixed(2)),
        totalRides,
        totalSeatsBooked,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        averagePerRide: parseFloat(averageEarnings.toFixed(2)),
        thisWeek: parseFloat(thisWeekEarnings.toFixed(2)),
        thisMonth: parseFloat(thisMonthEarnings.toFixed(2)),
        byDate: earningsByDate,
        recentRides: rideDetails.slice(0, 10), // Last 10 rides
        currency: 'USD',
      },
    });
  } catch (error) {
    console.error('❌ Error calculating earnings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate earnings',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/driver/earnings/summary
 * Get earnings summary (quick overview)
 * Query params: driverId (required)
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid driver ID is required',
      });
    }

    // Quick count of completed rides
    const completedCount = await prisma.rides.count({
      where: {
        driverId: driverId,
        status: 'completed',
      },
    });

    // Get rides this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeekCount = await prisma.rides.count({
      where: {
        driverId: driverId,
        status: 'completed',
        updatedAt: {
          gte: oneWeekAgo,
        },
      },
    });

    return res.json({
      success: true,
      summary: {
        totalRides: completedCount,
        thisWeekRides: thisWeekCount,
        // Estimated earnings (will be calculated with full endpoint)
        estimatedTotal: completedCount * 25, // Rough estimate: $25 per ride
        estimatedThisWeek: thisWeekCount * 25,
      },
    });
  } catch (error) {
    console.error('❌ Error getting earnings summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get earnings summary',
    });
  }
});

export default router;

