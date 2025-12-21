import express, { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireDriver } from '../../middleware/auth';

const router = express.Router();

/**
 * POST /api/driver/push-token
 * Register or update push token for driver
 * Requires: JWT token in Authorization header
 * Body: { pushToken, tokenType, platform, deviceId }
 */
router.post('/', authenticate, requireDriver, async (req: Request, res: Response) => {
  try {
    // Get driver ID from JWT token (already verified by middleware)
    const userId = req.user!.userId;
    const { pushToken, tokenType, platform, deviceId } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required',
      });
    }

    // Update user with push token (user exists since JWT is valid)
    await prisma.users.update({
      where: { id: userId },
      data: {
        pushToken,
        pushTokenType: tokenType || 'expo',
        pushTokenPlatform: platform || 'unknown',
        pushTokenDeviceId: deviceId || null,
        pushTokenUpdatedAt: new Date(),
      },
    });


    return res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('❌ Error registering push token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register push token',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/driver/push-token
 * Remove push token for driver (on logout)
 * Requires: JWT token in Authorization header
 */
router.delete('/', authenticate, requireDriver, async (req: Request, res: Response) => {
  try {
    // Get driver ID from JWT token (already verified by middleware)
    const userId = req.user!.userId;

    // Remove push token
    await prisma.users.update({
      where: { id: userId },
      data: {
        pushToken: null,
        pushTokenType: null,
        pushTokenPlatform: null,
        pushTokenDeviceId: null,
        pushTokenUpdatedAt: null,
      },
    });


    return res.json({
      success: true,
      message: 'Push token removed successfully',
    });
  } catch (error) {
    console.error('❌ Error removing push token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove push token',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;





