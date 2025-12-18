import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { stripe } from '../../lib/stripe';

const router = express.Router();

/**
 * GET /api/rider/rides/upcoming
 * Get all available upcoming rides for riders to book
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    // Get all scheduled rides that have available seats
    const rides = await prisma.rides.findMany({
      where: {
        status: 'scheduled',
        availableSeats: {
          gt: 0, // Only rides with available seats
        },
      },
      include: {
        users: {
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
          id: ride.users.id,
          fullName: ride.users.fullName,
          email: ride.users.email,
          phoneNumber: ride.users.phoneNumber,
          photoUrl: ride.users.photoUrl,
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
    const { rideId, riderId, pickupAddress, pickupCity, pickupState, pickupZipCode, pickupLatitude, pickupLongitude, numberOfSeats, paymentMethodId } = req.body;

    // Validate required fields
    if (!rideId || !riderId || !pickupAddress || pickupLatitude === undefined || pickupLongitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: rideId, riderId, pickupAddress, pickupLatitude, pickupLongitude',
      });
    }

    const seatsToBook = numberOfSeats || 1;

    // Find the ride
    const ride = await prisma.rides.findUnique({
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
    const existingBooking = await prisma.bookings.findFirst({
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

    // Calculate total amount
    const totalAmount = Math.round((seatsToBook * ride.pricePerSeat) * 100); // Convert to cents

    // Authorize payment if paymentMethodId is provided
    let paymentIntentId: string | null = null;
    if (paymentMethodId && stripe) {
      try {
        // Get rider information for Stripe customer
        const rider = await prisma.users.findUnique({
          where: { id: parseInt(riderId) },
          select: { email: true, fullName: true },
        });

        if (rider) {
          // Get or create Stripe customer (reuse logic from payment.ts)
          let stripeCustomerId: string;
          const customers = await stripe.customers.list({
            email: rider.email,
            limit: 1,
          });
          const existingCustomer = customers.data[0];
          if (existingCustomer) {
            stripeCustomerId = existingCustomer.id;
          } else {
            const customer = await stripe.customers.create({
              email: rider.email,
              name: rider.fullName,
              metadata: { riderId: riderId.toString() },
            });
            stripeCustomerId = customer.id;
          }

          // Create PaymentIntent with manual capture (authorize only)
          const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'usd',
            customer: stripeCustomerId,
            payment_method: paymentMethodId,
            payment_method_types: ['card'], // Only allow card payments (no redirect-based methods)
            capture_method: 'manual', // Authorize but don't capture
            confirmation_method: 'manual',
            confirm: true, // Automatically confirm and authorize
            metadata: {
              bookingId: 'pending', // Will update after booking is created
              rideId: rideId.toString(),
              riderId: riderId.toString(),
              numberOfSeats: seatsToBook.toString(),
            },
          });

          paymentIntentId = paymentIntent.id;
          console.log(`✅ Payment authorized for booking: ${paymentIntentId}, amount: $${(totalAmount / 100).toFixed(2)}`);
        }
      } catch (paymentError: any) {
        console.error('❌ Error authorizing payment:', paymentError);
        return res.status(400).json({
          success: false,
          message: paymentError.message || 'Failed to authorize payment. Please try again.',
        });
      }
    }

    // Create booking as pending (request) - don't decrement seats yet
    const booking = await prisma.bookings.create({
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
        paymentIntentId: paymentIntentId || null,
      },
      include: {
        rides: {
          include: {
            users: {
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

    // Create notification for the driver (as a request)
    try {
      const bookingSeats = booking.numberOfSeats || seatsToBook;
      await prisma.notifications.create({
        data: {
          driverId: booking.rides.driverId,
          type: 'booking',
          title: 'Ride Request',
          message: `${booking.users.fullName} requested ${bookingSeats} seat${bookingSeats !== 1 ? 's' : ''} on your ride from ${booking.rides.fromAddress} to ${booking.rides.toAddress}`,
          bookingId: booking.id,
          rideId: booking.rides.id,
          isRead: false,
        },
      });
      console.log(`✅ Notification created for driver ${booking.rides.driverId} about booking request ${booking.id}`);
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
          id: booking.rides.id,
          fromAddress: booking.rides.fromAddress,
          toAddress: booking.rides.toAddress,
          departureDate: booking.rides.departureDate,
          departureTime: booking.rides.departureTime,
          pricePerSeat: booking.rides.pricePerSeat,
          driver: booking.rides.users,
        },
        rider: booking.users,
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
    const bookings = await prisma.bookings.findMany({
      where: {
        riderId: riderId,
      },
      include: {
        rides: {
          include: {
            users: {
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
      // Type assertion to handle Prisma include types
      const bookingWithRide = booking as typeof booking & {
        rides: {
          id: number;
          driverName: string;
          driverPhone: string;
          fromAddress: string;
          toAddress: string;
          fromCity: string;
          toCity: string;
          fromLatitude: number;
          fromLongitude: number;
          toLatitude: number;
          toLongitude: number;
          departureDate: string;
          departureTime: string;
          pricePerSeat: number;
          distance: number | null;
          status: string;
          carMake: string | null;
          carModel: string | null;
          carYear: number | null;
          carColor: string | null;
          users: {
            id: number;
            fullName: string;
            email: string;
            phoneNumber: string;
            photoUrl: string | null;
          };
        };
      };

      const departureISO = parseDateTimeToISO(bookingWithRide.rides.departureDate, bookingWithRide.rides.departureTime);
      const departureDate = new Date(departureISO);
      // isPast should only check date, not status - status should be checked separately
      const isPast = departureDate < now;

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
          id: bookingWithRide.rides.id,
          driverName: bookingWithRide.rides.driverName,
          driverPhone: bookingWithRide.rides.driverPhone,
          fromAddress: bookingWithRide.rides.fromAddress,
          toAddress: bookingWithRide.rides.toAddress,
          fromCity: bookingWithRide.rides.fromCity,
          toCity: bookingWithRide.rides.toCity,
          fromLatitude: bookingWithRide.rides.fromLatitude,
          fromLongitude: bookingWithRide.rides.fromLongitude,
          toLatitude: bookingWithRide.rides.toLatitude,
          toLongitude: bookingWithRide.rides.toLongitude,
          departureTime: departureISO,
          pricePerSeat: bookingWithRide.rides.pricePerSeat,
          distance: bookingWithRide.rides.distance,
          status: bookingWithRide.rides.status,
          carMake: bookingWithRide.rides.carMake,
          carModel: bookingWithRide.rides.carModel,
          carYear: bookingWithRide.rides.carYear,
          carColor: bookingWithRide.rides.carColor,
          driver: {
            id: bookingWithRide.rides.users.id,
            fullName: bookingWithRide.rides.users.fullName,
            email: bookingWithRide.rides.users.email,
            phoneNumber: bookingWithRide.rides.users.phoneNumber,
            photoUrl: bookingWithRide.rides.users.photoUrl,
          },
        },
      };
    });

    return res.json({
      success: true,
      bookings: formattedBookings,
    });
  } catch (error: any) {
    console.error('❌ Error fetching bookings:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to fetch bookings',
      bookings: [],
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
});

export default router;

