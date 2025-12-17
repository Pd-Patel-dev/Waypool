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
      estimatedTimeMinutes,
      isRecurring,
      recurringPattern,
      recurringEndDate,
      isDraft,
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

    // Validate recurring ride fields
    if (isRecurring === true) {
      if (!recurringPattern || !['daily', 'weekly', 'monthly'].includes(recurringPattern)) {
        return res.status(400).json({
          success: false,
          message: 'Recurring pattern must be "daily", "weekly", or "monthly" when isRecurring is true',
        });
      }
    }

    // Verify driver exists
    const driver = await prisma.users.findUnique({
      where: { id: parseInt(driverId) },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found',
      });
    }

    // Check if driver has an in-progress ride (cannot have multiple rides running simultaneously)
    // Only check if not a draft - drafts are allowed even with active rides
    if (!isDraft) {
      const inProgressRide = await prisma.rides.findFirst({
        where: {
          driverId: parseInt(driverId),
          status: 'in-progress',
        },
        select: {
          id: true,
          status: true,
          fromAddress: true,
          toAddress: true,
          departureDate: true,
          departureTime: true,
        },
      });

      if (inProgressRide) {
        return res.status(400).json({
          success: false,
          message: `You have a ride in progress. Please complete or cancel your current ride before creating a new one.`,
          activeRideId: inProgressRide.id,
        });
      }
    }
    
    // Note: We allow multiple scheduled rides for different dates
    // Duplicate ride check (same date/route/time) is handled below

    // Check for duplicate ride (same driver, route, date, and time within 30 minutes)
    // Only check if not a draft
    if (!isDraft) {
      const existingRides = await prisma.rides.findMany({
        where: {
          driverId: parseInt(driverId),
          fromLatitude: { gte: parseFloat(fromLatitude) - 0.01, lte: parseFloat(fromLatitude) + 0.01 },
          fromLongitude: { gte: parseFloat(fromLongitude) - 0.01, lte: parseFloat(fromLongitude) + 0.01 },
          toLatitude: { gte: parseFloat(toLatitude) - 0.01, lte: parseFloat(toLatitude) + 0.01 },
          toLongitude: { gte: parseFloat(toLongitude) - 0.01, lte: parseFloat(toLongitude) + 0.01 },
          departureDate,
          status: { not: 'cancelled' },
        },
      });

      // Check if any existing ride has the same time (within 30 minutes)
      for (const existingRide of existingRides) {
        const existingTime = existingRide.departureTime;
        const newTime = departureTime;
        
        // Parse times and compare
        const existingTimeMatch = existingTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        const newTimeMatch = newTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        
        if (existingTimeMatch && newTimeMatch && 
            existingTimeMatch[1] && existingTimeMatch[2] && existingTimeMatch[3] &&
            newTimeMatch[1] && newTimeMatch[2] && newTimeMatch[3]) {
          let existingHours = parseInt(existingTimeMatch[1], 10);
          const existingMinutes = parseInt(existingTimeMatch[2], 10);
          const existingMeridiem = existingTimeMatch[3].toUpperCase();
          
          let newHours = parseInt(newTimeMatch[1], 10);
          const newMinutes = parseInt(newTimeMatch[2], 10);
          const newMeridiem = newTimeMatch[3].toUpperCase();
          
          if (existingMeridiem === 'PM' && existingHours !== 12) existingHours += 12;
          if (existingMeridiem === 'AM' && existingHours === 12) existingHours = 0;
          if (newMeridiem === 'PM' && newHours !== 12) newHours += 12;
          if (newMeridiem === 'AM' && newHours === 12) newHours = 0;
          
          const existingTotalMinutes = existingHours * 60 + existingMinutes;
          const newTotalMinutes = newHours * 60 + newMinutes;
          const timeDifference = Math.abs(existingTotalMinutes - newTotalMinutes);
          
          // If same date and within 30 minutes, it's a duplicate
          if (timeDifference <= 30) {
            return res.status(409).json({
              success: false,
              message: 'A similar ride already exists for this route and time. Please check your existing rides or modify the departure time.',
              duplicateRideId: existingRide.id,
            });
          }
        }
      }
    }

    // Create the ride
    const ride = await prisma.rides.create({
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
        ...(estimatedTimeMinutes !== undefined && { estimatedTimeMinutes: parseInt(estimatedTimeMinutes) }),
        isRecurring: isRecurring === true,
        recurringPattern: recurringPattern || null,
        recurringEndDate: recurringEndDate || null,
        isDraft: isDraft === true,
        status: isDraft ? 'draft' : 'scheduled',
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
 * GET /api/driver/rides/past
 * Get past/completed rides for the driver
 * Query params: driverId (required)
 */
router.get('/past', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;
    
    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
        rides: [],
      });
    }

    // Get completed rides for the specific driver
    const rides = await prisma.rides.findMany({
      where: {
        driverId: driverId,
        status: 'completed',
      },
      include: {
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'completed'],
            },
          },
          include: {
            users: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc', // Most recently completed first
      },
    });

    console.log(`📊 Found ${rides.length} completed rides for driver ${driverId}`);

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
    
    // Transform rides to match the frontend format
    const formattedRides = rides.map((ride) => {
      const departureISO = parseDateTimeToISO(ride.departureDate, ride.departureTime);
      
      // Format bookings as passengers
      const passengers = ride.bookings.map((booking) => ({
        id: booking.id,
        riderId: booking.riderId,
        riderName: booking.users?.fullName,
        riderPhone: booking.users?.phoneNumber,
        pickupAddress: booking.pickupAddress,
        pickupCity: booking.pickupCity || '',
        pickupState: booking.pickupState || '',
        pickupZipCode: booking.pickupZipCode || '',
        pickupLatitude: booking.pickupLatitude,
        pickupLongitude: booking.pickupLongitude,
        confirmationNumber: booking.confirmationNumber,
        numberOfSeats: booking.numberOfSeats || 1,
        status: booking.status,
        pickupStatus: booking.pickupStatus || 'pending',
        pickedUpAt: booking.pickedUpAt,
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
        totalEarnings: ride.totalEarnings,
        status: ride.status,
        distance: ride.distance,
        isRecurring: ride.isRecurring,
        recurringPattern: ride.recurringPattern,
        recurringEndDate: ride.recurringEndDate,
        parentRideId: ride.parentRideId,
        carMake: ride.carMake,
        carModel: ride.carModel,
        carYear: ride.carYear,
        carColor: ride.carColor,
        driverName: ride.driverName,
        driverPhone: ride.driverPhone,
        passengers: passengers,
        completedAt: ride.updatedAt.toISOString(),
      };
    });

    return res.json({
      success: true,
      rides: formattedRides,
    });
  } catch (error) {
    console.error('❌ Error fetching past rides:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch past rides',
      rides: [],
    });
  }
});

