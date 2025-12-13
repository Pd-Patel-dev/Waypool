import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { getMyBookings, type BookingDetail } from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function YourRidesScreen(): React.JSX.Element {
  const { user, isLoading: userLoading } = useUser();
  const [upcomingBookings, setUpcomingBookings] = useState<BookingDetail[]>([]);
  const [pastBookings, setPastBookings] = useState<BookingDetail[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    // If no user is logged in, redirect to welcome screen
    if (!userLoading && !user) {
      router.replace('/welcome');
    }
  }, [user, userLoading]);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await getMyBookings(parseInt(user.id));
      if (response.success && response.bookings) {
        setUpcomingBookings(response.bookings.upcoming || []);
        setPastBookings(response.bookings.past || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Tomorrow';
      } else if (diffDays > 1 && diffDays <= 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      return 'Invalid date';
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
      return 'Invalid time';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return '#4285F4';
      case 'completed':
        return '#34C759';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#999999';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'Confirmed';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const renderBookingCard = (booking: BookingDetail) => (
    <TouchableOpacity
      key={booking.id}
      style={styles.bookingCard}
      activeOpacity={0.7}
      onPress={() => {
        // Navigate to ride details with the ride information
        router.push({
          pathname: '/ride-details',
          params: {
            ride: JSON.stringify({
              id: booking.ride.id,
              driverName: booking.ride.driverName,
              driverPhone: booking.ride.driverPhone,
              fromAddress: booking.ride.fromAddress,
              toAddress: booking.ride.toAddress,
              fromCity: booking.ride.fromCity,
              toCity: booking.ride.toCity,
              fromLatitude: booking.ride.fromLatitude,
              fromLongitude: booking.ride.fromLongitude,
              toLatitude: booking.ride.toLatitude,
              toLongitude: booking.ride.toLongitude,
              departureTime: booking.ride.departureTime,
              availableSeats: 0, // Already booked
              totalSeats: 0,
              price: booking.ride.pricePerSeat,
              status: booking.status,
              carMake: booking.ride.carMake,
              carModel: booking.ride.carModel,
              carYear: booking.ride.carYear,
              carColor: booking.ride.carColor,
              driver: booking.ride.driver,
            }),
            booking: JSON.stringify(booking),
          },
        });
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.confirmationContainer}>
          <Text style={styles.confirmationLabel}>Confirmation</Text>
          <Text style={styles.confirmationNumber}>{booking.confirmationNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
            {getStatusLabel(booking.status)}
          </Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routeIndicator}>
          <View style={styles.routeDot} />
          <View style={styles.routeLine} />
          <View style={styles.routeDotEnd} />
        </View>
        <View style={styles.addresses}>
          <Text style={styles.fromAddress} numberOfLines={1}>
            {booking.pickupAddress}
          </Text>
          <Text style={styles.toAddress} numberOfLines={1}>
            {booking.ride.toAddress}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <IconSymbol name="clock" size={14} color="#999999" />
          <Text style={styles.footerText}>
            {formatDate(booking.ride.departureTime)} at {formatTime(booking.ride.departureTime)}
          </Text>
        </View>
        <View style={styles.footerItem}>
          <IconSymbol name="person" size={14} color="#999999" />
          <Text style={styles.footerText}>
            {booking.numberOfSeats} seat{booking.numberOfSeats !== 1 ? 's' : ''}
          </Text>
        </View>
        {booking.ride.totalPrice && (
          <View style={styles.footerItem}>
            <IconSymbol name="creditcard" size={14} color="#999999" />
            <Text style={styles.footerText}>
              ${booking.ride.totalPrice.toFixed(2)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (userLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4285F4" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Rides</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingRidesContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
          </View>
        ) : (
          <>
            {/* Upcoming Bookings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming Rides</Text>
              {upcomingBookings.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateIcon}>📅</Text>
                  <Text style={styles.emptyStateText}>No upcoming rides</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Your confirmed bookings will appear here
                  </Text>
                </View>
              ) : (
                upcomingBookings.map(renderBookingCard)
              )}
            </View>

            {/* Past Bookings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Past Rides</Text>
              {pastBookings.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateIcon}>📜</Text>
                  <Text style={styles.emptyStateText}>No past rides</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Your completed and cancelled rides will appear here
                  </Text>
                </View>
              ) : (
                pastBookings.map(renderBookingCard)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: '#000000',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  loadingRidesContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    marginHorizontal: 20,
  },
  emptyStateContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: '#CCCCCC',
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  confirmationContainer: {
    flex: 1,
  },
  confirmationLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  confirmationNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  routeIndicator: {
    alignItems: 'center',
    marginRight: 12,
    width: 16,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  routeLine: {
    width: 1.5,
    height: 32,
    backgroundColor: '#3A3A3C',
    marginVertical: 4,
  },
  routeDotEnd: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  addresses: {
    flex: 1,
    justifyContent: 'space-between',
  },
  fromAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  toAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
    flexWrap: 'wrap',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
});

