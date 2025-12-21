import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { getUpcomingRides, getRiderBookings, cancelBooking, type Ride, type RiderBooking } from '@/services/api';
import { ActiveBookingCard, ConfirmedBookingCard, RideCard } from '@/components/home';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, RESPONSIVE_SPACING } from '@/constants/designSystem';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    // expo-location not available
  }
}

// Helper function to reverse geocode coordinates to get city and state
const reverseGeocode = async (
  lat: number,
  lng: number
): Promise<{ city: string; state: string } | null> => {
  // Try Expo Location reverse geocoding first (no API key needed)
  if (Platform.OS !== 'web' && Location) {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        const city = address.city 
          || address.subAdministrativeArea 
          || address.district 
          || address.name 
          || "";
        const state = address.region 
          || address.administrativeArea 
          || address.subregion 
          || "";
        
        if (city || state) {
          return { city: city || "", state: state || "" };
        }
      }
    } catch (error) {
      // Fall through to Google API if Expo fails
    }
  }

  // Fallback to Google Geocoding API
  const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (GOOGLE_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        const addressComponents = result.address_components || [];

        let city = "";
        let state = "";

        addressComponents.forEach((component: any) => {
          if (component.types.includes("locality") || component.types.includes("sublocality") || component.types.includes("sublocality_level_1")) {
            if (!city) {
              city = component.long_name;
            }
          } else if (component.types.includes("administrative_area_level_1")) {
            state = component.short_name;
          }
        });

        if (city || state) {
          return { city: city || "", state: state || "" };
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  return null;
};

export default function HomeScreen(): React.JSX.Element {
  const { user, isLoading } = useUser();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoadingRides, setIsLoadingRides] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeBooking, setActiveBooking] = useState<RiderBooking | null>(null);
  const [confirmedBookings, setConfirmedBookings] = useState<RiderBooking[]>([]);
  const [isLoadingActiveBooking, setIsLoadingActiveBooking] = useState<boolean>(false);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<string | null>(null);

  useEffect(() => {
    // If no user is logged in, redirect to welcome screen
    // Wait for UserProvider to finish loading before checking
    if (!isLoading && !user) {
      router.replace('/welcome');
    }
  }, [user, isLoading]);

  const fetchRides = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingRides(true);
    try {
      const response = await getUpcomingRides();
      if (response.success && response.rides) {
        // Also fetch bookings to filter out rides the user has already confirmed
        const userId = typeof user.id === "string" ? parseInt(user.id) : user.id;
        
        let bookedRideIds = new Set<number>();
        try {
          const bookingsResponse = await getRiderBookings(userId);
          // Get list of ride IDs the user has confirmed bookings for
          if (bookingsResponse.success && bookingsResponse.bookings) {
            bookingsResponse.bookings
              .filter(b => b.status === 'confirmed' && b.ride && b.ride.status !== 'completed' && b.ride.status !== 'cancelled')
              .forEach(b => {
                if (b.ride && b.ride.id) {
                  bookedRideIds.add(b.ride.id);
                }
              });
      }
        } catch (bookingError: any) {
          // Silently fail bookings fetch - it's optional for filtering
          if (bookingError.status !== 401) {
            console.warn('Error fetching bookings for filtering:', bookingError);
          }
        }
        
        // Filter out rides the user has already booked, and ensure all rides have valid IDs
        const availableRides = response.rides
          .filter(ride => ride && ride.id && !bookedRideIds.has(ride.id));
        setRides(availableRides);
      }
    } catch (error: any) {
      // Only log non-401 errors to avoid console clutter
      if (error.status !== 401) {
      console.error('Error fetching rides:', error);
      }
    } finally {
      setIsLoadingRides(false);
      setRefreshing(false);
    }
  }, [user]);

  const fetchActiveBooking = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingActiveBooking(true);
    try {
      const userId = typeof user.id === "string" ? parseInt(user.id) : user.id;
      const response = await getRiderBookings(userId);
      if (response.success) {
        // Find active booking (confirmed status with ride status "in-progress" and not picked up)
        const active = response.bookings.find(
          (booking) =>
            booking.status === "confirmed" &&
            booking.ride.status === "in-progress" &&
            booking.pickupStatus !== "picked_up"
        );
        setActiveBooking(active || null);

        // Find all confirmed bookings that are scheduled (not in-progress or completed)
        const confirmed = response.bookings.filter(
          (booking) =>
            booking.status === "confirmed" &&
            booking.ride.status !== "in-progress" &&
            booking.ride.status !== "completed" &&
            booking.ride.status !== "cancelled" &&
            !booking.isPast
        );
        setConfirmedBookings(confirmed);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoadingActiveBooking(false);
    }
  }, [user]);

  // Fetch current location and reverse geocode to get city/state
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      if (!Location || Platform.OS === 'web') return;
      
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && isMounted) {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeout: 10000,
            });
            
            if (isMounted) {
              const geocodeResult = await reverseGeocode(
                location.coords.latitude,
                location.coords.longitude
              );
              
              if (geocodeResult && isMounted) {
                setCurrentCity(geocodeResult.city || null);
                setCurrentState(geocodeResult.state || null);
              }
            }
          } catch (locationError) {
            // Silently fail - location is optional
          }
        }
      } catch (error) {
        // Silently fail - location is optional
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRides();
      fetchActiveBooking();
    }, [fetchRides, fetchActiveBooking])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRides();
    fetchActiveBooking();
  }, [fetchRides, fetchActiveBooking]);

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.initialLoadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
      </SafeAreaView>
    );
  }

  const userName = user.firstName || user.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Simplified Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return 'Good morning';
              if (hour < 18) return 'Good afternoon';
              return 'Good evening';
            })()}
          </Text>
          <Text style={styles.userName}>{userName}</Text>
          {(currentCity || currentState) && (
            <View style={styles.locationRow}>
              <IconSymbol size={14} name="location.fill" color={COLORS.primary} />
              <Text style={styles.locationText}>
                {currentCity && currentState ? `${currentCity}, ${currentState}` : currentCity || currentState}
              </Text>
            </View>
          )}
        </View>
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
            progressBackgroundColor={COLORS.surface}
          />
        }
      >
        {/* Active Booking - Priority Display */}
        {activeBooking && (
          <View style={styles.activeBookingWrapper}>
            <ActiveBookingCard
              booking={activeBooking}
              onPress={() => {
                router.push({
                  pathname: '/track-driver',
                  params: {
                    booking: JSON.stringify(activeBooking),
                  },
                });
              }}
            />
                  </View>
        )}

        {/* Confirmed Bookings - Simplified Section */}
        {confirmedBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirmed Bookings</Text>
            {confirmedBookings.map((booking) => (
              <ConfirmedBookingCard
                key={booking.id}
                booking={booking}
                onEdit={() => {
                  router.push({
                    pathname: '/edit-booking',
                    params: {
                      booking: JSON.stringify(booking),
                    },
                  });
                }}
                onCancel={async () => {
                  if (!user?.id) return;
                  Alert.alert(
                    'Cancel Booking',
                    'Are you sure you want to cancel this booking?',
                    [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Yes, Cancel',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
                            await cancelBooking(booking.id, userId);
                            Alert.alert('Success', 'Booking cancelled successfully.');
                            fetchActiveBooking();
                          } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to cancel booking.');
                          }
                        },
                      },
                    ]
                  );
                }}
                onTrack={() => {
                      router.push({
                        pathname: '/track-driver',
                        params: {
                      booking: JSON.stringify(booking),
                        },
                      });
                    }}
              />
            ))}
          </View>
        )}

        {/* Available Rides - Clean Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Rides</Text>
          
          {isLoadingRides ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading rides...</Text>
            </View>
          ) : rides.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <IconSymbol size={56} name="car" color={COLORS.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No rides available</Text>
              <Text style={styles.emptySubtext}>
                New rides will appear here when drivers post them
              </Text>
            </View>
          ) : (
            <View style={styles.ridesList}>
              {rides
              .filter(ride => ride && ride.id) // Ensure ride has valid ID
              .map((ride) => (
                <RideCard
                key={ride.id}
                  ride={ride}
                onPress={() => {
                    if (ride && ride.id) {
                  router.push({
                    pathname: '/ride-details',
                    params: {
                      ride: JSON.stringify(ride),
                    },
                  });
                    }
                  }}
                />
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
  // Simplified Header
  header: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  greeting: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    ...TYPOGRAPHY.h1,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    marginTop: SPACING.xs,
  },
  locationText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  // Active Booking
  activeBookingWrapper: {
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  // Sections
  section: {
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
    letterSpacing: -0.3,
  },
  // Rides List
  ridesList: {
    gap: SPACING.base,
  },
  // Initial Loading State
  initialLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.base,
  },
  // Loading State (for rides)
  loadingContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    gap: SPACING.base,
  },
  loadingText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
