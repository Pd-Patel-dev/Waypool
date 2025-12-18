import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * GET /api/rider/tracking/:rideId
 * Get driver location for an active ride
 * Query params: riderId (required for security)
 */
router.get('/:rideId', async (req: Request, res: Response) => {
  try {
    const rideIdParam = req.params.rideId;
    const riderId = req.query.riderId && typeof req.query.riderId === 'string' 
      ? parseInt(req.query.riderId) 
      : null;

    if (!rideIdParam || isNaN(parseInt(rideIdParam))) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID is required',
      });
    }

    if (!riderId || isNaN(riderId)) {
      return res.status(400).json({
        success: false,
        message: 'Rider ID is required',
      });
    }

    const rideId = parseInt(rideIdParam);

    // Find the ride with driver and booking info
    const ride = await prisma.rides.findUnique({
      where: { id: rideId },
      include: {
        users: {
          select: {
            id: true,
            lastLocationLatitude: true,
            lastLocationLongitude: true,
            lastLocationUpdate: true,
          },
        },
        bookings: {
          where: {
            riderId: riderId,
            status: {
              in: ['confirmed', 'completed'], // Can track for confirmed or completed bookings
            },
          },
          select: {
            id: true,
            pickupLatitude: true,
            pickupLongitude: true,
            pickupAddress: true,
            pickupStatus: true,
          },
        },
      },
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Verify rider has a booking for this ride
    if (!ride.bookings || ride.bookings.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a booking for this ride',
      });
    }

    const booking = ride.bookings[0];
    if (!booking) {
      return res.status(403).json({
        success: false,
        message: 'You do not have a booking for this ride',
      });
    }


    // Return driver location if available
    if (ride.users.lastLocationLatitude && ride.users.lastLocationLongitude) {
      return res.json({
        success: true,
        driverLocation: {
          latitude: ride.users.lastLocationLatitude,
          longitude: ride.users.lastLocationLongitude,
          updatedAt: ride.users.lastLocationUpdate?.toISOString() || null,
        },
        pickupLocation: {
          latitude: booking.pickupLatitude,
          longitude: booking.pickupLongitude,
          address: booking.pickupAddress,
        },
        ride: {
          id: ride.id,
          status: ride.status,
          fromLatitude: ride.fromLatitude,
          fromLongitude: ride.fromLongitude,
          toLatitude: ride.toLatitude,
          toLongitude: ride.toLongitude,
        },
        booking: {
          id: booking.id,
          pickupStatus: booking.pickupStatus,
        },
      });
    } else {
      // Driver location not available yet
      return res.json({
        success: true,
        driverLocation: null,
        pickupLocation: {
          latitude: booking.pickupLatitude,
          longitude: booking.pickupLongitude,
          address: booking.pickupAddress,
        },
        ride: {
          id: ride.id,
          status: ride.status,
          fromLatitude: ride.fromLatitude,
          fromLongitude: ride.fromLongitude,
          toLatitude: ride.toLatitude,
          toLongitude: ride.toLongitude,
        },
        booking: {
          id: booking.id,
          pickupStatus: booking.pickupStatus,
        },
      });
    }
  } catch (error) {
    console.error('❌ Error fetching driver location:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch driver location',
    });
  }
});

export default router;

