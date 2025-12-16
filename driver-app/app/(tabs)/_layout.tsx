import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import { getNotifications } from '@/services/api';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const { user } = useUser();
  const [notificationBadgeCount, setNotificationBadgeCount] = React.useState(0);

  // Fetch notification count
  React.useEffect(() => {
    const fetchBadgeCount = async () => {
      if (!user?.id) return;
      
      try {
        const driverId = typeof user.id === "string" ? parseInt(user.id) : user.id;
        const response = await getNotifications(driverId);
        if (response.success) {
          const unreadNotifications = response.notifications.filter((n) => n.unread).length;
          setNotificationBadgeCount(unreadNotifications);
        }
      } catch (error) {
        console.error("Error fetching badge count:", error);
      }
    };

    fetchBadgeCount();
    const interval = setInterval(fetchBadgeCount, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user?.id]);
  
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
              {notificationBadgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
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

