import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  setupPushNotifications,
  getBadgeCount,
  setBadgeCount,
  clearAllNotifications,
  handleNotificationTap,
} from '@/services/notificationService';
import { useUser } from './UserContext';

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
      console.error('Error refreshing badge count:', error);
    }
  }, []);

  // Clear badge count
  const clearBadge = useCallback(async () => {
    try {
      await setBadgeCount(0);
      setBadgeCountState(0);
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }, []);

  // Handle notification received while app is open
  const handleNotificationReceived = useCallback((notification: Notifications.Notification) => {
    console.log('📩 Notification received in app:', notification);
    // Increment badge count
    refreshBadgeCount();
  }, [refreshBadgeCount]);

  // Handle notification tap
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    console.log('👆 Notification tapped:', response);
    handleNotificationTap(response, router);
    // Clear badge when notification is tapped
    clearBadge();
  }, [router, clearBadge]);

  // Setup push notifications when user logs in
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const initNotifications = async () => {
      if (!user?.id) {
        console.log('⏳ No user logged in, skipping notification setup');
        setIsNotificationsEnabled(false);
        return;
      }

      console.log('🔔 Initializing push notifications for user:', user.id);

      // Setup push notifications
      cleanup = await setupPushNotifications(
        user.id,
        handleNotificationReceived,
        handleNotificationResponse
      );

      if (cleanup) {
        setIsNotificationsEnabled(true);
        console.log('✅ Push notifications enabled');
      } else {
        setIsNotificationsEnabled(false);
        console.log('⚠️ Push notifications not enabled');
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

  // Refresh badge count periodically (every 30 seconds)
  useEffect(() => {
    if (!user?.id || !isNotificationsEnabled) return;

    const interval = setInterval(() => {
      refreshBadgeCount();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
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

