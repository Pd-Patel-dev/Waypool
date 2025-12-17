import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Notification } from '@/services/api';

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
}) => {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return { name: 'person.fill.badge.plus', color: '#4285F4' };
      case 'message':
        return { name: 'message.fill', color: '#34C759' };
      case 'ride-started':
        return { name: 'car.fill', color: '#FF9500' };
      case 'ride-completed':
        return { name: 'checkmark.circle.fill', color: '#34C759' };
      default:
        return { name: 'bell.fill', color: '#8E8E93' };
    }
  };

  const icon = getNotificationIcon(notification.type);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        notification.unread && styles.containerUnread,
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${icon.color}20` },
        ]}
      >
        <IconSymbol size={24} name={icon.name as any} color={icon.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          {notification.unread && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>

        <Text style={styles.time}>{notification.time}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  containerUnread: {
    backgroundColor: '#1E2835',
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.3)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  message: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: '#666666',
  },
});





