import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * PUT /api/driver/location
 * Update driver's current location
 * Body: { driverId: number, latitude: number, longitude: number }
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const { driverId, latitude, longitude } = req.body;

    if (!driverId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID, latitude, and longitude are required',
      });
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude',
      });
    }

    // Validate coordinates are reasonable
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinate values',
      });
    }

    // Update driver location
    await prisma.users.update({
      where: { id: parseInt(driverId) },
      data: {
        lastLocationLatitude: parseFloat(latitude),
        lastLocationLongitude: parseFloat(longitude),
        lastLocationUpdate: new Date(),
      },
    });

    console.log('✅ Driver location updated:', {
      driverId: parseInt(driverId),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Location updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating driver location:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update location',
    });
  }
});

export default router;

