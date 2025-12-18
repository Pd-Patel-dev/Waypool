import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import type { Prisma } from '@prisma/client';

const router = express.Router();

/**
 * POST /api/driver/ratings
 * Submit a rating for a passenger
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { rideId, bookingId, driverId, riderId, rating, feedback } = req.body;

    // Validate required fields
    if (!rideId || !driverId || !riderId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rideId, driverId, riderId, rating',
      });
    }

    // Validate rating value (1-5)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5',
      });
    }

    // Verify ride exists and belongs to driver
    // Type-safe Prisma query with conditional include
    type RideWithBookings = Prisma.ridesGetPayload<{
      include: {
        bookings: {
          include: {
            users: {
              select: {
                id: true;
              };
            };
          };
        };
      };
    }>;
    
    const ride = await prisma.rides.findUnique({
      where: { id: parseInt(rideId) },
      include: {
        bookings: bookingId ? {
          where: { id: parseInt(bookingId) },
          include: {
            users: {
              select: {
                id: true,
              },
            },
          },
        } : {
          include: {
            users: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    }) as RideWithBookings | null;

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    if (ride.driverId !== parseInt(driverId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only rate passengers on your own rides',
      });
    }

    // Verify booking exists and belongs to the rider (if bookingId provided)
    if (bookingId) {
      const booking = ride.bookings.find((b) => b.id === parseInt(bookingId));
      if (!booking || booking.riderId !== parseInt(riderId)) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or does not belong to the specified rider',
        });
      }
    }

    // Check if rating already exists (use findFirst since bookingId can be null)
    const existingRating = await prisma.ratings.findFirst({
      where: {
        rideId: parseInt(rideId),
        bookingId: bookingId ? parseInt(bookingId) : null,
        raterId: parseInt(driverId),
        ratedUserId: parseInt(riderId),
      },
    });

    if (existingRating) {
      // Update existing rating
      const updated = await prisma.ratings.update({
        where: { id: existingRating.id },
        data: {
          rating: parseInt(rating),
          feedback: feedback?.trim() || null,
        },
      });

      return res.json({
        success: true,
        message: 'Rating updated successfully',
        rating: updated,
      });
    }

    // Create new rating
    const newRating = await prisma.ratings.create({
      data: {
        rideId: parseInt(rideId),
        bookingId: bookingId ? parseInt(bookingId) : null,
        raterId: parseInt(driverId),
        ratedUserId: parseInt(riderId),
        rating: parseInt(rating),
        feedback: feedback?.trim() || null,
      },
    });

    return res.json({
      success: true,
      message: 'Rating submitted successfully',
      rating: newRating,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit rating';
    console.error('❌ Error submitting rating:', error);
    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * GET /api/driver/ratings/ride/:rideId
 * Get all ratings for a specific ride
 */
router.get('/ride/:rideId', async (req: Request, res: Response) => {
  try {
    const rideIdParam = req.params.rideId;
    if (!rideIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID is required',
      });
    }
    
    const rideId = parseInt(rideIdParam);
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (isNaN(rideId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      });
    }

    // Verify ride exists and belongs to driver (if driverId provided)
    const ride = await prisma.rides.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    if (driverId && ride.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view ratings for this ride',
      });
    }

    // Get all ratings for this ride
    const ratings = await prisma.ratings.findMany({
      where: { rideId },
      include: {
        rater: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
        ratedUser: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      success: true,
      ratings,
    });
  } catch (error: unknown) {
    console.error('❌ Error fetching ratings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings',
    });
  }
});

export default router;