/**
 * GET /api/driver/rides/upcoming
 * Get upcoming rides for the driver
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

    // Get rides for the specific driver (scheduled and in-progress only, exclude cancelled and completed)
    const rides = await prisma.rides.findMany({
      where: {
        driverId: driverId,
        status: {
          in: ['scheduled', 'in-progress'], // Only show scheduled and in-progress rides
        },
      },
      include: {
        bookings: {
          where: {
            status: 'confirmed',
          },
          include: {
            users: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
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
    
    // Transform rides to match the frontend format
    const formattedRides = rides.map((ride) => {
      const departureISO = parseDateTimeToISO(ride.departureDate, ride.departureTime);
      
      // Format bookings as passengers
      const passengers = ride.bookings.map((booking) => ({
        id: booking.id,
        riderId: booking.riderId,
        riderName: booking.users?.fullName,
        riderPhone: booking.users?.phoneNumber,
        pickupAddress: booking.pickupAddress,
        pickupCity: booking.pickupCity || '',
        pickupState: booking.pickupState || '',
        pickupZipCode: booking.pickupZipCode || '',
        pickupLatitude: booking.pickupLatitude,
        pickupLongitude: booking.pickupLongitude,
        confirmationNumber: booking.confirmationNumber,
        numberOfSeats: booking.numberOfSeats || 1,
        status: booking.status,
        pickupStatus: booking.pickupStatus || 'pending',
        pickedUpAt: booking.pickedUpAt,
      }));
      
      return {
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
        carMake: ride.carMake,
        carModel: ride.carModel,
        carYear: ride.carYear,
        carColor: ride.carColor,
        driverName: ride.driverName,
        driverPhone: ride.driverPhone,
        isRecurring: ride.isRecurring,
        recurringPattern: ride.recurringPattern,
        recurringEndDate: ride.recurringEndDate,
        parentRideId: ride.parentRideId,
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
 * GET /api/driver/rides/earnings
 * Get earnings summary for the driver
 * Query params: driverId (required)
 * NOTE: This route must be defined BEFORE /:id to avoid route conflicts
 */
