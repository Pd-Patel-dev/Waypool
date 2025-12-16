import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = express.Router();

/**
 * GET /api/driver/messages/conversations
 * Get all conversations for a driver
 * Query params: driverId (required)
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
        conversations: [],
      });
    }

    // Get all unique conversations (people the driver has messaged or been messaged by)
    const conversations = await prisma.messages.findMany({
      where: {
        OR: [
          { senderId: driverId },
          { receiverId: driverId },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
        rides: {
          select: {
            id: true,
            fromAddress: true,
            toAddress: true,
            departureDate: true,
            departureTime: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group messages by conversation partner
    const conversationMap = new Map<number, any>();

    conversations.forEach((message) => {
      const partnerId = message.senderId === driverId ? message.receiverId : message.senderId;
      const partner = message.senderId === driverId ? message.receiver : message.sender;

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partnerId,
          partnerName: partner.fullName,
          partnerPhoto: partner.photoUrl,
          lastMessage: message.message,
          lastMessageTime: message.createdAt,
          unreadCount: 0,
          rideId: message.rideId,
          ride: message.rides,
        });
      } else {
        const existing = conversationMap.get(partnerId)!;
        if (message.createdAt > existing.lastMessageTime) {
          existing.lastMessage = message.message;
          existing.lastMessageTime = message.createdAt;
        }
      }

      // Count unread messages
      if (message.receiverId === driverId && !message.isRead) {
        const existing = conversationMap.get(partnerId)!;
        existing.unreadCount += 1;
      }
    });

    const conversationList = Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    return res.json({
      success: true,
      conversations: conversationList,
    });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      conversations: [],
    });
  }
});

/**
 * GET /api/driver/messages/:partnerId
 * Get messages with a specific partner
 * Query params: driverId (required), rideId (optional)
 */
router.get('/:partnerId', async (req: Request, res: Response) => {
  try {
    const partnerId = req.params.partnerId ? parseInt(req.params.partnerId) : null;
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;
    const rideId = req.query.rideId ? parseInt(req.query.rideId as string) : null;

    if (!driverId || isNaN(driverId) || !partnerId || isNaN(partnerId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID and Partner ID are required',
        messages: [],
      });
    }

    const whereClause: any = {
      OR: [
        { senderId: driverId, receiverId: partnerId },
        { senderId: partnerId, receiverId: driverId },
      ],
    };

    if (rideId) {
      whereClause.rideId = rideId;
    }

    const messages = await prisma.messages.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Mark messages as read
    await prisma.messages.updateMany({
      where: {
        receiverId: driverId,
        senderId: partnerId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return res.json({
      success: true,
      messages: messages.map((msg) => ({
        id: msg.id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        message: msg.message,
        isRead: msg.isRead,
        createdAt: msg.createdAt.toISOString(),
        sender: {
          id: msg.sender.id,
          fullName: msg.sender.fullName,
          photoUrl: msg.sender.photoUrl,
        },
      })),
    });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      messages: [],
    });
  }
});

/**
 * POST /api/driver/messages
 * Send a message
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { senderId, receiverId, message, rideId, bookingId } = req.body;

    if (!senderId || !receiverId || !message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Sender ID, receiver ID, and message are required',
      });
    }

    // Verify sender is the driver
    const driverId = parseInt(senderId);
    const driver = await prisma.users.findUnique({
      where: { id: driverId },
      select: { isDriver: true },
    });

    if (!driver || !driver.isDriver) {
      return res.status(403).json({
        success: false,
        message: 'Only drivers can send messages through this endpoint',
      });
    }

    // Create message
    const newMessage = await prisma.messages.create({
      data: {
        senderId: driverId,
        receiverId: parseInt(receiverId),
        message: message.trim(),
        rideId: rideId ? parseInt(rideId) : null,
        bookingId: bookingId ? parseInt(bookingId) : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
      },
    });

    // Create notification for receiver
    await prisma.notifications.create({
      data: {
        riderId: parseInt(receiverId),
        type: 'message',
        title: 'New Message',
        message: `${newMessage.sender.fullName}: ${message.trim().substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        isRead: false,
      },
    }).catch((error) => {
      console.error('Error creating notification:', error);
    });

    return res.json({
      success: true,
      message: {
        id: newMessage.id,
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId,
        message: newMessage.message,
        isRead: newMessage.isRead,
        createdAt: newMessage.createdAt.toISOString(),
        sender: {
          id: newMessage.sender.id,
          fullName: newMessage.sender.fullName,
          photoUrl: newMessage.sender.photoUrl,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

