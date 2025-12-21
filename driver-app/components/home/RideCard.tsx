import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { theme } from '@/design-system';
import { RideStatusService } from '@/features/rides/domain';
import { calculateTotalDistance } from '@/utils/distance';
import { calculateRideEarnings } from '@/utils/price';
import { formatDate, formatTime, safeParseDate } from '@/utils/date';
import type { Ride } from '@/services/api';

// Helper function for relative date formatting
const formatDateWithRelative = (dateString: string): string => {
  const date = safeParseDate(dateString);
  if (!date) return formatDate(dateString);

  try {
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
      return formatDate(dateString);
    }
  } catch (error) {
    return formatDate(dateString);
  }
};

export interface RideCardProps {
  ride: Ride;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onStartRide?: () => void;
  showActions?: boolean;
  variant?: 'default' | 'compact' | 'elevated';
}

export const RideCard: React.FC<RideCardProps> = ({
  ride,
  onPress,
  onEdit,
  onDelete,
  onStartRide,
  showActions = true,
  variant = 'default',
}) => {
  const statusBadge = RideStatusService.getStatusBadge({
    ...ride,
    departureTime: new Date(ride.departureTime),
    status: (ride.status || 'scheduled') as any,
    passengers: ride.passengers || [],
  });

  const totalDistance = calculateTotalDistance(ride);
  const earnings = calculateRideEarnings(ride);
  const bookedSeats = ride.totalSeats - (ride.availableSeats || 0);
  const isToday = new Date(ride.departureTime).toDateString() === new Date().toDateString();
  const canStart = (ride.status === 'scheduled' || !ride.status) && isToday;

  const cardStyles = [
    styles.card,
    variant === 'elevated' && styles.cardElevated,
    variant === 'compact' && styles.cardCompact,
  ];

  return (
    <Pressable
      style={({ pressed }) => [
        ...cardStyles,
        { backgroundColor: theme.colors.surface.primary, borderColor: theme.colors.border },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.dateTimeContainer}>
            <Text style={[styles.dateText, { color: theme.colors.text.primary }]}>
              {formatDateWithRelative(ride.departureTime)}
            </Text>
            <View style={styles.timeBadge}>
              <IconSymbol size={12} name="clock.fill" color={theme.colors.text.secondary} />
              <Text style={[styles.timeText, { color: theme.colors.text.secondary }]}>
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
          <View style={[styles.routeDot, { backgroundColor: theme.colors.primary }]} />
          <View style={styles.routeContent}>
            <Text style={[styles.routeLabel, { color: theme.colors.text.tertiary }]}>From</Text>
            <Text style={[styles.routeAddress, { color: theme.colors.text.primary }]} numberOfLines={2}>
              {ride.fromAddress}
            </Text>
          </View>
        </View>

        <View style={[styles.routeLine, { backgroundColor: theme.colors.border }]} />

        <View style={styles.routeItem}>
          <View style={[styles.routeDot, styles.routeDotDest, { backgroundColor: theme.colors.success }]} />
          <View style={styles.routeContent}>
            <Text style={[styles.routeLabel, { color: theme.colors.text.tertiary }]}>To</Text>
            <Text style={[styles.routeAddress, { color: theme.colors.text.primary }]} numberOfLines={2}>
              {ride.toAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Section */}
      <View style={[styles.statsSection, { borderTopColor: theme.colors.border }]}>
        <View style={styles.statItem}>
          <IconSymbol size={14} name="person.2.fill" color={theme.colors.text.secondary} />
          <View style={styles.statContent}>
            <Text style={[styles.statValue, { color: theme.colors.text.primary }]} numberOfLines={1}>
              {bookedSeats > 0 ? bookedSeats : (ride.availableSeats || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
              {bookedSeats > 0 ? 'Booked' : 'Available'}
            </Text>
          </View>
        </View>

        {totalDistance > 0 && (
          <View style={styles.statItem}>
            <IconSymbol size={14} name="mappin.circle.fill" color={theme.colors.text.secondary} />
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.text.primary }]} numberOfLines={1}>
                {totalDistance.toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.tertiary }]} numberOfLines={1}>Miles</Text>
            </View>
          </View>
        )}

        {ride.pricePerSeat && (
          <View style={styles.statItem}>
            <IconSymbol size={14} name="dollarsign.circle.fill" color={theme.colors.primary} />
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.primary }]} numberOfLines={1}>
                ${ride.pricePerSeat.toFixed(2)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.tertiary }]} numberOfLines={1}>Per Seat</Text>
            </View>
          </View>
        )}

        {earnings > 0 && (
          <View style={styles.statItem}>
            <IconSymbol size={14} name="checkmark.circle.fill" color={theme.colors.success} />
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: theme.colors.success }]} numberOfLines={1}>
                ${earnings.toFixed(2)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.tertiary }]} numberOfLines={1}>Earned</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View style={[styles.actionsSection, { borderTopColor: theme.colors.border }]}>
          <View style={styles.actionButtonsLeft}>
            {canStart && onStartRide && (
              <TouchableOpacity
                style={[styles.startButton, { backgroundColor: theme.colors.primary }]}
                onPress={onStartRide}
                activeOpacity={0.8}
              >
                <IconSymbol size={16} name="play.fill" color="#000000" />
                <Text style={[styles.startButtonText, { color: '#000000' }]}>Start Ride</Text>
              </TouchableOpacity>
            )}
            {ride.status === 'in-progress' && (
              <TouchableOpacity
                style={[styles.viewButton, { borderColor: theme.colors.primary }]}
                onPress={onPress}
                activeOpacity={0.8}
              >
                <IconSymbol size={16} name="arrow.right.circle.fill" color={theme.colors.primary} />
                <Text style={[styles.viewButtonText, { color: theme.colors.primary }]}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionButtonsRight}>
            {onEdit && (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: `${theme.colors.primary}15` }]}
                onPress={onEdit}
                activeOpacity={0.7}
              >
                <IconSymbol size={18} name="pencil" color={theme.colors.primary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: `${theme.colors.error}15` }]}
                onPress={onDelete}
                activeOpacity={0.7}
              >
                <IconSymbol size={18} name="trash" color={theme.colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardElevated: {
    ...theme.shadows.lg,
    borderWidth: 0,
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
    padding: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginLeft: 12,
  },
  dateTimeContainer: {
    gap: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  routeSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  routeDotDest: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeContent: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 16,
    marginLeft: 4,
    marginVertical: 8,
    borderRadius: 1,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  statContent: {
    flexShrink: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  statSubtext: {
    fontSize: 10,
    fontWeight: '400',
    marginLeft: 2,
    flexShrink: 1,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  actionButtonsLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