router.get('/earnings', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;
    
    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Get all completed rides for the driver with bookings to calculate earnings
    const completedRides = await prisma.rides.findMany({
      where: {
        driverId: driverId,
        status: 'completed',
      },
      select: {
        id: true,
        totalEarnings: true,
        pricePerSeat: true,
        updatedAt: true,
        createdAt: true,
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'completed'],
            },
          },
          select: {
            numberOfSeats: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Calculate totals - use stored totalEarnings if available, otherwise calculate from bookings
    const totalEarnings = completedRides.reduce((sum, ride) => {
      if (ride.totalEarnings !== null && ride.totalEarnings !== undefined) {
        return sum + ride.totalEarnings;
      }
      // Fallback: calculate from bookings if totalEarnings not stored
      const rideEarnings = ride.bookings.reduce((bookingSum, booking) => {
        const seats = booking.numberOfSeats || 1;
        return bookingSum + (seats * (ride.pricePerSeat || 0));
      }, 0);
      return sum + rideEarnings;
    }, 0);

    // Helper function to get earnings for a ride
    const getRideEarnings = (ride: any): number => {
      if (ride.totalEarnings !== null && ride.totalEarnings !== undefined) {
        return ride.totalEarnings;
      }
      // Fallback: calculate from bookings
      return ride.bookings.reduce((sum: number, booking: any) => {
        const seats = booking.numberOfSeats || 1;
        return sum + (seats * (ride.pricePerSeat || 0));
      }, 0);
    };

    // Calculate monthly earnings (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRides = completedRides.filter(ride => {
      const completedDate = new Date(ride.updatedAt);
      return completedDate >= startOfMonth;
    });
    const monthlyEarnings = monthlyRides.reduce((sum, ride) => {
      return sum + getRideEarnings(ride);
    }, 0);

    // Calculate weekly earnings (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklyRides = completedRides.filter(ride => {
      const completedDate = new Date(ride.updatedAt);
      return completedDate >= sevenDaysAgo;
    });
    const weeklyEarnings = weeklyRides.reduce((sum, ride) => {
      return sum + getRideEarnings(ride);
    }, 0);

    // Calculate average earnings per ride
    const avgEarningsPerRide = completedRides.length > 0
      ? totalEarnings / completedRides.length
      : 0;

    // Get recent earnings (last 10 rides)
    const recentEarnings = completedRides.slice(0, 10).map(ride => ({
      rideId: ride.id,
      amount: getRideEarnings(ride),
      date: ride.updatedAt.toISOString(),
    }));

    // Calculate total distance (if available)
    const ridesWithDistance = await prisma.rides.findMany({
      where: {
        driverId: driverId,
        status: 'completed',
        distance: { not: null },
      },
      select: {
        distance: true,
      },
    });
    const totalDistance = ridesWithDistance.reduce((sum, ride) => {
      return sum + (ride.distance || 0);
    }, 0);

    console.log(`💰 Earnings summary for driver ${driverId}: Total: $${totalEarnings.toFixed(2)}, Monthly: $${monthlyEarnings.toFixed(2)}, Weekly: $${weeklyEarnings.toFixed(2)}`);

    return res.json({
      success: true,
      earnings: {
        total: totalEarnings,
        monthly: monthlyEarnings,
        weekly: weeklyEarnings,
        averagePerRide: avgEarningsPerRide,
        totalRides: completedRides.length,
        totalDistance: totalDistance,
        recentEarnings: recentEarnings,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching earnings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings',
      error: error instanceof Error ? error.message : 'Unknown error',
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

    const ride = await prisma.rides.findUnique({
      where: { id: rideId },
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
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'completed'], // Include both confirmed and completed bookings
            },
          },
          include: {
            users: {
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
      riderName: booking.users.fullName,
      riderPhone: booking.users.phoneNumber,
      pickupAddress: booking.pickupAddress,
      pickupCity: booking.pickupCity || '',
      pickupState: booking.pickupState || '',
      pickupZipCode: booking.pickupZipCode || '',
      pickupLatitude: booking.pickupLatitude,
      pickupLongitude: booking.pickupLongitude,
      confirmationNumber: booking.confirmationNumber,
      numberOfSeats: booking.numberOfSeats || 1,
      status: booking.status,
      pickupStatus: booking.pickupStatus || 'pending',
      pickedUpAt: booking.pickedUpAt,
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
        totalEarnings: ride.totalEarnings,
        status: ride.status,
        distance: ride.distance,
        isRecurring: ride.isRecurring,
        recurringPattern: ride.recurringPattern,
        recurringEndDate: ride.recurringEndDate,
        parentRideId: ride.parentRideId,
        passengers: passengers,
        driver: ride.users || null,
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
    const ride = await prisma.rides.findUnique({
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
    await prisma.rides.delete({
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
 * PUT /api/driver/rides/:id
 * Update a ride by ID
 * Query params: driverId (required for security)
 * Body: Can update date, time, price, seats (if no bookings exist)
 */
router.put('/:id', async (req: Request, res: Response) => {
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

    // Find the ride with bookings
    const ride = await prisma.rides.findUnique({
      where: { id: rideId },
      include: {
        bookings: {
          where: {
            status: {
              in: ['pending', 'confirmed'], // Only count active bookings
            },
          },
          include: {
            users: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
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

    // Extract bookings with proper typing - TypeScript needs help recognizing the included relation
    const bookings = (ride as any).bookings || [];
    const bookingsCount = bookings.length;

    // Verify that the ride belongs to this driver
    if (ride.driverId !== driverId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this ride',
      });
    }

    // Check if ride is already completed or cancelled
    if (ride.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a completed ride',
      });
    }

    if (ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a cancelled ride',
      });
    }

    // Extract update fields from request body
    const {
      departureDate,
      departureTime,
      pricePerSeat,
      availableSeats,
    } = req.body;

    // Track what changed for notifications
    const changes: string[] = [];
    const updateData: any = {};

    // Check if date changed
    if (departureDate && departureDate !== ride.departureDate) {
      updateData.departureDate = departureDate;
      changes.push('departure date');
    }

    // Check if time changed
    if (departureTime && departureTime !== ride.departureTime) {
      updateData.departureTime = departureTime;
      changes.push('departure time');
    }

    // Check if price changed
    if (pricePerSeat !== undefined && pricePerSeat !== ride.pricePerSeat) {
      updateData.pricePerSeat = parseFloat(pricePerSeat);
      changes.push('price per seat');
    }

    // Check if seats changed - only allowed if no bookings exist
    if (availableSeats !== undefined && availableSeats !== ride.availableSeats) {
      if (bookingsCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change available seats when there are active bookings',
        });
      }
      updateData.availableSeats = parseInt(availableSeats);
      changes.push('available seats');
    }

    // If no changes, return early
    if (Object.keys(updateData).length === 0) {
      return res.json({
        success: true,
        message: 'No changes to update',
        ride: ride,
      });
    }

    // Update the ride
    const updatedRide = await prisma.rides.update({
      where: { id: rideId },
      data: updateData,
    });

    // If there are bookings and changes were made, notify riders
    if (bookingsCount > 0 && changes.length > 0) {
      const changeMessage = changes.join(', ');
      const notificationPromises = bookings.map((booking: typeof bookings[0]) =>
        prisma.notifications.create({
          data: {
            riderId: booking.riderId,
            type: 'ride-updated',
            title: 'Ride Details Updated',
            message: `The driver has updated the ${changeMessage} for your ride from ${ride.fromAddress} to ${ride.toAddress}. Please check the updated details.`,
            bookingId: booking.id,
            rideId: ride.id,
            isRead: false,
          },
        }).catch((error) => {
          console.error(`❌ Error creating notification for rider ${booking.riderId}:`, error);
          return null;
        })
      );

      await Promise.all(notificationPromises);
      console.log(`✅ Created ${bookingsCount} notifications for ride update`);
    }

    console.log(`✅ Ride ${rideId} updated by driver ${driverId}. Changes: ${changes.join(', ')}`);

    return res.json({
      success: true,
      message: 'Ride updated successfully',
      ride: updatedRide,
      changes: changes,
    });
  } catch (error) {
    console.error('❌ Error updating ride:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ride',
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
    const ride = await prisma.rides.findUnique({
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
      await tx.rides.update({
        where: { id: rideId },
        data: {
          status: 'cancelled',
        },
      });

      // Cancel all confirmed bookings
      if (ride.bookings.length > 0) {
        await tx.bookings.updateMany({
          where: {
            rideId: rideId,
            status: 'confirmed',
          },
          data: {
            status: 'cancelled',
          },
        });

        // Restore available seats
        await tx.rides.update({
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

/**
 * PUT /api/driver/rides/:id/start
 * Start a ride (update status to 'in-progress')
 * Query params: driverId (required for security)
 */
router.put('/:id/start', async (req: Request, res: Response) => {
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

    // Find the ride with confirmed bookings
    const ride = await prisma.rides.findUnique({
      where: { id: rideId },
      include: {
        bookings: {
          where: {
            status: 'confirmed',
          },
          include: {
            users: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
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
        message: 'You do not have permission to start this ride',
      });
    }

    // Check if ride is already started, completed, or cancelled
    if (ride.status === 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Ride is already in progress',
      });
    }

    if (ride.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot start a completed ride',
      });
    }

    if (ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot start a cancelled ride',
      });
    }

    // Check if driver already has another ride in progress
    const activeRide = await prisma.rides.findFirst({
      where: {
        driverId: driverId,
        status: 'in-progress',
        id: { not: rideId }, // Exclude the current ride
      },
      select: {
        id: true,
        fromAddress: true,
        toAddress: true,
      },
    });

    if (activeRide) {
      return res.status(400).json({
        success: false,
        message: `You already have a ride in progress. Please complete your current ride (ID: ${activeRide.id}) before starting a new one.`,
        activeRideId: activeRide.id,
      });
    }

    // Update ride status to in-progress
    await prisma.rides.update({
      where: { id: rideId },
      data: {
        status: 'in-progress',
      },
    });

    // Create notifications for all confirmed passengers
    if (ride.bookings.length > 0) {
      const notificationPromises = ride.bookings.map((booking) =>
        prisma.notifications.create({
          data: {
            riderId: booking.riderId, // Store notification for the rider
            type: 'ride-started',
            title: 'Ride Started',
            message: `${ride.driverName} has started the ride from ${ride.fromAddress} to ${ride.toAddress}. Please be ready for pickup.`,
            bookingId: booking.id,
            rideId: ride.id,
            isRead: false,
          },
        }).catch((error) => {
          console.error(`❌ Error creating notification for rider ${booking.riderId}:`, error);
          return null;
        })
      );

      await Promise.all(notificationPromises);
      console.log(`✅ Created ${ride.bookings.length} notifications for ride start`);
    }

    console.log(`✅ Ride ${rideId} started by driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Ride started successfully',
    });
  } catch (error) {
    console.error('❌ Error starting ride:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start ride',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/driver/rides/:id/complete
 * Complete a ride (update status to 'completed')
 * Query params: driverId (required for security)
 */
router.put('/:id/complete', async (req: Request, res: Response) => {
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

    // Find the ride with confirmed bookings
    const ride = await prisma.rides.findUnique({
      where: { id: rideId },
      include: {
        bookings: {
          where: {
            status: 'confirmed',
          },
          include: {
            users: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
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
        message: 'You do not have permission to complete this ride',
      });
    }

    // Check if ride is already completed or cancelled
    if (ride.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Ride is already completed',
      });
    }

    if (ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete a cancelled ride',
      });
    }

    // Check if ride is started
    if (ride.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: 'Ride must be started before it can be completed',
      });
    }

    // Check if all passengers are picked up
    if (ride.bookings.length > 0) {
      const allPickedUp = ride.bookings.every(
        (booking) => booking.pickupStatus === 'picked_up'
      );

      if (!allPickedUp) {
        const unpickedCount = ride.bookings.filter(
          (booking) => booking.pickupStatus !== 'picked_up'
        ).length;
        return res.status(400).json({
          success: false,
          message: `Cannot complete ride. ${unpickedCount} passenger${unpickedCount !== 1 ? 's' : ''} still need${unpickedCount !== 1 ? '' : 's'} to be marked as picked up.`,
        });
      }
    }

    // Calculate total earnings: sum of (numberOfSeats * pricePerSeat) for all confirmed bookings
    let totalEarnings = 0;
    if (ride.bookings.length > 0) {
      totalEarnings = ride.bookings.reduce((sum, booking) => {
        const seats = booking.numberOfSeats || 1;
        return sum + (seats * ride.pricePerSeat);
      }, 0);
    }

    // Complete the ride and all associated bookings in a transaction
    await prisma.$transaction(async (tx) => {
      // Update ride status to completed and store total earnings
      await tx.rides.update({
        where: { id: rideId },
        data: {
          status: 'completed',
          totalEarnings: totalEarnings,
        },
      });

      // Mark all confirmed bookings as completed
      if (ride.bookings.length > 0) {
        await tx.bookings.updateMany({
          where: {
            rideId: rideId,
            status: 'confirmed',
          },
          data: {
            status: 'completed',
          },
        });
      }
    });

    // Create notifications for all passengers
    if (ride.bookings.length > 0) {
      const notificationPromises = ride.bookings.map((booking) =>
        prisma.notifications.create({
          data: {
            riderId: booking.riderId, // Store notification for the rider
            type: 'ride-completed',
            title: 'Ride Completed',
            message: `Your ride from ${ride.fromAddress} to ${ride.toAddress} has been completed. Thank you for using Waypool!`,
            bookingId: booking.id,
            rideId: ride.id,
            isRead: false,
          },
        }).catch((error) => {
          console.error(`❌ Error creating notification for rider ${booking.riderId}:`, error);
          return null;
        })
      );

      await Promise.all(notificationPromises);
      console.log(`✅ Created ${ride.bookings.length} notifications for ride completion`);
    }

    console.log(`✅ Ride ${rideId} completed by driver ${driverId} with earnings: $${totalEarnings.toFixed(2)}`);

    return res.json({
      success: true,
      message: 'Ride completed successfully',
      totalEarnings: totalEarnings,
    });
  } catch (error) {
    console.error('❌ Error completing ride:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete ride',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

