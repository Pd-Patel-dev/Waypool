import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface NotificationFiltersProps {
  selectedTab: 'all' | 'requests';
  unreadCount: number;
  onTabChange: (tab: 'all' | 'requests') => void;
}

export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  selectedTab,
  unreadCount,
  onTabChange,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          selectedTab === 'all' && styles.tabButtonActive,
        ]}
        onPress={() => onTabChange('all')}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabText,
            selectedTab === 'all' && styles.tabTextActive,
          ]}
        >
          All
        </Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tabButton,
          selectedTab === 'requests' && styles.tabButtonActive,
        ]}
        onPress={() => onTabChange('requests')}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabText,
            selectedTab === 'requests' && styles.tabTextActive,
          ]}
        >
          Booking Requests
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  tabButtonActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});





