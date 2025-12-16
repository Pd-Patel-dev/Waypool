import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import crypto from 'crypto';

const router = express.Router();

// Decrypt PIN (same logic as driver bookings)
const decryptPIN = (encrypted: string): string => {
  const secret = process.env.PIN_ENCRYPTION_SECRET || 'default-secret-key-change-in-production';
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const key = crypto.createHash('sha256').update(secret).digest();
  const decrypted = Buffer.alloc(encryptedBuffer.length);
  for (let i = 0; i < encryptedBuffer.length; i++) {
    const encryptedByte = encryptedBuffer[i];
    const keyByte = key[i % key.length];
    if (encryptedByte !== undefined && keyByte !== undefined) {
      decrypted[i] = encryptedByte ^ keyByte;
    }
  }
  return decrypted.toString();
};

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
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        rides: true,
        users: {
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
    if (booking.rides.status === 'cancelled' || booking.rides.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking for a cancelled or completed ride',
      });
    }

    // Cancel the booking and restore available seats in a transaction (only if booking was confirmed)
    await prisma.$transaction(async (tx) => {
      // Update booking status to cancelled
      await tx.bookings.update({
        where: { id: bookingId },
        data: {
          status: 'cancelled',
        },
      });

      // Only restore seats if the booking was confirmed (not pending)
      // Pending bookings never decremented the available seats
      if (booking.status === 'confirmed') {
        const seatsToRestore = booking.numberOfSeats || 1;
        await tx.rides.update({
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
      await prisma.notifications.create({
        data: {
          driverId: booking.rides.driverId,
          type: 'cancellation',
          title: 'Booking Cancelled',
          message: `${booking.users.fullName} cancelled ${seatsCancelled} seat${seatsCancelled !== 1 ? 's' : ''} on your ride from ${booking.rides.fromAddress} to ${booking.rides.toAddress}`,
          bookingId: booking.id,
          rideId: booking.rides.id,
          isRead: false,
        },
      });
      console.log(`✅ Notification created for driver ${booking.rides.driverId} about booking cancellation ${booking.id}`);
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

/**
 * GET /api/rider/bookings/:id/pickup-pin
 * Get the pickup PIN for a booking (only accessible by the booking's rider)
 * Query params: riderId (required)
 */
router.get('/:id/pickup-pin', async (req: Request, res: Response) => {
  try {
    const bookingIdParam = req.params.id;
    const riderId = req.query.riderId && typeof req.query.riderId === 'string' 
      ? parseInt(req.query.riderId) 
      : null;

    if (!bookingIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required',
      });
    }

    const bookingId = parseInt(bookingIdParam);

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

    // Find the booking
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        riderId: true,
        pickupPinEncrypted: true,
        pickupPinExpiresAt: true,
        pickupStatus: true,
        status: true,
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
        message: 'You do not have permission to view this PIN',
      });
    }

    // Check if booking is confirmed
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'PIN is only available for confirmed bookings',
      });
    }

    // Check if PIN exists
    if (!booking.pickupPinEncrypted) {
      return res.status(404).json({
        success: false,
        message: 'Pickup PIN not found for this booking',
      });
    }

    // Check if PIN is expired
    if (booking.pickupPinExpiresAt && new Date(booking.pickupPinExpiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Pickup PIN has expired',
        expiresAt: booking.pickupPinExpiresAt,
      });
    }

    // Decrypt and return PIN
    try {
      const pin = decryptPIN(booking.pickupPinEncrypted);

      return res.json({
        success: true,
        pin,
        expiresAt: booking.pickupPinExpiresAt,
        pickupStatus: booking.pickupStatus,
      });
    } catch (decryptError) {
      console.error('❌ Error decrypting PIN:', decryptError);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve pickup PIN',
      });
    }
  } catch (error) {
    console.error('❌ Error fetching pickup PIN:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pickup PIN',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

