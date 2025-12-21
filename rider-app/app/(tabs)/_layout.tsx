import { Tabs } from 'expo-router';
import React, { useState, useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { getNotifications } from '@/services/api';
import { websocketService } from '@/services/websocket';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Badge component for notification count
function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;
  
  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.badgeText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await getNotifications();
      if (response.success && response.notifications) {
        const unread = response.notifications.filter(n => n.unread).length;
        setUnreadCount(unread);
      }
    } catch (error: any) {
      // Silently fail - don't show error for badge count
      // Network errors are common and shouldn't spam the console
      if (error.status === 401) {
        // Auth error - reset count
        setUnreadCount(0);
      }
      // For network errors or other failures, just keep existing count
      // Don't log to avoid console spam
    }
  }, [user?.id]);

  // Setup WebSocket for real-time badge updates
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    
    // Connect to WebSocket
    websocketService.connect(riderId);

    // Listen for real-time notification events
    const handleNewNotification = () => {
      fetchUnreadCount();
    };

    const handleNotificationRead = () => {
      fetchUnreadCount();
    };

    websocketService.on('notification:new', handleNewNotification);
    websocketService.on('notification:read', handleNotificationRead);
    websocketService.on('notification:badge_update', fetchUnreadCount);

    // Initial fetch
    fetchUnreadCount();

    // Fallback: Refresh badge count at interval if WebSocket is disconnected
    const interval = setInterval(() => {
      if (!websocketService.isConnected()) {
        fetchUnreadCount();
      }
    }, 30000); // 30 seconds fallback

    return () => {
      websocketService.off('notification:new', handleNewNotification);
      websocketService.off('notification:read', handleNotificationRead);
      websocketService.off('notification:badge_update');
      clearInterval(interval);
    };
  }, [user?.id, fetchUnreadCount]);
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4285F4',
        tabBarInactiveTintColor: '#666666',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopWidth: 1,
          borderTopColor: '#1A1A1A',
          height: 65 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          paddingHorizontal: 0,
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={24} 
              name={focused ? "house.fill" : "house"}
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={24} 
              name={focused ? "clock.fill" : "clock"}
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <IconSymbol 
                size={24} 
                name={focused ? "bell.fill" : "bell"}
                color={color} 
              />
              <NotificationBadge count={unreadCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={24} 
              name="line.3.horizontal"
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
