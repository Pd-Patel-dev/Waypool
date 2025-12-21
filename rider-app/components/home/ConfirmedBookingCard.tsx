import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RiderBooking } from '@/services/api';

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
            <IconSymbol size={18} name="pencil" color="#4285F4" />
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
            <IconSymbol size={12} name="person.2.fill" color="#999999" />
            <Text style={styles.detailText}>{booking.numberOfSeats} seat{booking.numberOfSeats !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.detailItem}>
            <IconSymbol size={12} name="person.fill" color="#999999" />
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
    backgroundColor: '#1C1C1E',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#34C75940',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34C759',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
  },
  routeContainer: {
    gap: 8,
    marginBottom: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  routeDotDest: {
    backgroundColor: '#FF3B30',
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  routeConnector: {
    width: 2,
    height: 10,
    backgroundColor: '#2A2A2C',
    marginLeft: 3,
    borderRadius: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#999999',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    borderRadius: 12,
  },
  trackButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  editActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4285F4',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
});

