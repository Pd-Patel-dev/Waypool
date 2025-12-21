import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { RiderBooking } from '@/services/api';

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
      <View style={styles.liveHeader}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>ACTIVE RIDE</Text>
        </View>
        <TouchableOpacity
          style={styles.viewRideButton}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.viewRideButtonText}>Track</Text>
          <IconSymbol size={14} name="chevron.right" color="#4285F4" />
        </TouchableOpacity>
      </View>

      <View style={styles.info}>
        <View style={styles.statusRow}>
          <IconSymbol size={16} name="car.fill" color="#4285F4" />
          <Text style={styles.statusLabel}>Your Active Booking</Text>
        </View>
        <Text style={styles.routeLabel}>Route</Text>
        <View style={styles.routeContainer}>
          <View style={styles.routeItem}>
            <View style={styles.routeIndicator} />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.ride.fromAddress}
            </Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeItem}>
            <View style={[styles.routeIndicator, styles.routeIndicatorDest]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {booking.ride.toAddress}
            </Text>
          </View>
        </View>
        
        <View style={styles.driverInfo}>
          <IconSymbol size={14} name="person.fill" color="#FFFFFF" />
          <Text style={styles.driverText}>
            Driver: {booking.ride.driverName}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F0F0F',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4285F4',
    letterSpacing: 1.2,
  },
  viewRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
  },
  viewRideButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4285F4',
  },
  info: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  routeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  routeIndicatorDest: {
    backgroundColor: '#FF3B30',
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  routeConnector: {
    width: 2,
    height: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.3)',
    marginLeft: 3,
    marginVertical: 2,
    borderRadius: 1,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  driverText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.7,
  },
});

