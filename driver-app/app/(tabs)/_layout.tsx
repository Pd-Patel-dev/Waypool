import { Tabs } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import { useNotifications } from '@/context/NotificationContext';
import { getNotifications } from '@/services/api';
import { TIME } from '@/utils/constants';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const { user } = useUser();
  const { badgeCount: systemBadgeCount } = useNotifications();
  const [notificationBadgeCount, setNotificationBadgeCount] = React.useState(0);

  // Fetch notification count from API
  React.useEffect(() => {
    const fetchBadgeCount = async () => {
      if (!user?.id) return;
      
      try {
        const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
        const response = await getNotifications(driverId);
        if (response.success) {
          const unreadNotifications = response.notifications.filter((n) => n.unread).length;
          setNotificationBadgeCount(unreadNotifications);
        }
      } catch (error) {
      }
    };

    fetchBadgeCount();
    const interval = setInterval(fetchBadgeCount, TIME.TAB_NOTIFICATION_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [user?.id]);

  // Use the higher of system badge or unread notifications
  const displayBadgeCount = Math.max(systemBadgeCount, notificationBadgeCount);
  
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
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, focused }) => (
              <IconSymbol 
              size={24} 
                name={focused ? "chart.bar.fill" : "chart.bar"}
              color={color} 
              />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <IconSymbol 
              size={24} 
                name={focused ? "envelope.fill" : "envelope"}
              color={color} 
              />
              {displayBadgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {displayBadgeCount > 99 ? '99+' : displayBadgeCount}
                  </Text>
                </View>
              )}
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

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#000000',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

