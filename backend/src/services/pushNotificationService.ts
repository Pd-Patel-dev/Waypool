import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushErrorReceipt } from 'expo-server-sdk';
import { prisma } from '../lib/prisma';

// Create a new Expo SDK client
const expo = new Expo({
  ...(process.env.EXPO_ACCESS_TOKEN ? { accessToken: process.env.EXPO_ACCESS_TOKEN } : {}),
  // Optionally use batching to send multiple notifications efficiently
  useFcmV1: true,
});

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

/**
 * Send push notification to a single user
 * @param userId - User ID to send notification to
 * @param payload - Notification payload
 * @returns true if sent successfully
 */
export async function sendPushNotification(
  userId: number,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    // Get user's push token
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        pushToken: true,
        pushTokenType: true,
        notifyBookings: true,
        notifyMessages: true,
        notifyRideUpdates: true,
        notifyPromotions: true,
      },
    });

    if (!user || !user.pushToken) {
      console.log(`⚠️ No push token for user ${userId}`);
      return false;
    }

    // Check if user has enabled notifications for this type
    const notificationType = payload.data?.type;
    if (notificationType) {
      if (notificationType === 'booking_request' && !user.notifyBookings) {
        console.log(`⏭️ User ${userId} has disabled booking notifications`);
        return false;
      }
      if (notificationType === 'message' && !user.notifyMessages) {
        console.log(`⏭️ User ${userId} has disabled message notifications`);
        return false;
      }
      if (
        (notificationType === 'ride_update' || notificationType === 'ride_started') &&
        !user.notifyRideUpdates
      ) {
        console.log(`⏭️ User ${userId} has disabled ride update notifications`);
        return false;
      }
      if (notificationType === 'promotion' && !user.notifyPromotions) {
        console.log(`⏭️ User ${userId} has disabled promotional notifications`);
        return false;
      }
    }

    // Check if token is valid Expo push token
    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.error(`❌ Invalid Expo push token for user ${userId}: ${user.pushToken}`);
      return false;
    }

    // Construct the message
    const message: ExpoPushMessage = {
      to: user.pushToken,
      sound: payload.sound === null ? null : (payload.sound || 'default'),
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      priority: payload.priority || 'high',
      channelId: payload.channelId || 'default',
    };

    // Send notification
    const ticketChunk = await expo.sendPushNotificationsAsync([message]);
    const ticket = ticketChunk[0];

    if (!ticket) {
      console.error(`❌ No ticket returned for user ${userId}`);
      return false;
    }

    if (ticket.status === 'error') {
      console.error(`❌ Error sending push notification to user ${userId}:`, (ticket as any).message);
      
      // If token is invalid, clear it from database
      if ((ticket as any).details && 'error' in (ticket as any).details && (ticket as any).details.error === 'DeviceNotRegistered') {
        await prisma.users.update({
          where: { id: userId },
          data: {
            pushToken: null,
            pushTokenType: null,
          },
        });
        console.log(`🗑️ Cleared invalid push token for user ${userId}`);
      }
      
      return false;
    }

    console.log(`✅ Push notification sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending push notification to user ${userId}:`, error);
    return false;
  }
}

/**
 * Send push notification to multiple users
 * @param userIds - Array of user IDs
 * @param payload - Notification payload
 * @returns Number of successfully sent notifications
 */
