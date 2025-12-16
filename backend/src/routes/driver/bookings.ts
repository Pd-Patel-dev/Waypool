import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = express.Router();

// Generate a random 4-digit PIN (0000-9999, avoiding weak codes like 0000)
const generatePickupPIN = (): string => {
  let pin = '0000';
  // Generate random PIN, retry if it's too weak
  while (pin === '0000' || pin === '1111' || pin === '1234' || pin === '9999') {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  }
  return pin;
};

// Encrypt PIN for temporary storage (simple XOR encryption with server secret)
const encryptPIN = (pin: string): string => {
  const secret = process.env.PIN_ENCRYPTION_SECRET || 'default-secret-key-change-in-production';
  const buffer = Buffer.from(pin);
  const key = crypto.createHash('sha256').update(secret).digest();
  const encrypted = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const bufferByte = buffer[i];
    const keyByte = key[i % key.length];
    if (bufferByte !== undefined && keyByte !== undefined) {
      encrypted[i] = bufferByte ^ keyByte;
    }
  }
  return encrypted.toString('base64');
};

// Decrypt PIN
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

    // Verify that the ride belongs to this driver
    if (booking.rides.driverId !== driverId) {
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
    if (booking.rides.availableSeats < booking.numberOfSeats) {
      return res.status(400).json({
        success: false,
        message: `Not enough available seats. Only ${booking.rides.availableSeats} seat${booking.rides.availableSeats !== 1 ? 's' : ''} available.`,
      });
    }

    // Generate PIN for pickup verification
    const pickupPIN = generatePickupPIN();
    const pickupPINHash = await bcrypt.hash(pickupPIN, 10);
    const pickupPINEncrypted = encryptPIN(pickupPIN);
    
    // Set expiry to 24 hours from now (or until ride ends - whichever is later)
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Accept the booking and decrement available seats in a transaction
    await prisma.$transaction(async (tx) => {
      // Update booking status to confirmed and set PIN
      await tx.bookings.update({
        where: { id: bookingId },
        data: {
          status: 'confirmed',
          pickupStatus: 'pending',
          pickupPinHash: pickupPINHash,
          pickupPinEncrypted: pickupPINEncrypted,
          pickupPinExpiresAt: expiryDate,
          pickupPinAttempts: 0,
        },
      });

      // Decrement available seats
      await tx.rides.update({
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
      await prisma.notifications.create({
        data: {
          driverId: booking.rides.driverId,
          type: 'message',
          title: 'Booking Accepted',
          message: `Your ride request has been accepted by ${booking.rides.driverName}`,
          bookingId: booking.id,
          rideId: booking.rides.id,
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

    // Verify that the ride belongs to this driver
    if (booking.rides.driverId !== driverId) {
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
    await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: 'rejected',
      },
    });

    // Create notification for the rider
    try {
      await prisma.notifications.create({
        data: {
          driverId: booking.rides.driverId,
          type: 'message',
          title: 'Booking Rejected',
          message: `Your ride request has been rejected by ${booking.rides.driverName}`,
          bookingId: booking.id,
          rideId: booking.rides.id,
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

/**
 * PUT /api/driver/bookings/:id/pickup-complete
 * Mark a passenger as picked up after verifying PIN
 * Query params: driverId (required)
 * Body: { pin: "1234" }
 */
router.put('/:id/pickup-complete', async (req: Request, res: Response) => {
  try {
    const bookingIdParam = req.params.id;
    const { pin } = req.body;
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
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

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Validate PIN
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'PIN is required',
      });
    }

    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits',
      });
    }

    // Find the booking with ride information
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

    // Verify that the ride belongs to this driver
    if (booking.rides.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark this passenger as picked up',
      });
    }

    // Check if ride is started/active
    if (booking.rides.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Ride must be started before marking passengers as picked up',
      });
    }

    // Check if already picked up (idempotent)
    if (booking.pickupStatus === 'picked_up') {
      return res.json({
        success: true,
        message: 'Passenger already marked as picked up',
        booking: {
          id: booking.id,
          pickupStatus: booking.pickupStatus,
          pickedUpAt: booking.pickedUpAt,
        },
      });
    }

    // Check if PIN is expired
    if (booking.pickupPinExpiresAt && new Date(booking.pickupPinExpiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Pickup PIN has expired',
      });
    }

    // Check if locked due to too many attempts
    const now = new Date();
    if (booking.pickupPinLockedUntil && new Date(booking.pickupPinLockedUntil) > now) {
      const minutesRemaining = Math.ceil((new Date(booking.pickupPinLockedUntil).getTime() - now.getTime()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}`,
      });
    }

    // Check rate limit / lockout
    if (booking.pickupPinAttempts >= 5) {
      const lockoutUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
      await prisma.bookings.update({
        where: { id: bookingId },
        data: {
          pickupPinLockedUntil: lockoutUntil,
        },
      });
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please try again in 10 minutes',
      });
    }

    // Verify PIN
    if (!booking.pickupPinHash) {
      return res.status(400).json({
        success: false,
        message: 'No pickup PIN set for this booking',
      });
    }

    const isPINValid = await bcrypt.compare(pin, booking.pickupPinHash);

    if (!isPINValid) {
      // Increment attempts
      const newAttempts = booking.pickupPinAttempts + 1;
      const updateData: any = {
        pickupPinAttempts: newAttempts,
      };

      // Lock if 5 attempts reached
      if (newAttempts >= 5) {
        updateData.pickupPinLockedUntil = new Date(now.getTime() + 10 * 60 * 1000);
      }

      await prisma.bookings.update({
        where: { id: bookingId },
        data: updateData,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid PIN',
        attemptsRemaining: Math.max(0, 5 - newAttempts),
      });
    }

    // PIN is valid - mark as picked up
    const updatedBooking = await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        pickupStatus: 'picked_up',
        pickedUpAt: now,
        pickupPinAttempts: 0,
        pickupPinLockedUntil: null,
      },
      select: {
        id: true,
        pickupStatus: true,
        pickedUpAt: true,
        users: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    console.log(`✅ Passenger ${booking.users.fullName} marked as picked up for booking ${bookingId}`);

    return res.json({
      success: true,
      message: 'Passenger marked as picked up successfully',
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('❌ Error marking passenger as picked up:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark passenger as picked up',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

