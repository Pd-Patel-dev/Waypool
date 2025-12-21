import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Ride } from '@/services/api';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/designSystem';

export interface RideCardProps {
  ride: Ride;
  onPress: () => void;
  variant?: 'default' | 'compact';
}

// Format date to relative (Today, Tomorrow, or date)
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) return 'Today';
    if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

// Format time
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

export const RideCard: React.FC<RideCardProps> = ({ ride, onPress }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Top Row: Date & Time */}
      <View style={styles.headerRow}>
        <Text style={styles.dateText}>{formatDate(ride.departureTime)}</Text>
        <View style={styles.timeContainer}>
          <IconSymbol size={12} name="clock.fill" color={COLORS.textSecondary} />
          <Text style={styles.timeText}>{formatTime(ride.departureTime)}</Text>
        </View>
      </View>

      {/* Route: Compact vertical layout */}
      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <View style={styles.routeDot} />
          <Text style={styles.routeText} numberOfLines={1}>{ride.fromAddress}</Text>
        </View>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, styles.routeDotDest]} />
          <Text style={styles.routeText} numberOfLines={1}>{ride.toAddress}</Text>
        </View>
      </View>

      {/* Bottom Row: Info badges */}
      <View style={styles.infoRow}>
        <View style={styles.infoBadge}>
          <IconSymbol size={10} name="person.2.fill" color={COLORS.textSecondary} />
          <Text style={styles.infoText}>{ride.availableSeats || 0} seats</Text>
        </View>
        {(ride.pricePerSeat || ride.price) && (
          <View style={styles.infoBadge}>
            <Text style={styles.priceText}>${((ride.pricePerSeat || ride.price || 0)).toFixed(2)}</Text>
          </View>
        )}
        {ride.driverName && (
          <View style={styles.infoBadge}>
            <IconSymbol size={10} name="person.fill" color={COLORS.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1}>{ride.driverName}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  // Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  // Route Container
  routeContainer: {
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
  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs - 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.sm,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  priceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
