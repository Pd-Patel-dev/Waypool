import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RiderBooking } from '@/services/api';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, BUTTONS, RESPONSIVE_SPACING } from '@/constants/designSystem';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>
              {isRideStarted ? 'LIVE RIDE' : 'CONFIRMED'}
            </Text>
          </View>
        </View>
        {canEdit && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={onEdit}
            activeOpacity={0.7}
          >
            <IconSymbol size={18} name="pencil" color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.dateTimeRow}>
          <Text style={styles.dateText}>{formatDate(booking.ride.departureTime)}</Text>
          <Text style={styles.timeText}>{formatTime(booking.ride.departureTime)}</Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routeItem}>
            <View style={styles.routeDot} />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.pickupAddress}
            </Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, styles.routeDotDest]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.ride.toAddress}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <IconSymbol size={12} name="person.2.fill" color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{booking.numberOfSeats} seat{booking.numberOfSeats !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.detailItem}>
            <IconSymbol size={12} name="person.fill" color={COLORS.textSecondary} />
            <Text style={styles.detailText}>{booking.ride.driverName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
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
                style={styles.editActionButton}
                onPress={onEdit}
                activeOpacity={0.8}
              >
                <IconSymbol size={16} name="pencil" color="#4285F4" />
                <Text style={styles.editActionText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <IconSymbol size={16} name="xmark.circle.fill" color="#FF3B30" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginBottom: SPACING.base,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.successTint,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.successTint,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 1,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  badgeText: {
    ...TYPOGRAPHY.badge,
    color: COLORS.success,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.base,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dateText: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  timeText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  routeContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  routeDotDest: {
    backgroundColor: COLORS.error,
  },
  routeText: {
    flex: 1,
    minWidth: 0,
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
  },
  routeConnector: {
    width: 2,
    height: 10,
    backgroundColor: COLORS.border,
    marginLeft: 3,
    borderRadius: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: SPACING.base,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  detailText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.base,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    ...BUTTONS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  trackButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryTint,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editActionText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.errorTint,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelButtonText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.error,
  },
});

