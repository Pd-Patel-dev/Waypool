import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  setupPushNotifications,
  getBadgeCount,
  setBadgeCount,
  handleNotificationTap,
} from '@/services/notificationService';
import { useUser } from './UserContext';
import { websocketService } from '@/services/websocket';
import { TIME } from '@/utils/constants';

interface NotificationContextType {
  badgeCount: number;
  refreshBadgeCount: () => Promise<void>;
  clearBadge: () => Promise<void>;
  isNotificationsEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  badgeCount: 0,
  refreshBadgeCount: async () => {},
  clearBadge: async () => {},
  isNotificationsEnabled: false,
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const router = useRouter();
  const [badgeCount, setBadgeCountState] = useState(0);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);

  // Refresh badge count from system
  const refreshBadgeCount = useCallback(async () => {
    try {
      const count = await getBadgeCount();
      setBadgeCountState(count);
    } catch (error) {
    }
  }, []);

  // Clear badge count
  const clearBadge = useCallback(async () => {
    try {
      await setBadgeCount(0);
      setBadgeCountState(0);
    } catch (error) {
    }
  }, []);

  // Handle notification received while app is open
  const handleNotificationReceived = useCallback((notification: Notifications.Notification) => {
    // Increment badge count
    refreshBadgeCount();
  }, [refreshBadgeCount]);

  // Handle notification tap
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    handleNotificationTap(response, router);
    // Clear badge when notification is tapped
    clearBadge();
  }, [router, clearBadge]);

  // Setup push notifications when user logs in
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const initNotifications = async () => {
      if (!user?.id) {
        setIsNotificationsEnabled(false);
        return;
      }


      // Setup push notifications
      cleanup = await setupPushNotifications(
        user.id,
        handleNotificationReceived,
        handleNotificationResponse
      );

      if (cleanup) {
        setIsNotificationsEnabled(true);
      } else {
        setIsNotificationsEnabled(false);
      }

      // Get initial badge count
      await refreshBadgeCount();
    };

    initNotifications();

    // Cleanup on unmount or user change
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [user?.id, handleNotificationReceived, handleNotificationResponse, refreshBadgeCount]);

  // Setup WebSocket for real-time badge updates (replaces polling)
  useEffect(() => {
    if (!user?.id || !isNotificationsEnabled) return;

    const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
    
    // Connect to WebSocket with JWT authentication
    websocketService.connect(driverId).catch((error) => {
      console.error('Failed to connect WebSocket:', error);
    });

    // Listen for real-time notification events
    const handleNewNotification = () => {
      refreshBadgeCount();
    };

    const handleNotificationRead = () => {
      refreshBadgeCount();
    };

    websocketService.on('notification:new', handleNewNotification);
    websocketService.on('notification:read', handleNotificationRead);
    websocketService.on('notification:badge_update', refreshBadgeCount);

    // Fallback: Refresh badge count at configured interval (reduced from 30s since we have WebSocket)
    const interval = setInterval(() => {
      if (!websocketService.isConnected()) {
        refreshBadgeCount();
      }
    }, TIME.NOTIFICATION_REFRESH_INTERVAL);

    return () => {
      websocketService.off('notification:new', handleNewNotification);
      websocketService.off('notification:read', handleNotificationRead);
      websocketService.off('notification:badge_update');
      clearInterval(interval);
      websocketService.disconnect();
    };
  }, [user?.id, isNotificationsEnabled, refreshBadgeCount]);

  const value = {
    badgeCount,
    refreshBadgeCount,
    clearBadge,
    isNotificationsEnabled,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}





