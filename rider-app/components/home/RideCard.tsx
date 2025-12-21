import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Ride } from '@/services/api';

export interface RideCardProps {
  ride: Ride;
  onPress: () => void;
  variant?: 'default' | 'compact';
}

// Helper function for relative date formatting
const formatDateWithRelative = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
      return 'Today';
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  } catch {
    return dateString;
  }
};

const formatTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch {
    return '';
  }
};

// Get status badge for ride
const getStatusBadge = (ride: Ride) => {
  if (ride.status === 'in-progress') {
    return {
      text: 'IN PROGRESS',
      color: '#4285F4',
      bgColor: 'rgba(66, 133, 244, 0.15)',
    };
  }
  if (ride.status === 'completed') {
    return {
      text: 'COMPLETED',
      color: '#34C759',
      bgColor: 'rgba(52, 199, 89, 0.15)',
    };
  }
  if (ride.status === 'cancelled') {
    return {
      text: 'CANCELLED',
      color: '#FF3B30',
      bgColor: 'rgba(255, 59, 48, 0.15)',
    };
  }
  // Default to scheduled/upcoming
  return {
    text: 'SCHEDULED',
    color: '#FFD60A',
    bgColor: 'rgba(255, 214, 10, 0.15)',
  };
};

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onPress,
  variant = 'default',
}) => {
  const statusBadge = getStatusBadge(ride);
  const cardStyles = [
    styles.card,
    variant === 'compact' && styles.cardCompact,
  ];

  return (
    <Pressable
      style={({ pressed }) => [
        ...cardStyles,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.dateText}>
              {formatDateWithRelative(ride.departureTime)}
            </Text>
            <View style={styles.timeBadge}>
              <IconSymbol size={12} name="clock.fill" color="#999999" />
              <Text style={styles.timeText}>
                {formatTime(ride.departureTime)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusBadge.color }]} />
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.text}
            </Text>
          </View>
        </View>
      </View>

      {/* Route Section */}
      <View style={styles.routeSection}>
        <View style={styles.routeItem}>
          <View style={styles.routeDot} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>From</Text>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {ride.fromAddress}
            </Text>
          </View>
        </View>

        <View style={styles.routeLine} />

        <View style={styles.routeItem}>
          <View style={[styles.routeDot, styles.routeDotDest]} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>To</Text>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {ride.toAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        {/* First Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <IconSymbol size={12} name="person.2.fill" color="#999999" />
            <View style={styles.statContent}>
              <Text style={styles.statValue} numberOfLines={1}>
                {ride.availableSeats || 0}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>Available</Text>
            </View>
          </View>

          {ride.distance && typeof ride.distance === 'number' && ride.distance > 0 && (
            <View style={styles.statItem}>
              <IconSymbol size={12} name="mappin.circle.fill" color="#999999" />
              <View style={styles.statContent}>
                <Text style={styles.statValue} numberOfLines={1}>
                  {ride.distance.toFixed(1)}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>Miles</Text>
              </View>
            </View>
          )}
        </View>

        {/* Second Row */}
        <View style={styles.statsRow}>
          {(ride.pricePerSeat || ride.price) && (
            <View style={styles.statItem}>
              <IconSymbol size={12} name="dollarsign.circle.fill" color="#4285F4" />
              <View style={styles.statContent}>
                <Text style={[styles.statValue, styles.priceValue]} numberOfLines={1}>
                  ${((ride.pricePerSeat || ride.price || 0)).toFixed(2)}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>Per Seat</Text>
              </View>
            </View>
          )}

          <View style={styles.statItem}>
            <IconSymbol size={12} name="person.fill" color="#4285F4" />
            <View style={styles.statContent}>
              <Text style={styles.statValue} numberOfLines={1}>
                {ride.driverName || 'Driver'}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>Driver</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardCompact: {
    padding: 16,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginLeft: 12,
  },
  dateTimeContainer: {
    gap: 6,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#FFFFFF',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  routeSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: '#4285F4',
  },
  routeDotDest: {
    backgroundColor: '#FF3B30',
  },
  routeContent: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    color: '#999999',
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: '#FFFFFF',
  },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: '#2A2A2C',
    marginLeft: 3,
    marginVertical: 6,
    borderRadius: 1,
  },
  statsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  statContent: {
    flexShrink: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    color: '#FFFFFF',
  },
  priceValue: {
    color: '#4285F4',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
    color: '#999999',
  },
});
