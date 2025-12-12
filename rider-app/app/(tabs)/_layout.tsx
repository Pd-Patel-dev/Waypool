import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  
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
