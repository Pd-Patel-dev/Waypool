import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * GET /api/rider/rides/upcoming
 * Get all available upcoming rides for riders to book
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    // Get all scheduled rides that have available seats
    const rides = await prisma.ride.findMany({
      where: {
        status: 'scheduled',
        availableSeats: {
          gt: 0, // Only rides with available seats
        },
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            photoUrl: true,
            carMake: true,
            carModel: true,
            carYear: true,
            carColor: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Helper function to parse date and time to ISO string
    const parseDateTimeToISO = (dateStr: string, timeStr: string): string => {
      try {
        // Parse MM/DD/YYYY format
        const dateParts = dateStr.split('/').map(Number);
        if (dateParts.length !== 3) return new Date().toISOString();
        
        const [month, day, year] = dateParts;
        if (!month || !day || !year) return new Date().toISOString();
        
        // Parse time with AM/PM
        const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!timeMatch || !timeMatch[1] || !timeMatch[2] || !timeMatch[3]) {
          return new Date().toISOString();
        }
        
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const meridiem = timeMatch[3].toUpperCase();
        
        // Convert to 24-hour format
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        
        const date = new Date(year, month - 1, day, hours, minutes);
        return date.toISOString();
      } catch (error) {
        console.error('Error parsing date/time:', error);
        return new Date().toISOString();
      }
    };
    
    // Transform rides to match the frontend format
    const formattedRides = rides.map((ride) => {
      const departureISO = parseDateTimeToISO(ride.departureDate, ride.departureTime);
      
      return {
        id: ride.id,
        driverName: ride.driverName,
        driverPhone: ride.driverPhone,
        fromAddress: ride.fromAddress,
        toAddress: ride.toAddress,
        fromCity: ride.fromCity,
        toCity: ride.toCity,
        fromLatitude: ride.fromLatitude,
        fromLongitude: ride.fromLongitude,
        toLatitude: ride.toLatitude,
        toLongitude: ride.toLongitude,
        departureTime: departureISO,
        availableSeats: ride.availableSeats,
        totalSeats: ride.availableSeats,
        price: ride.pricePerSeat,
        status: ride.status,
        distance: ride.distance,
        carMake: ride.carMake,
        carModel: ride.carModel,
        carYear: ride.carYear,
        carColor: ride.carColor,
        driver: {
          id: ride.driver.id,
          fullName: ride.driver.fullName,
          email: ride.driver.email,
          phoneNumber: ride.driver.phoneNumber,
          photoUrl: ride.driver.photoUrl,
        },
      };
    });

    return res.json({
      success: true,
      rides: formattedRides,
    });
  } catch (error) {
    console.error('❌ Error fetching rides:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch rides',
      rides: [],
    });
  }
});

/**
 * POST /api/rider/rides/book
 * Book a seat on a ride
 */
router.post('/book', async (req: Request, res: Response) => {
  try {
    const { rideId, riderId, pickupAddress, pickupCity, pickupState, pickupZipCode, pickupLatitude, pickupLongitude, numberOfSeats } = req.body;

    // Validate required fields
    if (!rideId || !riderId || !pickupAddress || pickupLatitude === undefined || pickupLongitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rideId, riderId, pickupAddress, pickupLatitude, pickupLongitude',
      });
    }

    const seatsToBook = numberOfSeats || 1;

    // Find the ride
    const ride = await prisma.ride.findUnique({
      where: { id: parseInt(rideId) },
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if ride has available seats
    if (ride.availableSeats <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No available seats on this ride',
      });
    }

    // Validate number of seats requested
    if (seatsToBook > ride.availableSeats) {
      return res.status(400).json({
        success: false,
        message: `Only ${ride.availableSeats} seat${ride.availableSeats !== 1 ? 's' : ''} available on this ride`,
      });
    }

    if (seatsToBook < 1) {
      return res.status(400).json({
        success: false,
        message: 'Number of seats must be at least 1',
      });
    }

    // Check if rider already has a pending or confirmed booking for this ride
    const existingBooking = await prisma.booking.findFirst({
      where: {
        rideId: parseInt(rideId),
        riderId: parseInt(riderId),
        status: {
          in: ['pending', 'confirmed'],
        },
      },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: existingBooking.status === 'pending' 
          ? 'You already have a pending request for this ride'
          : 'You already have a confirmed booking for this ride',
      });
    }

    // Generate confirmation number (format: WP-YYYYMMDD-XXXXXX)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const confirmationNumber = `WP-${dateStr}-${randomStr}`;

    // Create booking as pending (request) - don't decrement seats yet
    const booking = await prisma.booking.create({
      data: {
        rideId: parseInt(rideId),
        riderId: parseInt(riderId),
        confirmationNumber,
        pickupAddress,
        pickupCity: pickupCity || null,
        pickupState: pickupState || null,
        pickupZipCode: pickupZipCode || null,
        pickupLatitude: parseFloat(pickupLatitude),
        pickupLongitude: parseFloat(pickupLongitude),
        numberOfSeats: seatsToBook,
        status: 'pending', // Start as pending request
      },
      include: {
        ride: {
          include: {
            driver: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                photoUrl: true,
              },
            },
          },
        },
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

    // Create notification for the driver (as a request)
    try {
      const bookingSeats = booking.numberOfSeats || seatsToBook;
      await prisma.notification.create({
        data: {
          driverId: booking.ride.driverId,
          type: 'booking',
          title: 'Ride Request',
          message: `${booking.rider.fullName} requested ${bookingSeats} seat${bookingSeats !== 1 ? 's' : ''} on your ride from ${booking.ride.fromAddress} to ${booking.ride.toAddress}`,
          bookingId: booking.id,
          rideId: booking.ride.id,
          isRead: false,
        },
      });
      console.log(`✅ Notification created for driver ${booking.ride.driverId} about booking request ${booking.id}`);
    } catch (notificationError) {
      // Don't fail the booking if notification creation fails
      console.error('❌ Error creating notification:', notificationError);
    }

    return res.json({
      success: true,
      message: 'Ride request sent successfully. Waiting for driver approval.',
      booking: {
        id: booking.id,
        confirmationNumber: booking.confirmationNumber,
        pickupAddress: booking.pickupAddress,
        pickupCity: booking.pickupCity,
        pickupState: booking.pickupState,
        numberOfSeats: booking.numberOfSeats || seatsToBook,
        status: booking.status,
        createdAt: booking.createdAt,
        ride: {
          id: booking.ride.id,
          fromAddress: booking.ride.fromAddress,
          toAddress: booking.ride.toAddress,
          departureDate: booking.ride.departureDate,
          departureTime: booking.ride.departureTime,
          pricePerSeat: booking.ride.pricePerSeat,
          driver: booking.ride.driver,
        },
        rider: booking.rider,
      },
    });
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking',
    });
  }
});

