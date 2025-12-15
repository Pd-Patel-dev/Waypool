import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * PUT /api/rider/bookings/:id/cancel
 * Cancel a booking by ID
 * Query params: riderId (required for security)
 */
router.put('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const bookingIdParam = req.params.id;
    if (!bookingIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
      });
    }

    const bookingId = parseInt(bookingIdParam);
    const riderId = req.query.riderId && typeof req.query.riderId === 'string' 
      ? parseInt(req.query.riderId) 
      : null;

    if (isNaN(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
      });
    }

    if (!riderId || isNaN(riderId)) {
      return res.status(400).json({
        success: false,
        message: 'Rider ID is required',
      });
    }

    // Find the booking first to verify ownership
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

    // Verify that the booking belongs to this rider
    if (booking.riderId !== riderId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this booking',
      });
    }

    // Check if booking is already cancelled or rejected
    if (booking.status === 'cancelled' || booking.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.status === 'cancelled' ? 'cancelled' : 'rejected'}`,
      });
    }

    // Check if booking is completed
    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking',
      });
    }

    // Check if the ride is already cancelled or completed
    if (booking.ride.status === 'cancelled' || booking.ride.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking for a cancelled or completed ride',
      });
    }

    // Cancel the booking and restore available seats in a transaction (only if booking was confirmed)
    await prisma.$transaction(async (tx) => {
      // Update booking status to cancelled
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
        },
      });

      // Only restore seats if the booking was confirmed (not pending)
      // Pending bookings never decremented the available seats
      if (booking.status === 'confirmed') {
        const seatsToRestore = booking.numberOfSeats || 1;
        await tx.ride.update({
          where: { id: booking.rideId },
          data: {
            availableSeats: {
              increment: seatsToRestore,
            },
          },
        });
      }
    });

    // Create notification for the driver
    try {
      const seatsCancelled = booking.numberOfSeats || 1;
      await prisma.notification.create({
        data: {
          driverId: booking.ride.driverId,
          type: 'cancellation',
          title: 'Booking Cancelled',
          message: `${booking.rider.fullName} cancelled ${seatsCancelled} seat${seatsCancelled !== 1 ? 's' : ''} on your ride from ${booking.ride.fromAddress} to ${booking.ride.toAddress}`,
          bookingId: booking.id,
          rideId: booking.ride.id,
          isRead: false,
        },
      });
      console.log(`✅ Notification created for driver ${booking.ride.driverId} about booking cancellation ${booking.id}`);
    } catch (notificationError) {
      // Don't fail the cancellation if notification creation fails
      console.error('❌ Error creating cancellation notification:', notificationError);
    }

    console.log(`✅ Booking ${bookingId} cancelled by rider ${riderId}`);

    return res.json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error) {
    console.error('❌ Error cancelling booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

