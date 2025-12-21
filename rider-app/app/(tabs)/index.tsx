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
import { HomeHeader, ActiveBookingCard, ConfirmedBookingCard, RideCard } from '@/components/home';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
      if (response.success) {
        // Also fetch bookings to filter out rides the user has already confirmed
        const userId = typeof user.id === "string" ? parseInt(user.id) : user.id;
        const bookingsResponse = await getRiderBookings(userId);
        
        // Get list of ride IDs the user has confirmed bookings for
        const bookedRideIds = new Set<number>();
        if (bookingsResponse.success) {
          bookingsResponse.bookings
            .filter(b => b.status === 'confirmed' && b.ride.status !== 'completed' && b.ride.status !== 'cancelled')
            .forEach(b => bookedRideIds.add(b.ride.id));
        }
        
        // Filter out rides the user has already booked
        const availableRides = response.rides.filter(ride => !bookedRideIds.has(ride.id));
        setRides(availableRides);
      }
    } catch (error) {
      console.error('Error fetching rides:', error);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const userName = user.firstName || user.email?.split('@')[0] || 'User';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#4285F4"
            colors={['#4285F4']}
            progressBackgroundColor="#1C1C1E"
          />
        }
      >
        {/* Greeting Section */}
        <HomeHeader 
          userName={userName} 
          currentCity={currentCity}
          currentState={currentState}
        />

        {/* Active Booking Card */}
        {activeBooking && (
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
        )}

        {/* Confirmed Bookings Section */}
        {confirmedBookings.length > 0 && (
          <View style={styles.confirmedBookingsContainer}>
            <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
              <Text style={styles.sectionTitle}>Your confirmed bookings</Text>
            </View>
            {confirmedBookings.map((booking) => {
              const isRideStarted = booking.ride.status === 'in-progress';
              return (
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
                      'Are you sure you want to cancel this booking? This action cannot be undone.',
                      [
                        {
                          text: 'No',
                          style: 'cancel',
                        },
                        {
                          text: 'Yes, Cancel',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
                              await cancelBooking(booking.id, userId);
                              Alert.alert('Success', 'Your booking has been cancelled successfully.');
                              // Refresh bookings
                              fetchActiveBooking();
                            } catch (error: any) {
                              Alert.alert('Error', error.message || 'Failed to cancel booking. Please try again.');
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
              );
            })}
          </View>
        )}

        {/* Available Rides Section */}
        <View style={styles.ridesContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available rides</Text>
          </View>

          {isLoadingRides ? (
            <View style={styles.loadingRidesContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingRidesText}>Loading rides...</Text>
            </View>
          ) : rides.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                size={48}
                name="car"
                color="#666666"
              />
              <Text style={styles.emptyTitle}>No available rides</Text>
              <Text style={styles.emptySubtext}>
                Check back later for new ride options
              </Text>
            </View>
          ) : (
            rides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onPress={() => {
                  router.push({
                    pathname: '/ride-details',
                    params: {
                      ride: JSON.stringify(ride),
                    },
                  });
                }}
              />
            ))
          )}
        </View>
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
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#CCCCCC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  confirmedBookingsContainer: {
    marginBottom: 24,
  },
  ridesContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingRidesContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    gap: 12,
  },
  loadingRidesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
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
});
