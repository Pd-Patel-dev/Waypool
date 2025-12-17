import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface RideInfoCardProps {
  fromAddress: string;
  fromCity: string | null;
  toAddress: string;
  toCity: string | null;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  distance: number | null;
  pricePerSeat: number | null;
  status: string;
}

export const RideInfoCard: React.FC<RideInfoCardProps> = ({
  fromAddress,
  fromCity,
  toAddress,
  toCity,
  departureDate,
  departureTime,
  totalSeats,
  availableSeats,
  distance,
  pricePerSeat,
  status,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'in-progress':
        return { color: '#34C759', text: 'In Progress', icon: 'car.fill' };
      case 'scheduled':
        return { color: '#FF9500', text: 'Scheduled', icon: 'clock.fill' };
      case 'completed':
        return { color: '#4285F4', text: 'Completed', icon: 'checkmark.circle.fill' };
      case 'cancelled':
        return { color: '#FF3B30', text: 'Cancelled', icon: 'xmark.circle.fill' };
      default:
        return { color: '#8E8E93', text: status, icon: 'circle.fill' };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride Details</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusBadge.color}20` }]}>
          <IconSymbol size={14} name={statusBadge.icon as any} color={statusBadge.color} />
          <Text style={[styles.statusText, { color: statusBadge.color }]}>
            {statusBadge.text}
          </Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <IconSymbol size={20} name="location.circle.fill" color="#34C759" />
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>From</Text>
            <Text style={styles.addressText}>
              {fromCity || fromAddress}
            </Text>
          </View>
        </View>

        <View style={styles.routeDivider} />

        <View style={styles.routeRow}>
          <IconSymbol size={20} name="location.fill" color="#FF3B30" />
          <View style={styles.addressInfo}>
            <Text style={styles.addressLabel}>To</Text>
            <Text style={styles.addressText}>
              {toCity || toAddress}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <IconSymbol size={18} name="calendar" color="#8E8E93" />
          <Text style={styles.detailText}>{departureDate}</Text>
        </View>

        <View style={styles.detailItem}>
          <IconSymbol size={18} name="clock" color="#8E8E93" />
          <Text style={styles.detailText}>{departureTime}</Text>
        </View>

        {distance && (
          <View style={styles.detailItem}>
            <IconSymbol size={18} name="arrow.left.arrow.right" color="#8E8E93" />
            <Text style={styles.detailText}>{distance.toFixed(1)} mi</Text>
          </View>
        )}

        <View style={styles.detailItem}>
          <IconSymbol size={18} name="person.2.fill" color="#8E8E93" />
          <Text style={styles.detailText}>
            {totalSeats - availableSeats}/{totalSeats} seats
          </Text>
        </View>

        {pricePerSeat && (
          <View style={styles.detailItem}>
            <IconSymbol size={18} name="dollarsign.circle" color="#8E8E93" />
            <Text style={styles.detailText}>${pricePerSeat}/seat</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  routeContainer: {
    gap: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressInfo: {
    flex: 1,
    gap: 4,
  },
  addressLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  routeDivider: {
    width: 2,
    height: 20,
    backgroundColor: '#3A3A3C',
    marginLeft: 9,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  detailText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});





