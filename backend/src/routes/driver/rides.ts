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
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    // TODO: Get driverId from authenticated session
    // For now, get all upcoming rides
    const rides = await prisma.ride.findMany({
      where: {
        status: 'scheduled',
        // Add date filter to only show future rides
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
        passengers: [], // TODO: Add passenger relation
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

export default router;

