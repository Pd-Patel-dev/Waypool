import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Card from '@/components/common/Card';
import type { Ride } from '@/services/api';

interface AddressDetails {
  fullAddress: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface RouteInfoCardProps {
  ride: Ride;
  pickupDetails: AddressDetails;
  formatDate: (dateString: string) => string;
  formatTime: (dateString: string) => string;
}

export default function RouteInfoCard({
  ride,
  pickupDetails,
  formatDate,
  formatTime,
}: RouteInfoCardProps): React.JSX.Element {
  return (
    <Card style={styles.card}>
      <View style={styles.routeRow}>
        <View style={styles.routeDot} />
        <View style={styles.routeText}>
          <Text style={styles.routeFrom}>{ride.fromCity}</Text>
          <Text style={styles.routeTo}>{ride.toCity}</Text>
        </View>
      </View>

      <View style={styles.divider} />
      
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <IconSymbol name="calendar" size={14} color="#999999" />
          <Text style={styles.detailText}>{formatDate(ride.departureTime)}</Text>
        </View>
        <View style={styles.detailItem}>
          <IconSymbol name="clock" size={14} color="#999999" />
          <Text style={styles.detailText}>{formatTime(ride.departureTime)}</Text>
        </View>
      </View>

      <View style={styles.pickupRow}>
        <IconSymbol name="mappin" size={14} color="#4285F4" />
        <Text style={styles.pickupText} numberOfLines={1}>{pickupDetails.fullAddress}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
    marginRight: 10,
  },
  routeText: {
    flex: 1,
  },
  routeFrom: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  routeTo: {
    fontSize: 13,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2C',
    marginVertical: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickupText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
    flex: 1,
  },
});

