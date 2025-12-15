import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * GET /api/driver/notifications
 * Get all notifications for a driver
 * Query params: driverId (required)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
        notifications: [],
      });
    }

    // Get all notifications for this driver
    const notifications = await prisma.notification.findMany({
      where: {
        driverId: driverId,
      },
      include: {
        booking: {
          include: {
            rider: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
            ride: {
              select: {
                id: true,
                fromAddress: true,
                toAddress: true,
                fromCity: true,
                toCity: true,
                departureDate: true,
                departureTime: true,
                pricePerSeat: true,
              },
            },
          },
        },
        ride: {
          select: {
            id: true,
            fromAddress: true,
            toAddress: true,
            fromCity: true,
            toCity: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }).catch((error) => {
      console.error('❌ Prisma query error:', error);
      throw error;
    });

    // Format notifications for frontend
    const formattedNotifications = notifications.map((notification) => {
      const timeAgo = getTimeAgo(notification.createdAt);

      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        time: timeAgo,
        unread: !notification.isRead,
        createdAt: notification.createdAt.toISOString(),
        booking: notification.booking && notification.booking.rider && notification.booking.ride
          ? {
              id: notification.booking.id,
              confirmationNumber: notification.booking.confirmationNumber,
              numberOfSeats: (notification.booking as any).numberOfSeats || 1,
              status: notification.booking.status,
              pickupAddress: notification.booking.pickupAddress,
              pickupCity: notification.booking.pickupCity,
              pickupState: notification.booking.pickupState,
              rider: {
                id: notification.booking.rider.id,
                fullName: notification.booking.rider.fullName,
                email: notification.booking.rider.email,
                phoneNumber: notification.booking.rider.phoneNumber,
              },
              ride: {
                id: notification.booking.ride.id,
                fromAddress: notification.booking.ride.fromAddress,
                toAddress: notification.booking.ride.toAddress,
                fromCity: notification.booking.ride.fromCity,
                toCity: notification.booking.ride.toCity,
                departureDate: notification.booking.ride.departureDate,
                departureTime: notification.booking.ride.departureTime,
                pricePerSeat: notification.booking.ride.pricePerSeat,
              },
            }
          : null,
        ride: notification.ride
          ? {
              id: notification.ride.id,
              fromAddress: notification.ride.fromAddress,
              toAddress: notification.ride.toAddress,
              fromCity: notification.ride.fromCity,
              toCity: notification.ride.toCity,
            }
          : null,
      };
    });

    return res.json({
      success: true,
      notifications: formattedNotifications,
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error',
      notifications: [],
    });
  }
});

/**
 * PUT /api/driver/notifications/:id/read
 * Mark a notification as read
 * Query params: driverId (required for security)
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const notificationIdParam = req.params.id;
    if (!notificationIdParam) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required',
      });
    }

    const notificationId = parseInt(notificationIdParam);
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;

    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Verify ownership
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (notification.driverId !== driverId || notification.driverId === null) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this notification',
      });
    }

    // Mark as read
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
      },
    });

    return res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});

/**
 * PUT /api/driver/notifications/read-all
 * Mark all notifications as read for a driver
 * Query params: driverId (required)
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId && typeof req.query.driverId === 'string' 
      ? parseInt(req.query.driverId) 
      : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Mark all as read
    await prisma.notification.updateMany({
      where: {
        driverId: driverId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
});

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} min ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

export default router;

