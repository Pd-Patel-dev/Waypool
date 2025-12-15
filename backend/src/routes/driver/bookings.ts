import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * PUT /api/driver/bookings/:id/accept
 * Accept a booking request
 * Query params: driverId (required for security)
 */
router.put('/:id/accept', async (req: Request, res: Response) => {
  try {
    const bookingIdParam = req.params.id;
    if (!bookingIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
      });
    }

    const bookingId = parseInt(bookingIdParam);
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;

    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
      });
    }

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Find the booking with ride information
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ride: true,
        rider: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify that the ride belongs to this driver
    if (booking.ride.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to accept this booking',
      });
    }

    // Check if booking is already confirmed or rejected
    if (booking.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already confirmed',
      });
    }

    if (booking.status === 'rejected' || booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot accept a rejected or cancelled booking',
      });
    }

    // Check if ride still has available seats
    if (booking.ride.availableSeats < booking.numberOfSeats) {
      return res.status(400).json({
        success: false,
        message: `Not enough available seats. Only ${booking.ride.availableSeats} seat${booking.ride.availableSeats !== 1 ? 's' : ''} available.`,
      });
    }

    // Accept the booking and decrement available seats in a transaction
    await prisma.$transaction(async (tx) => {
      // Update booking status to confirmed
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'confirmed',
        },
      });

      // Decrement available seats
      await tx.ride.update({
        where: { id: booking.rideId },
        data: {
          availableSeats: {
            decrement: booking.numberOfSeats,
          },
        },
      });
    });

    // Create notification for the rider
    try {
      await prisma.notification.create({
        data: {
          driverId: booking.ride.driverId,
          type: 'message',
          title: 'Booking Accepted',
          message: `Your ride request has been accepted by ${booking.ride.driverName}`,
          bookingId: booking.id,
          rideId: booking.ride.id,
          isRead: false,
        },
      });
    } catch (notificationError) {
      console.error('❌ Error creating acceptance notification:', notificationError);
    }

    console.log(`✅ Booking ${bookingId} accepted by driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Booking request accepted successfully',
    });
  } catch (error) {
    console.error('❌ Error accepting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept booking',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/driver/bookings/:id/reject
 * Reject a booking request
 * Query params: driverId (required for security)
 */
router.put('/:id/reject', async (req: Request, res: Response) => {
  try {
    const bookingIdParam = req.params.id;
    if (!bookingIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
      });
    }

    const bookingId = parseInt(bookingIdParam);
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;

    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
      });
    }

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Find the booking with ride information
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        ride: true,
        rider: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify that the ride belongs to this driver
    if (booking.ride.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reject this booking',
      });
    }

    // Check if booking is already confirmed, rejected, or cancelled
    if (booking.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject a confirmed booking',
      });
    }

    if (booking.status === 'rejected' || booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already rejected or cancelled',
      });
    }

    // Reject the booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'rejected',
      },
    });

    // Create notification for the rider
    try {
      await prisma.notification.create({
        data: {
          driverId: booking.ride.driverId,
          type: 'message',
          title: 'Booking Rejected',
          message: `Your ride request has been rejected by ${booking.ride.driverName}`,
          bookingId: booking.id,
          rideId: booking.ride.id,
          isRead: false,
        },
      });
    } catch (notificationError) {
      console.error('❌ Error creating rejection notification:', notificationError);
    }

    console.log(`✅ Booking ${bookingId} rejected by driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Booking request rejected successfully',
    });
  } catch (error) {
    console.error('❌ Error rejecting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject booking',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

