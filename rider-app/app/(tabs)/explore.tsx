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
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { useFocusEffect } from 'expo-router';
import { getRiderBookings, type RiderBooking } from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, CARDS, RESPONSIVE_SPACING } from '@/constants/designSystem';
import { calculateRiderTotal } from '@/utils/fees';
import { handleErrorSilently } from '@/utils/errorHandler';

type FilterType = 'all' | 'completed' | 'cancelled';

export default function ActivityScreen(): React.JSX.Element {
  const { user, isLoading: userLoading } = useUser();
  const [bookings, setBookings] = useState<RiderBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const response = await getRiderBookings(riderId);
      
      if (response.success && response.bookings) {
        setBookings(response.bookings);
      }
    } catch (error) {
      // Silently handle errors - don't show error to user for activity screen
      handleErrorSilently(error, 'fetchBookings');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  }, [fetchBookings]);

  // Filter bookings
  const filteredBookings = bookings.filter((booking) => {
    if (filter === 'completed') {
      return booking.status === 'completed';
    }
    if (filter === 'cancelled') {
      return booking.status === 'cancelled';
    }
    return true; // 'all'
  });

  // Calculate statistics
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const totalRides = completedBookings.length;
  const totalSpent = completedBookings.reduce((sum, booking) => {
    const pricePerSeat = booking.ride.pricePerSeat || 0;
    const seats = booking.numberOfSeats || 1;
    const subtotal = pricePerSeat * seats;
    // Calculate total including all fees (processing fee + platform fee)
    const riderTotal = calculateRiderTotal(subtotal);
    return sum + riderTotal.total;
  }, 0);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const getStatusColor = (status: string): string => {
    if (status === 'completed') return COLORS.success;
    if (status === 'cancelled') return COLORS.error;
    if (status === 'confirmed') return COLORS.primary;
    return COLORS.textSecondary;
  };

  const getStatusLabel = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleViewRideDetails = (booking: RiderBooking) => {
    // Navigate to booking details to show ride information with pricing and status
      router.push({
      pathname: '/booking-details',
        params: {
        booking: JSON.stringify(booking),
        },
      });
  };

  if (userLoading || isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
      <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Statistics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <IconSymbol name="car.fill" size={24} color={COLORS.primary} />
              <Text style={styles.statValue}>{totalRides}</Text>
              <Text style={styles.statLabel}>Total Rides</Text>
            </View>
            <View style={styles.statCard}>
              <IconSymbol name="dollarsign.circle.fill" size={24} color={COLORS.success} />
              <Text style={styles.statValue}>${totalSpent.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.section}>
          <View style={styles.filterContainer}>
          <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
              onPress={() => setFilter('all')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                All
              </Text>
          </TouchableOpacity>
          <TouchableOpacity
              style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
              onPress={() => setFilter('completed')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
                Completed
              </Text>
          </TouchableOpacity>
          <TouchableOpacity
              style={[styles.filterButton, filter === 'cancelled' && styles.filterButtonActive]}
              onPress={() => setFilter('cancelled')}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === 'cancelled' && styles.filterTextActive]}>
                Cancelled
              </Text>
          </TouchableOpacity>
          </View>
        </View>

        {/* Ride History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Ride History {filteredBookings.length > 0 && `(${filteredBookings.length})`}
          </Text>

          {filteredBookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <IconSymbol name="clock.fill" size={72} color={COLORS.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>
                {filter === 'all'
                  ? 'No ride history yet'
                  : `No ${filter} rides`}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'Your completed and cancelled rides will appear here once you start booking rides.'
                  : `You don't have any ${filter} rides yet.`}
              </Text>
              {filter === 'all' && (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/(tabs)/')}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="car.fill" size={18} color={COLORS.textPrimary} />
                  <Text style={styles.emptyButtonText}>Browse Available Rides</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.bookingsList}>
              {filteredBookings.map((booking) => (
          <TouchableOpacity
                  key={booking.id}
                  style={styles.bookingCard}
                  onPress={() => handleViewRideDetails(booking)}
                  activeOpacity={0.7}
                >
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingRoute}>
                      <View style={styles.routeRow}>
                        <View style={styles.routeDot} />
                        <View style={styles.routeContent}>
                          <Text style={styles.routeFrom} numberOfLines={1}>
                            {booking.ride.fromCity || booking.ride.fromAddress}
                          </Text>
                          <Text style={styles.routeTo} numberOfLines={1}>
                            {booking.ride.toCity || booking.ride.toAddress}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(booking.status)}20` }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                        {getStatusLabel(booking.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingDetails}>
                    <View style={styles.bookingDetailRow}>
                      <IconSymbol name="calendar" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.bookingDetailText}>
                        {formatDate(booking.ride.departureTime)}
                      </Text>
                    </View>
                    <View style={styles.bookingDetailRow}>
                      <IconSymbol name="clock.fill" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.bookingDetailText}>
                        {formatTime(booking.ride.departureTime)}
                      </Text>
                    </View>
                    <View style={styles.bookingDetailRow}>
                      <IconSymbol name="person.2.fill" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.bookingDetailText}>
                        {booking.numberOfSeats} seat{booking.numberOfSeats !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.bookingDetailRow}>
                      <IconSymbol name="dollarsign.circle.fill" size={14} color={COLORS.primary} />
                      <Text style={[styles.bookingDetailText, styles.priceText]}>
                        {(() => {
                          const pricePerSeat = booking.ride.pricePerSeat || 0;
                          const seats = booking.numberOfSeats || 1;
                          const subtotal = pricePerSeat * seats;
                          const riderTotal = calculateRiderTotal(subtotal);
                          return `$${riderTotal.total.toFixed(2)}`;
                        })()}
                      </Text>
                    </View>
                  </View>

                  {booking.confirmationNumber && (
                    <View style={styles.confirmationRow}>
                      <Text style={styles.confirmationLabel}>Confirmation:</Text>
                      <Text style={styles.confirmationNumber}>{booking.confirmationNumber}</Text>
                    </View>
                  )}
          </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.base,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  header: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.base,
  },
  statCard: {
    ...CARDS.default,
    flex: 1,
    alignItems: 'center',
    padding: SPACING.base * 1.5,
    gap: SPACING.sm,
  },
  statValue: {
    ...TYPOGRAPHY.h2,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.textPrimary,
  },
  bookingsList: {
    gap: SPACING.base,
  },
  bookingCard: {
    ...CARDS.default,
    padding: SPACING.base,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.base,
  },
  bookingRoute: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.base,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  routeContent: {
    flex: 1,
    minWidth: 0,
  },
  routeFrom: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  routeTo: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    ...TYPOGRAPHY.badge,
    fontSize: 11,
    fontWeight: '700',
  },
  bookingDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.base,
    marginTop: SPACING.sm,
    paddingTop: SPACING.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  bookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  bookingDetailText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  confirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.xs,
  },
  confirmationLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  confirmationNumber: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
    gap: SPACING.base,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.base,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.base,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyButtonText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