/**
 * GET /api/rider/rides/bookings
 * Get all bookings for a rider
 * Query params: riderId (required)
 */
router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const riderId = req.query.riderId && typeof req.query.riderId === 'string' 
      ? parseInt(req.query.riderId) 
      : null;

    if (!riderId || isNaN(riderId)) {
      return res.status(400).json({
        success: false,
        message: 'Rider ID is required',
        bookings: [],
      });
    }

    // Get all bookings for this rider
    const bookings = await prisma.booking.findMany({
      where: {
        riderId: riderId,
      },
      include: {
        ride: {
          include: {
            driver: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                photoUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Helper function to parse date and time to ISO string
    const parseDateTimeToISO = (dateStr: string, timeStr: string): string => {
      try {
        // Parse MM/DD/YYYY format
        const dateParts = dateStr.split('/').map(Number);
        if (dateParts.length !== 3) return new Date().toISOString();
        
        const [month, day, year] = dateParts;
        if (!month || !day || !year) return new Date().toISOString();
        
        // Parse time with AM/PM
        const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!timeMatch || !timeMatch[1] || !timeMatch[2] || !timeMatch[3]) {
          return new Date().toISOString();
        }
        
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const meridiem = timeMatch[3].toUpperCase();
        
        // Convert to 24-hour format
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        
        const date = new Date(year, month - 1, day, hours, minutes);
        return date.toISOString();
      } catch (error) {
        console.error('Error parsing date/time:', error);
        return new Date().toISOString();
      }
    };

    // Transform bookings to match the frontend format
    const now = new Date();
    const formattedBookings = bookings.map((booking) => {
      const departureISO = parseDateTimeToISO(booking.ride.departureDate, booking.ride.departureTime);
      const departureDate = new Date(departureISO);
      const isPast = departureDate < now || booking.ride.status === 'completed' || booking.ride.status === 'cancelled';

      return {
        id: booking.id,
        confirmationNumber: booking.confirmationNumber,
        numberOfSeats: (booking as any).numberOfSeats || 1,
        pickupAddress: booking.pickupAddress,
        pickupCity: booking.pickupCity,
        pickupState: booking.pickupState,
        pickupZipCode: booking.pickupZipCode,
        pickupLatitude: booking.pickupLatitude,
        pickupLongitude: booking.pickupLongitude,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
        isPast: isPast,
        ride: {
          id: booking.ride.id,
          driverName: booking.ride.driverName,
          driverPhone: booking.ride.driverPhone,
          fromAddress: booking.ride.fromAddress,
          toAddress: booking.ride.toAddress,
          fromCity: booking.ride.fromCity,
          toCity: booking.ride.toCity,
          fromLatitude: booking.ride.fromLatitude,
          fromLongitude: booking.ride.fromLongitude,
          toLatitude: booking.ride.toLatitude,
          toLongitude: booking.ride.toLongitude,
          departureTime: departureISO,
          pricePerSeat: booking.ride.pricePerSeat,
          distance: booking.ride.distance,
          status: booking.ride.status,
          carMake: booking.ride.carMake,
          carModel: booking.ride.carModel,
          carYear: booking.ride.carYear,
          carColor: booking.ride.carColor,
          driver: {
            id: booking.ride.driver.id,
            fullName: booking.ride.driver.fullName,
            email: booking.ride.driver.email,
            phoneNumber: booking.ride.driver.phoneNumber,
            photoUrl: booking.ride.driver.photoUrl,
          },
        },
      };
    });

    return res.json({
      success: true,
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      bookings: [],
    });
  }
});

export default router;

