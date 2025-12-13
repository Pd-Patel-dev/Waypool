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
    const { rideId, riderId, numberOfSeats, pickupAddress, pickupCity, pickupState, pickupZipCode, pickupLatitude, pickupLongitude } = req.body;

    // Validate required fields
    if (!rideId || !riderId || !numberOfSeats || !pickupAddress || pickupLatitude === undefined || pickupLongitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rideId, riderId, numberOfSeats, pickupAddress, pickupLatitude, pickupLongitude',
      });
    }

    // Validate numberOfSeats
    const seats = parseInt(numberOfSeats);
    if (isNaN(seats) || seats < 1) {
      return res.status(400).json({
        success: false,
        message: 'Number of seats must be at least 1',
      });
    }

    const parsedRideId = parseInt(rideId);
    const parsedRiderId = parseInt(riderId);

    // Validate that IDs are valid numbers
    if (isNaN(parsedRideId) || isNaN(parsedRiderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rideId or riderId',
      });
    }

    // Verify rider exists
    const rider = await prisma.user.findUnique({
      where: { id: parsedRiderId },
    });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found. Please ensure you are logged in with a valid account.',
      });
    }

    // Verify rider is actually a rider
    if (!rider.isRider) {
      return res.status(400).json({
        success: false,
        message: 'User account is not set up as a rider',
      });
    }

    // Find the ride
    const ride = await prisma.ride.findUnique({
      where: { id: parsedRideId },
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if ride has enough available seats
    if (ride.availableSeats < seats) {
      return res.status(400).json({
        success: false,
        message: `Only ${ride.availableSeats} seat${ride.availableSeats !== 1 ? 's' : ''} available. You requested ${seats} seat${seats !== 1 ? 's' : ''}.`,
      });
    }

    // Check if rider already has a booking for this ride
    const existingBooking = await prisma.booking.findFirst({
      where: {
        rideId: parsedRideId,
        riderId: parsedRiderId,
        status: 'confirmed',
      },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: 'You already have a confirmed booking for this ride',
      });
    }

    // Generate confirmation number (format: WP-YYYYMMDD-XXXXXX)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const confirmationNumber = `WP-${dateStr}-${randomStr}`;

    // Create booking in a transaction
    const booking = await prisma.$transaction(async (tx) => {
      // Create the booking
      const newBooking = await tx.booking.create({
        data: {
          rideId: parsedRideId,
          riderId: parsedRiderId,
          numberOfSeats: seats,
          confirmationNumber,
          pickupAddress,
          pickupCity: pickupCity || null,
          pickupState: pickupState || null,
          pickupZipCode: pickupZipCode || null,
          pickupLatitude: parseFloat(pickupLatitude),
          pickupLongitude: parseFloat(pickupLongitude),
          status: 'confirmed',
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

      // Update ride available seats
      await tx.ride.update({
        where: { id: parsedRideId },
        data: {
          availableSeats: {
            decrement: seats,
          },
        },
      });

      return newBooking;
    });

    return res.json({
      success: true,
      message: 'Booking confirmed successfully',
        booking: {
          id: booking.id,
          confirmationNumber: booking.confirmationNumber,
          numberOfSeats: booking.numberOfSeats,
          pickupAddress: booking.pickupAddress,
          pickupCity: booking.pickupCity,
          pickupState: booking.pickupState,
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
 * GET /api/rider/rides/my-bookings
 * Get all bookings for the current rider
 */
router.get('/my-bookings', async (req: Request, res: Response) => {
  try {
    const { riderId } = req.query;

    if (!riderId) {
      return res.status(400).json({
        success: false,
        message: 'Rider ID is required',
      });
    }

    const parsedRiderId = parseInt(riderId as string);
    if (isNaN(parsedRiderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rider ID',
      });
    }

    // Get all bookings for this rider
    const bookings = await prisma.booking.findMany({
      where: {
        riderId: parsedRiderId,
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
        const dateParts = dateStr.split('/').map(Number);
        if (dateParts.length !== 3) return new Date().toISOString();
        
        const [month, day, year] = dateParts;
        if (!month || !day || !year) return new Date().toISOString();
        
        const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!timeMatch || !timeMatch[1] || !timeMatch[2] || !timeMatch[3]) {
          return new Date().toISOString();
        }
        
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const meridiem = timeMatch[3].toUpperCase();
        
        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
        
        const date = new Date(year, month - 1, day, hours, minutes);
        return date.toISOString();
      } catch (error) {
        console.error('Error parsing date/time:', error);
        return new Date().toISOString();
      }
    };

    // Format bookings
    const formattedBookings = bookings.map((booking) => {
      const departureISO = parseDateTimeToISO(booking.ride.departureDate, booking.ride.departureTime);
      const now = new Date();
      const departureDate = new Date(departureISO);
      
      // Determine if booking is upcoming or past
      const isUpcoming = departureDate > now && booking.status === 'confirmed';
      const isPast = departureDate < now || booking.status === 'completed' || booking.status === 'cancelled';

      return {
        id: booking.id,
        confirmationNumber: booking.confirmationNumber,
        numberOfSeats: booking.numberOfSeats,
        pickupAddress: booking.pickupAddress,
        pickupCity: booking.pickupCity,
        pickupState: booking.pickupState,
        status: booking.status,
        createdAt: booking.createdAt,
        ride: {
          id: booking.ride.id,
          fromAddress: booking.ride.fromAddress,
          toAddress: booking.ride.toAddress,
          fromCity: booking.ride.fromCity,
          toCity: booking.ride.toCity,
          fromLatitude: booking.ride.fromLatitude,
          fromLongitude: booking.ride.fromLongitude,
          toLatitude: booking.ride.toLatitude,
          toLongitude: booking.ride.toLongitude,
          departureTime: departureISO,
          departureDate: booking.ride.departureDate,
          departureTimeStr: booking.ride.departureTime,
          pricePerSeat: booking.ride.pricePerSeat,
          totalPrice: booking.ride.pricePerSeat * booking.numberOfSeats,
          driver: {
            id: booking.ride.driver.id,
            fullName: booking.ride.driver.fullName,
            email: booking.ride.driver.email,
            phoneNumber: booking.ride.driver.phoneNumber,
            photoUrl: booking.ride.driver.photoUrl,
          },
          driverName: booking.ride.driverName,
          driverPhone: booking.ride.driverPhone,
          carMake: booking.ride.carMake,
          carModel: booking.ride.carModel,
          carYear: booking.ride.carYear,
          carColor: booking.ride.carColor,
        },
        isUpcoming,
        isPast,
      };
    });

    // Separate into upcoming and past
    const upcomingBookings = formattedBookings.filter((b) => b.isUpcoming);
    const pastBookings = formattedBookings.filter((b) => b.isPast);

    return res.json({
      success: true,
      bookings: {
        upcoming: upcomingBookings,
        past: pastBookings,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      bookings: {
        upcoming: [],
        past: [],
      },
    });
  }
});

export default router;

