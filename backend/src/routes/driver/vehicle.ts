import express, { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireDriver } from '../../middleware/auth';

const router = express.Router();

/**
 * GET /api/driver/vehicle
 * Get driver vehicle information
 * Requires: JWT token in Authorization header
 */
router.get('/', authenticate, requireDriver, async (req: Request, res: Response) => {
  try {
    // Get driver ID from JWT token (already verified by middleware)
    const driverId = req.user!.userId;

    const user = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        carMake: true,
        carModel: true,
        carYear: true,
        carColor: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      vehicle: {
        carMake: user.carMake,
        carModel: user.carModel,
        carYear: user.carYear,
        carColor: user.carColor,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching vehicle:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle information',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/driver/vehicle
 * Update driver vehicle information
 * Requires: JWT token in Authorization header
 * Body: carMake, carModel, carYear, carColor (all optional)
 */
router.put('/', authenticate, requireDriver, async (req: Request, res: Response) => {
  try {
    // Get driver ID from JWT token (already verified by middleware)
    const driverId = req.user!.userId;

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { id: driverId },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { carMake, carModel, carYear, carColor } = req.body;

    // Validation
    const errors: string[] = [];

    if (carYear !== undefined && carYear !== null) {
      const currentYear = new Date().getFullYear();
      if (typeof carYear !== 'number' || carYear < 1900 || carYear > currentYear + 1) {
        errors.push(`Car year must be between 1900 and ${currentYear + 1}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Build update data
    const updateData: any = {};
    if (carMake !== undefined) {
      updateData.carMake = carMake && carMake.trim() ? carMake.trim() : null;
    }
    if (carModel !== undefined) {
      updateData.carModel = carModel && carModel.trim() ? carModel.trim() : null;
    }
    if (carYear !== undefined) {
      updateData.carYear = carYear ? parseInt(String(carYear), 10) : null;
    }
    if (carColor !== undefined) {
      updateData.carColor = carColor && carColor.trim() ? carColor.trim() : null;
    }

    // Update user vehicle information
    const updatedUser = await prisma.users.update({
      where: { id: driverId },
      data: updateData,
      select: {
        id: true,
        carMake: true,
        carModel: true,
        carYear: true,
        carColor: true,
      },
    });


    return res.json({
      success: true,
      message: 'Vehicle information updated successfully',
      vehicle: {
        carMake: updatedUser.carMake,
        carModel: updatedUser.carModel,
        carYear: updatedUser.carYear,
        carColor: updatedUser.carColor,
      },
    });
  } catch (error) {
    console.error('❌ Error updating vehicle:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update vehicle information',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

