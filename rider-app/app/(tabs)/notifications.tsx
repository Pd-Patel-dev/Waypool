import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, type Notification } from '@/services/api';
import { websocketService } from '@/services/websocket';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, RESPONSIVE_SPACING } from '@/constants/designSystem';

export default function NotificationsScreen(): React.JSX.Element {
  const { user, isLoading: userLoading } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const response = await getNotifications();
      
      if (response.success && response.notifications) {
        setNotifications(response.notifications);
      }
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      // Only show error for authentication issues, not network errors
      // Network errors are often temporary and should be handled silently
      if (error.status === 401) {
        // Auth error - user will be redirected by auth context
        return;
      }
      // Don't show alert for network errors - they're usually temporary
      // User can pull to refresh if needed
      if (error.status && error.status !== 0) {
        // Only show alert for actual server errors, not network failures
        console.log('Server error fetching notifications:', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  // Setup WebSocket for real-time notification updates
  useEffect(() => {
    if (!user?.id) return;

    const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    
    // Connect to WebSocket
    websocketService.connect(riderId);

    // Listen for real-time notification events
    const handleNewNotification = () => {
      // Refresh notifications when a new one arrives
      fetchNotifications();
    };

    const handleNotificationRead = () => {
      // Refresh notifications when one is marked as read
      fetchNotifications();
    };

    websocketService.on('notification:new', handleNewNotification);
    websocketService.on('notification:read', handleNotificationRead);
    websocketService.on('notification:badge_update', fetchNotifications);

    return () => {
      websocketService.off('notification:new', handleNewNotification);
      websocketService.off('notification:read', handleNotificationRead);
      websocketService.off('notification:badge_update');
      // Don't disconnect here - let it stay connected for badge updates in tab bar
    };
  }, [user?.id, fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAsRead = useCallback(async (notificationId: number) => {
    try {
      await markNotificationAsRead(notificationId);
      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, unread: false } : notif
        )
      );
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      Alert.alert('Error', 'Failed to mark notification as read.');
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      // Update local state
      setNotifications(prev => prev.map(notif => ({ ...notif, unread: false })));
      Alert.alert('Success', 'All notifications marked as read.');
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read.');
    }
  }, []);

  const handleNotificationPress = useCallback((notification: Notification) => {
    // Mark as read if unread
    if (notification.unread) {
      handleMarkAsRead(notification.id);
    }

    // Only navigate to tracking if the ride has started (status is "in-progress")
    if (notification.booking) {
      const rideStatus = notification.booking.ride?.status;
      if (rideStatus === 'in-progress') {
        // Navigate to track driver only if ride is in progress
        router.push({
          pathname: '/track-driver',
          params: {
            booking: JSON.stringify(notification.booking),
          },
        });
      }
      // Otherwise, just mark as read (no navigation for simple notifications)
    } else if (notification.ride) {
      // For ride notifications without booking, navigate to ride details
      router.push({
        pathname: '/ride-details',
        params: {
          ride: JSON.stringify(notification.ride),
        },
      });
    }
  }, [handleMarkAsRead]);

  const unreadCount = notifications.filter(n => n.unread).length;

  if (userLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            style={styles.markAllButton}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            progressBackgroundColor={COLORS.surface}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <IconSymbol size={56} name="bell" color={COLORS.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtext}>
              You'll see notifications about your rides and bookings here
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  notification.unread && styles.notificationCardUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.7}
              >
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    {notification.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                  
                  {notification.booking && (
                    <View style={styles.notificationDetails}>
                      <IconSymbol size={14} name="car" color={COLORS.textSecondary} />
                      <Text style={styles.notificationDetailText}>
                        {notification.booking.ride.fromCity} → {notification.booking.ride.toCity}
                      </Text>
                    </View>
                  )}

                  <View style={styles.notificationFooter}>
                    <Text style={styles.notificationTime}>{notification.time}</Text>
                    {/* Only show chevron if notification is actionable (ride is in-progress) */}
                    {notification.booking?.ride?.status === 'in-progress' && (
                      <IconSymbol size={14} name="chevron.right" color={COLORS.textTertiary} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    ...TYPOGRAPHY.h1,
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  markAllButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.base,
  },
  markAllText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.base,
  },
  loadingText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl * 2,
    paddingHorizontal: RESPONSIVE_SPACING.padding,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationsList: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.lg,
    gap: SPACING.base,
  },
  notificationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notificationCardUnread: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: 'rgba(66, 133, 244, 0.05)',
  },
  notificationContent: {
    gap: SPACING.xs,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  notificationTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  notificationMessage: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  notificationDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  notificationDetailText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  notificationTime: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});

