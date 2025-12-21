import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RiderBooking } from '@/services/api';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/designSystem';

interface ActiveBookingCardProps {
  booking: RiderBooking;
  onPress: () => void;
}

export const ActiveBookingCard: React.FC<ActiveBookingCardProps> = ({
  booking,
  onPress,
}) => {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Status Badge */}
      <View style={styles.statusBadge}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>ACTIVE RIDE</Text>
      </View>

      {/* Route */}
      <View style={styles.routeSection}>
        <View style={styles.routeRow}>
          <View style={styles.routeDot} />
          <Text style={styles.routeText} numberOfLines={1}>{booking.ride.fromAddress}</Text>
        </View>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, styles.routeDotDest]} />
          <Text style={styles.routeText} numberOfLines={1}>{booking.ride.toAddress}</Text>
        </View>
      </View>

      {/* Footer with driver and track button */}
      <View style={styles.footer}>
        <View style={styles.driverInfo}>
          <IconSymbol size={12} name="person.fill" color={COLORS.textSecondary} />
          <Text style={styles.driverText} numberOfLines={1}>{booking.ride.driverName}</Text>
        </View>
        <TouchableOpacity
          style={styles.trackButton}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.trackButtonText}>Track</Text>
          <IconSymbol size={14} name="chevron.right" color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primaryTint,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs - 1,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  routeSection: {
    gap: SPACING.xs + 2,
    marginBottom: SPACING.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  routeDotDest: {
    backgroundColor: COLORS.error,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  driverText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs - 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  trackButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