export async function sendBulkPushNotifications(
  userIds: number[],
  payload: PushNotificationPayload
): Promise<number> {
  try {
    // Get push tokens for all users
    const users = await prisma.users.findMany({
      where: {
        id: { in: userIds },
        pushToken: { not: null },
      },
      select: {
        id: true,
        pushToken: true,
        notifyBookings: true,
        notifyMessages: true,
        notifyRideUpdates: true,
        notifyPromotions: true,
      },
    });

    if (users.length === 0) {
      console.log('⚠️ No users with push tokens found');
      return 0;
    }

    // Filter users based on notification preferences
    const notificationType = payload.data?.type;
    const filteredUsers = users.filter((user) => {
      if (notificationType === 'booking_request' && !user.notifyBookings) return false;
      if (notificationType === 'message' && !user.notifyMessages) return false;
      if (
        (notificationType === 'ride_update' || notificationType === 'ride_started') &&
        !user.notifyRideUpdates
      ) {
        return false;
      }
      if (notificationType === 'promotion' && !user.notifyPromotions) return false;
      return true;
    });

    // Prepare messages
    const messages: ExpoPushMessage[] = filteredUsers
      .filter((user) => user.pushToken && Expo.isExpoPushToken(user.pushToken))
      .map((user) => ({
        to: user.pushToken!,
        sound: payload.sound === null ? null : (payload.sound || 'default'),
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
        priority: payload.priority || 'high',
        channelId: payload.channelId || 'default',
      }));

    if (messages.length === 0) {
      console.log('⚠️ No valid push tokens found');
      return 0;
    }

    // Send in chunks (Expo recommends batches of 100)
    const chunks = expo.chunkPushNotifications(messages);
    let successCount = 0;

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        
        // Count successes
        ticketChunk.forEach((ticket) => {
          if (ticket.status === 'ok') {
            successCount++;
          } else if (ticket.status === 'error') {
            console.error('❌ Error sending notification:', ticket.message);
          }
        });
      } catch (error) {
        console.error('❌ Error sending notification chunk:', error);
      }
    }

    console.log(`✅ Sent ${successCount}/${messages.length} push notifications`);
    return successCount;
  } catch (error) {
    console.error('❌ Error sending bulk push notifications:', error);
    return 0;
  }
}

/**
 * Send booking request notification to driver
 * @param driverId - Driver user ID
 * @param bookingData - Booking information
 */
export async function sendBookingRequestNotification(
  driverId: number,
  bookingData: {
    bookingId: number;
    riderName: string;
    pickupAddress: string;
    seats: number;
  }
): Promise<boolean> {
  return sendPushNotification(driverId, {
    title: '🔔 New Booking Request',
    body: `${bookingData.riderName} wants to book ${bookingData.seats} seat(s) from ${bookingData.pickupAddress}`,
    data: {
      type: 'booking_request',
      bookingId: bookingData.bookingId,
    },
    badge: 1,
  });
}

/**
 * Send booking accepted notification to rider
 * @param riderId - Rider user ID
 * @param bookingData - Booking information
 */
export async function sendBookingAcceptedNotification(
  riderId: number,
  bookingData: {
    bookingId: number;
    driverName: string;
    rideDate: string;
    rideTime: string;
  }
): Promise<boolean> {
  return sendPushNotification(riderId, {
    title: '✅ Booking Confirmed',
    body: `${bookingData.driverName} accepted your booking for ${bookingData.rideDate} at ${bookingData.rideTime}`,
    data: {
      type: 'booking_accepted',
      bookingId: bookingData.bookingId,
    },
  });
}

/**
 * Send ride started notification to passengers
 * @param passengerIds - Array of passenger user IDs
 * @param rideData - Ride information
 */
export async function sendRideStartedNotification(
  passengerIds: number[],
  rideData: {
    rideId: number;
    driverName: string;
    fromAddress: string;
  }
): Promise<number> {
  return sendBulkPushNotifications(passengerIds, {
    title: '🚗 Ride Started',
    body: `${rideData.driverName} has started the ride from ${rideData.fromAddress}`,
    data: {
      type: 'ride_started',
      rideId: rideData.rideId,
    },
  });
}

/**
 * Send new message notification
 * @param recipientId - Recipient user ID
 * @param messageData - Message information
 */
export async function sendMessageNotification(
  recipientId: number,
  messageData: {
    senderId: number;
    senderName: string;
    message: string;
  }
): Promise<boolean> {
  return sendPushNotification(recipientId, {
    title: `💬 ${messageData.senderName}`,
    body: messageData.message.length > 100 
      ? messageData.message.substring(0, 100) + '...' 
      : messageData.message,
    data: {
      type: 'message',
      senderId: messageData.senderId,
    },
    badge: 1,
  });
}

export default {
  sendPushNotification,
  sendBulkPushNotifications,
  sendBookingRequestNotification,
  sendBookingAcceptedNotification,
  sendRideStartedNotification,
  sendMessageNotification,
};

