import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireDriver } from '../../middleware/auth';

const router = express.Router();

/**
 * PUT /api/driver/location
 * Update driver's current location
 * Requires: JWT token in Authorization header
 * Body: { latitude: number, longitude: number }
 */
router.put('/', authenticate, requireDriver, async (req: Request, res: Response) => {
  try {
    // Get driver ID from JWT token (already verified by middleware)
    const driverId = req.user!.userId;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
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
      where: { id: driverId },
      data: {
        lastLocationLatitude: parseFloat(latitude),
        lastLocationLongitude: parseFloat(longitude),
        lastLocationUpdate: new Date(),
      },
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

