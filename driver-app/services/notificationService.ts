import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { API_BASE_URL } from '@/config/api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  type: 'expo' | 'fcm' | 'apns';
}

/**
 * Request notification permissions from user
 * @returns true if permissions granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (!Device.isDevice) {
      console.log('📱 Push notifications only work on physical devices');
      return false;
    }

    // Check current permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permissions denied');
      return false;
    }

    console.log('✅ Notification permissions granted');
    return true;
  } catch (error) {
    console.error('❌ Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get Expo Push Token for this device
 * @returns Push token object or null if failed
 */
export async function getExpoPushToken(): Promise<PushNotificationToken | null> {
  try {
    if (!Device.isDevice) {
      console.log('📱 Cannot get push token on simulator/emulator');
      return null;
    }

    // Get Expo push token
    // Note: projectId will be automatically detected from app.json after EAS init
    const tokenData = await Notifications.getExpoPushTokenAsync();

    console.log('✅ Expo Push Token:', tokenData.data);

    return {
      token: tokenData.data,
      type: 'expo',
    };
  } catch (error) {
    console.error('❌ Error getting push token:', error);
    return null;
  }
}

/**
 * Register push token with backend
 * @param userId - Driver user ID
 * @param pushToken - Push token object
 * @returns true if successful
 */
export async function registerPushToken(
  userId: number,
  pushToken: PushNotificationToken
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/driver/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        pushToken: pushToken.token,
        tokenType: pushToken.type,
        platform: Platform.OS,
        deviceId: Device.osInternalBuildId || 'unknown',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register push token');
    }

    const result = await response.json();
    console.log('✅ Push token registered with backend');
    return result.success;
  } catch (error) {
    console.error('❌ Error registering push token:', error);
    return false;
  }
}

/**
 * Setup push notifications for driver
 * - Requests permissions
 * - Gets push token
 * - Registers token with backend
 * - Sets up notification listeners
 * 
 * @param userId - Driver user ID
 * @param onNotificationReceived - Callback when notification received
 * @param onNotificationTapped - Callback when notification tapped
 * @returns Cleanup function to remove listeners
 */
export async function setupPushNotifications(
  userId: number,
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
): Promise<(() => void) | null> {
  try {
    console.log('🔔 Setting up push notifications...');

    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      Alert.alert(
        'Notifications Disabled',
        'Enable notifications in Settings to receive booking alerts and messages.',
        [{ text: 'OK' }]
      );
      return null;
    }

    // Get push token
    const pushToken = await getExpoPushToken();
    if (!pushToken) {
      console.log('⚠️ Could not get push token');
      return null;
    }

    // Register with backend
    await registerPushToken(userId, pushToken);

    // Setup notification listeners
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📩 Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });

    console.log('✅ Push notifications setup complete');

    // Return cleanup function
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
      console.log('🔕 Push notification listeners removed');
    };
  } catch (error) {
    console.error('❌ Error setting up push notifications:', error);
    return null;
  }
}

/**
 * Get notification badge count
 * @returns Current badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return count;
  } catch (error) {
    console.error('❌ Error getting badge count:', error);
    return 0;
  }
}

/**
 * Set notification badge count
 * @param count - Badge count to set
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('❌ Error setting badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await setBadgeCount(0);
    console.log('✅ All notifications cleared');
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
  }
}

/**
 * Schedule a local notification (for testing or reminders)
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data payload
 * @param delaySeconds - Delay before showing (default: immediate)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  delaySeconds: number = 0
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: delaySeconds > 0 ? { seconds: delaySeconds } : null,
    });

    console.log('✅ Local notification scheduled:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification
 * @param notificationId - ID of notification to cancel
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('✅ Notification cancelled:', notificationId);
  } catch (error) {
    console.error('❌ Error cancelling notification:', error);
  }
}

/**
 * Handle notification tap - navigate to appropriate screen
 * @param response - Notification response object
 * @param router - Expo router instance
 */
export function handleNotificationTap(
  response: Notifications.NotificationResponse,
  router: any
): void {
  try {
    const data = response.notification.request.content.data;
    console.log('📍 Handling notification tap with data:', data);

    // Route based on notification type
    if (data.type === 'booking_request' && data.bookingId) {
      router.push(`/booking-request?id=${data.bookingId}`);
    } else if (data.type === 'message' && data.senderId) {
      router.push(`/chat?userId=${data.senderId}`);
    } else if (data.type === 'ride_update' && data.rideId) {
      router.push(`/current-ride?id=${data.rideId}`);
    } else if (data.type === 'booking_accepted' || data.type === 'booking_rejected') {
      router.push('/(tabs)/inbox');
    } else {
      // Default: go to inbox
      router.push('/(tabs)/inbox');
    }
  } catch (error) {
    console.error('❌ Error handling notification tap:', error);
  }
}

export default {
  setupPushNotifications,
  requestNotificationPermissions,
  getExpoPushToken,
  registerPushToken,
  getBadgeCount,
  setBadgeCount,
  clearAllNotifications,
  scheduleLocalNotification,
  cancelNotification,
  handleNotificationTap,
};

