import express, { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * POST /api/driver/push-token
 * Register or update push token for driver
 * Body: { userId, pushToken, tokenType, platform, deviceId }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, pushToken, tokenType, platform, deviceId } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required',
      });
    }

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update user with push token
    await prisma.users.update({
      where: { id: parseInt(userId) },
      data: {
        pushToken,
        pushTokenType: tokenType || 'expo',
        pushTokenPlatform: platform || 'unknown',
        pushTokenDeviceId: deviceId || null,
        pushTokenUpdatedAt: new Date(),
      },
    });

    console.log(`✅ Push token registered for user ${userId} (${platform})`);

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
 * Query params: userId
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : null;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

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

    console.log(`✅ Push token removed for user ${userId}`);

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





