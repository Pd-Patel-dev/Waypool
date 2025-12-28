import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RiderBooking } from '@/services/api';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/designSystem';

interface ConfirmedBookingCardProps {
  booking: RiderBooking;
  onEdit: () => void;
  onCancel: () => void;
  onTrack: () => void;
}

const formatDate = (dateString: string): string => {
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

export const ConfirmedBookingCard: React.FC<ConfirmedBookingCardProps> = ({
  booking,
  onEdit,
  onCancel,
  onTrack,
}) => {
  const isRideStarted = booking.ride.status === 'in-progress';
  const canEdit = !isRideStarted && booking.status === 'confirmed' && booking.ride.status !== 'completed' && booking.ride.status !== 'cancelled';

  return (
    <View style={styles.card}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.dateText}>
              {formatDate(booking.ride.departureTime)}
            </Text>
            <View style={styles.timeBadge}>
              <IconSymbol size={12} name="clock.fill" color={COLORS.textSecondary} />
              <Text style={styles.timeText}>
                {formatTime(booking.ride.departureTime)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: isRideStarted ? 'rgba(66, 133, 244, 0.15)' : 'rgba(52, 199, 89, 0.15)' }]}>
            <View style={[styles.statusDot, { backgroundColor: isRideStarted ? COLORS.primary : COLORS.success }]} />
            <Text style={[styles.statusText, { color: isRideStarted ? COLORS.primary : COLORS.success }]}>
              {isRideStarted ? 'IN PROGRESS' : 'CONFIRMED'}
            </Text>
          </View>
        </View>
      </View>

      {/* Route Section */}
      <View style={styles.routeSection}>
        <View style={styles.routeItem}>
          <View style={styles.routeDot} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>Pickup</Text>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {booking.pickupAddress}
            </Text>
          </View>
        </View>

        <View style={styles.routeLine} />

        <View style={styles.routeItem}>
          <View style={[styles.routeDot, styles.routeDotDest]} />
          <View style={styles.routeContent}>
            <Text style={styles.routeLabel}>Destination</Text>
            <Text style={styles.routeAddress} numberOfLines={2}>
              {booking.ride.toAddress}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <IconSymbol size={14} name="person.2.fill" color={COLORS.textSecondary} />
          <View style={styles.statContent}>
            <Text style={styles.statValue} numberOfLines={1}>
              {booking.numberOfSeats}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              Seat{booking.numberOfSeats !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {booking.ride.pricePerSeat && (
          <View style={styles.statItem}>
            <IconSymbol size={14} name="dollarsign.circle.fill" color={COLORS.primary} />
            <View style={styles.statContent}>
              <Text style={[styles.statValue, { color: COLORS.primary }]} numberOfLines={1}>
                ${(booking.ride.pricePerSeat * booking.numberOfSeats).toFixed(2)}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>Total</Text>
            </View>
          </View>
        )}

        {booking.ride.driverName && (
          <View style={styles.statItem}>
            <IconSymbol size={14} name="person.fill" color={COLORS.textSecondary} />
            <View style={styles.statContent}>
              <Text style={styles.statValue} numberOfLines={1}>
                {booking.ride.driverName.split(' ')[0]}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>Driver</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsSection}>
        {isRideStarted ? (
          <TouchableOpacity
            style={styles.trackButton}
            onPress={onTrack}
            activeOpacity={0.8}
          >
            <IconSymbol size={16} name="location.fill" color="#FFFFFF" />
            <Text style={styles.trackButtonText}>Track Driver</Text>
          </TouchableOpacity>
        ) : (
          <>
            {canEdit && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={onEdit}
                activeOpacity={0.8}
              >
                <IconSymbol size={16} name="pencil" color={COLORS.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <IconSymbol size={16} name="xmark.circle.fill" color={COLORS.error} />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: 'hidden',
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
    color: COLORS.textPrimary,
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
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.primary,
  },
  routeDotDest: {
    backgroundColor: COLORS.error,
  },
  routeContent: {
    flex: 1,
    gap: 2,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 16,
    marginLeft: 4,
    marginVertical: 8,
    borderRadius: 1,
    backgroundColor: COLORS.border,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
  },
});
