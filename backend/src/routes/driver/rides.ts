import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * POST /api/driver/rides
 * Create a new ride
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      driverId,
      driverName,
      driverPhone,
      carMake,
      carModel,
      carYear,
      carColor,
      fromAddress,
      fromCity,
      fromState,
      fromZipCode,
      fromLatitude,
      fromLongitude,
      toAddress,
      toCity,
      toState,
      toZipCode,
      toLatitude,
      toLongitude,
      departureDate,
      departureTime,
      availableSeats,
      pricePerSeat,
      distance,
    } = req.body;

    // Validate required fields
    if (!driverId || !driverName || !driverPhone) {
      return res.status(400).json({
        success: false,
        message: 'Driver information is required',
      });
    }

    if (!fromAddress || !fromCity || !fromState || !fromLatitude || !fromLongitude) {
      return res.status(400).json({
        success: false,
        message: 'Complete pickup location is required',
      });
    }

    if (!toAddress || !toCity || !toState || !toLatitude || !toLongitude) {
      return res.status(400).json({
        success: false,
        message: 'Complete destination is required',
      });
    }

    if (!departureDate || !departureTime) {
      return res.status(400).json({
        success: false,
        message: 'Departure date and time are required',
      });
    }

    if (!availableSeats || availableSeats < 1 || availableSeats > 8) {
      return res.status(400).json({
        success: false,
        message: 'Available seats must be between 1 and 8',
      });
    }

    if (pricePerSeat === undefined || pricePerSeat < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price per seat must be a positive number',
      });
    }

    // Verify driver exists
    const driver = await prisma.user.findUnique({
      where: { id: parseInt(driverId) },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    // Create the ride
    const ride = await prisma.ride.create({
      data: {
        driverId: parseInt(driverId),
        driverName,
        driverPhone,
        carMake: carMake || null,
        carModel: carModel || null,
        carYear: carYear ? parseInt(carYear) : null,
        carColor: carColor || null,
        fromAddress,
        fromCity,
        fromState,
        fromZipCode: fromZipCode || '',
        fromLatitude: parseFloat(fromLatitude),
        fromLongitude: parseFloat(fromLongitude),
        toAddress,
        toCity,
        toState,
        toZipCode: toZipCode || '',
        toLatitude: parseFloat(toLatitude),
        toLongitude: parseFloat(toLongitude),
        departureDate,
        departureTime,
        availableSeats: parseInt(availableSeats),
        pricePerSeat: parseFloat(pricePerSeat),
        distance: distance ? parseFloat(distance) : null,
        status: 'scheduled',
      },
    });

    console.log('✅ Ride created:', {
      id: ride.id,
      driver: driverName,
      route: `${fromCity} → ${toCity}`,
      distance: distance ? `${distance} mi` : 'N/A',
    });

    // Convert departureDate and departureTime to ISO string
    // Format: "12/09/2025" and "05:10 PM"
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
    
    const departureISO = parseDateTimeToISO(ride.departureDate, ride.departureTime);
    console.log('📅 Converted:', ride.departureDate, ride.departureTime, '→', departureISO);
    
    return res.status(201).json({
      success: true,
      message: 'Ride created successfully',
      ride: {
        id: ride.id,
        fromAddress: ride.fromAddress,
        toAddress: ride.toAddress,
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
      },
    });
  } catch (error) {
    console.error('❌ Error creating ride:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create ride',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/driver/rides/upcoming
 * Get upcoming rides for the driver
 * Query params: driverId (required)
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;
    
    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
        rides: [],
      });
    }

    // Get rides for the specific driver (all statuses except cancelled)
    const rides = await prisma.ride.findMany({
      where: {
        driverId: driverId,
        status: {
          not: 'cancelled', // Show all rides except cancelled ones
        },
      },
      include: {
        bookings: {
          where: {
            status: 'confirmed',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 Found ${rides.length} rides for driver ${driverId}`);

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
      
      // Format bookings as passengers
      const passengers = ride.bookings.map((booking) => ({
        id: booking.id,
        riderId: booking.riderId,
        pickupAddress: booking.pickupAddress,
        pickupCity: booking.pickupCity || '',
        pickupState: booking.pickupState || '',
        pickupZipCode: booking.pickupZipCode || '',
        pickupLatitude: booking.pickupLatitude,
        pickupLongitude: booking.pickupLongitude,
        confirmationNumber: booking.confirmationNumber,
        status: booking.status,
      }));
      
      return {
        id: ride.id,
        fromAddress: ride.fromAddress,
        toAddress: ride.toAddress,
        fromCity: ride.fromCity,
        toCity: ride.toCity,
        fromState: ride.fromState,
        toState: ride.toState,
        fromZipCode: ride.fromZipCode,
        toZipCode: ride.toZipCode,
        fromLatitude: ride.fromLatitude,
        fromLongitude: ride.fromLongitude,
        toLatitude: ride.toLatitude,
        toLongitude: ride.toLongitude,
        departureTime: departureISO,
        departureDate: ride.departureDate,
        departureTimeString: ride.departureTime,
        availableSeats: ride.availableSeats,
        totalSeats: ride.availableSeats,
        price: ride.pricePerSeat,
        pricePerSeat: ride.pricePerSeat,
        status: ride.status,
        distance: ride.distance,
        carMake: ride.carMake,
        carModel: ride.carModel,
        carYear: ride.carYear,
        carColor: ride.carColor,
        driverName: ride.driverName,
        driverPhone: ride.driverPhone,
        passengers: passengers,
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
 * GET /api/driver/rides/:id
 * Get a specific ride by ID with all details including bookings
 * Query params: driverId (optional, but recommended for security)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rideIdParam = req.params.id;
    if (!rideIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID is required',
      });
    }
    
    const rideId = parseInt(rideIdParam);
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;
    
    if (isNaN(rideId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      });
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
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
        bookings: {
          where: {
            status: 'confirmed', // Only show confirmed bookings
          },
          include: {
            rider: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
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

    // If driverId is provided, verify that the ride belongs to this driver
    if (driverId && ride.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this ride',
      });
    }

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

    const departureISO = parseDateTimeToISO(ride.departureDate, ride.departureTime);

    // Format bookings as passengers
    const passengers = ride.bookings.map((booking) => ({
      id: booking.id,
      riderId: booking.riderId,
      riderName: booking.rider.fullName,
      riderPhone: booking.rider.phoneNumber,
      pickupAddress: booking.pickupAddress,
      pickupCity: booking.pickupCity || '',
      pickupState: booking.pickupState || '',
      pickupZipCode: booking.pickupZipCode || '',
      pickupLatitude: booking.pickupLatitude,
      pickupLongitude: booking.pickupLongitude,
      confirmationNumber: booking.confirmationNumber,
      status: booking.status,
    }));

    console.log(`✅ Returning ride ${rideId} with ${passengers.length} passengers`);

    return res.json({
      success: true,
      ride: {
        id: ride.id,
        driverId: ride.driverId,
        driverName: ride.driverName,
        driverPhone: ride.driverPhone,
        carMake: ride.carMake,
        carModel: ride.carModel,
        carYear: ride.carYear,
        carColor: ride.carColor,
        fromAddress: ride.fromAddress,
        fromCity: ride.fromCity,
        fromState: ride.fromState,
        fromZipCode: ride.fromZipCode,
        fromLatitude: ride.fromLatitude,
        fromLongitude: ride.fromLongitude,
        toAddress: ride.toAddress,
        toCity: ride.toCity,
        toState: ride.toState,
        toZipCode: ride.toZipCode,
        toLatitude: ride.toLatitude,
        toLongitude: ride.toLongitude,
        departureDate: ride.departureDate,
        departureTime: ride.departureTime,
        departureTimeISO: departureISO,
        availableSeats: ride.availableSeats,
        totalSeats: ride.availableSeats,
        price: ride.pricePerSeat,
        pricePerSeat: ride.pricePerSeat,
        status: ride.status,
        distance: ride.distance,
        passengers: passengers,
        driver: ride.driver || null,
        createdAt: ride.createdAt,
        updatedAt: ride.updatedAt,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching ride:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch ride',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/driver/rides/:id
 * Delete a ride by ID
 * Query params: driverId (required for security)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const rideIdParam = req.params.id;
    if (!rideIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID is required',
      });
    }
    
    const rideId = parseInt(rideIdParam);
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;
    
    if (isNaN(rideId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      });
    }

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Find the ride first to verify ownership
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        bookings: {
          where: {
            status: 'confirmed',
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

    // Verify that the ride belongs to this driver
    if (ride.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this ride',
      });
    }

    // Check if ride has confirmed bookings
    if (ride.bookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete ride with confirmed bookings. Please cancel bookings first.',
      });
    }

    // Delete the ride
    await prisma.ride.delete({
      where: { id: rideId },
    });

    console.log(`✅ Ride ${rideId} deleted by driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Ride deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting ride:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete ride',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/driver/rides/:id/cancel
 * Cancel a ride by ID (updates status to 'cancelled')
 * Query params: driverId (required for security)
 */
router.put('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const rideIdParam = req.params.id;
    if (!rideIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Ride ID is required',
      });
    }
    
    const rideId = parseInt(rideIdParam);
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;
    
    if (isNaN(rideId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride ID',
      });
    }

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Find the ride first to verify ownership
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        bookings: {
          where: {
            status: 'confirmed',
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

    // Verify that the ride belongs to this driver
    if (ride.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this ride',
      });
    }

    // Check if ride is already cancelled or completed
    if (ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Ride is already cancelled',
      });
    }

    if (ride.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed ride',
      });
    }

    // Cancel the ride and all associated bookings in a transaction
    await prisma.$transaction(async (tx) => {
      // Update ride status to cancelled
      await tx.ride.update({
        where: { id: rideId },
        data: {
          status: 'cancelled',
        },
      });

      // Cancel all confirmed bookings
      if (ride.bookings.length > 0) {
        await tx.booking.updateMany({
          where: {
            rideId: rideId,
            status: 'confirmed',
          },
          data: {
            status: 'cancelled',
          },
        });

        // Restore available seats
        await tx.ride.update({
          where: { id: rideId },
          data: {
            availableSeats: {
              increment: ride.bookings.length,
            },
          },
        });
      }
    });

    console.log(`✅ Ride ${rideId} cancelled by driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Ride cancelled successfully',
    });
  } catch (error) {
    console.error('❌ Error cancelling ride:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel ride',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

