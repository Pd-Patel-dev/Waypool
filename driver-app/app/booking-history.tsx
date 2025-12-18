import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import { getUpcomingRides, getPastRides } from '@/services/api';
import { InlineLoader } from '@/components/LoadingScreen';

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

export default function BookingHistoryScreen(): React.JSX.Element {
  const { user } = useUser();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const fetchBookings = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
      
      // Get all rides (upcoming and past)
      const [upcomingRides, pastRides] = await Promise.all([
        getUpcomingRides(driverId),
        getPastRides(driverId),
      ]);

      // Extract all bookings from rides
      const allBookings: any[] = [];
      
      [...upcomingRides, ...pastRides].forEach((ride) => {
        if (ride.passengers && ride.passengers.length > 0) {
          ride.passengers.forEach((passenger: any) => {
            allBookings.push({
              ...passenger,
              rideId: ride.id,
              rideFrom: ride.fromAddress,
              rideTo: ride.toAddress,
              rideDate: ride.departureDate,
              rideTime: ride.departureTimeString,
              rideStatus: ride.status,
              pricePerSeat: ride.pricePerSeat,
            });
          });
        }
      });

      // Sort by creation date (newest first)
      allBookings.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setBookings(allBookings);
    } catch (error) {
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = bookings.filter((booking) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return booking.status === 'pending';
    if (filterStatus === 'confirmed') return booking.status === 'confirmed';
    if (filterStatus === 'completed') return booking.status === 'completed';
    if (filterStatus === 'cancelled') return booking.status === 'cancelled';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#34C759';
      case 'pending':
        return '#FFD60A';
      case 'completed':
        return '#4285F4';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#999999';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking History</Text>
        <View style={styles.backButton} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as FilterStatus[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterTab, filterStatus === status && styles.filterTabActive]}
              onPress={() => setFilterStatus(status)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filterStatus === status && styles.filterTabTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <InlineLoader message="Loading bookings..." size="large" />
      ) : filteredBookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="person.2.fill" size={48} color="#666666" />
          <Text style={styles.emptyText}>No bookings found</Text>
          <Text style={styles.emptySubtext}>
            {filterStatus === 'all'
              ? 'You have no bookings'
              : `No ${filterStatus} bookings`}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4285F4"
            />
          }
        >
          {filteredBookings.map((booking, index) => (
            <View key={`${booking.id}-${index}`} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View style={styles.bookingHeaderLeft}>
                  <Text style={styles.passengerName}>
                    {booking.riderName || `Passenger ${index + 1}`}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(booking.status)}20` },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(booking.status) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(booking.status) },
                      ]}
                    >
                      {booking.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {booking.riderPhone && (
                <View style={styles.contactButtons}>
                  <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => {
                      const cleanPhone = booking.riderPhone.replace(/\D/g, '');
                      const phoneUrl = Platform.OS === 'ios' ? `telprompt:${cleanPhone}` : `tel:${cleanPhone}`;
                      Linking.canOpenURL(phoneUrl)
                        .then((supported) => {
                          if (supported) {
                            return Linking.openURL(phoneUrl);
                          } else {
                            Alert.alert('Error', 'Unable to make phone call.');
                          }
                        })
                        .catch((err) => {
                          Alert.alert('Error', 'Unable to make phone call.');
                        });
                    }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol size={18} name="phone.fill" color="#4285F4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={() => {
                      const cleanPhone = booking.riderPhone.replace(/\D/g, '');
                      const smsUrl = `sms:${cleanPhone}`;
                      Linking.canOpenURL(smsUrl)
                        .then((supported) => {
                          if (supported) {
                            return Linking.openURL(smsUrl);
                          } else {
                            Alert.alert('Error', 'Unable to open messaging app');
                          }
                        })
                        .catch((err) => {
                          Alert.alert('Error', 'Unable to open messaging app');
                        });
                    }}
                    activeOpacity={0.7}
                  >
                    <IconSymbol size={18} name="message.fill" color="#4285F4" />
                  </TouchableOpacity>
                </View>
                )}
              </View>

              <View style={styles.bookingDetails}>
                <View style={styles.detailRow}>
                  <IconSymbol size={16} name="mappin" color="#999999" />
                  <Text style={styles.detailText}>{booking.pickupAddress}</Text>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol size={16} name="flag" color="#999999" />
                  <Text style={styles.detailText}>
                    {booking.rideTo}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol size={16} name="calendar" color="#999999" />
                  <Text style={styles.detailText}>
                    {booking.rideDate} at {booking.rideTime}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol size={16} name="person" color="#999999" />
                  <Text style={styles.detailText}>
                    {booking.numberOfSeats || 1} seat{booking.numberOfSeats !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <IconSymbol size={16} name="dollarsign.circle.fill" color="#999999" />
                  <Text style={styles.detailText}>
                    ${((booking.numberOfSeats || 1) * (booking.pricePerSeat || 0)).toFixed(2)}
                  </Text>
                </View>
                {booking.confirmationNumber && (
                  <View style={styles.detailRow}>
                    <IconSymbol size={16} name="checkmark.circle.fill" color="#999999" />
                    <Text style={styles.detailText}>
                      {booking.confirmationNumber}
                    </Text>
                  </View>
                )}
                {booking.pickedUpAt && (
                  <View style={styles.detailRow}>
                    <IconSymbol size={16} name="checkmark" color="#34C759" />
                    <Text style={styles.detailText}>
                      Picked up: {formatDate(booking.pickedUpAt)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#4285F4',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bookingHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    flex: 1,
  },
});

