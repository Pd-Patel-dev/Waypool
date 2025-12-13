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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { getUpcomingRides, type Ride } from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

// Calculate distance between two coordinates using Haversine formula (returns miles)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Radius of the Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in miles
  return distance;
};

export default function HomeScreen(): React.JSX.Element {
  const { user, isLoading } = useUser();
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationAddress, setLocationAddress] = useState<{ city: string; state: string } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [filteredRides, setFilteredRides] = useState<Ride[]>([]);
  const [isLoadingRides, setIsLoadingRides] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    // If no user is logged in, redirect to welcome screen
    if (!isLoading && !user) {
      router.replace('/welcome');
    }
  }, [user, isLoading]);

  // Reverse geocode coordinates to get city and state
  const reverseGeocode = useCallback(async (coords: LocationCoords) => {
    try {
      if (Platform.OS === 'web') {
        // Web platform - use Google Maps Geocoding API
        const apiKey = 'AIzaSyB3dqyiWNGJLqv_UYA2zQxUdYpiIbmw3k4';
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${apiKey}`
        );
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          let city = '';
          let state = '';
          
          // Extract city and state from address components
          for (const component of result.address_components) {
            if (component.types.includes('locality') || component.types.includes('sublocality')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.short_name;
            }
          }
          
          if (city && state) {
            setLocationAddress({ city, state });
          }
        }
      } else if (Location && Location.reverseGeocodeAsync) {
        // Native platforms - use expo-location reverse geocoding
        const addresses = await Location.reverseGeocodeAsync(coords);
        if (addresses && addresses.length > 0) {
          const address = addresses[0];
          setLocationAddress({
            city: address.city || address.subAdministrativeArea || 'Unknown',
            state: address.region || address.administrativeArea || 'Unknown',
          });
        }
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      // Don't set error, just leave locationAddress as null
    }
  }, []);

  // Request location permissions and get current location
  useEffect(() => {
    (async () => {
      if (user && Location && Platform.OS !== 'web') {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocationError('Location permission denied');
            return;
          }

          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const coords = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          };
          setLocation(coords);
          // Reverse geocode to get city and state
          await reverseGeocode(coords);
        } catch (error) {
          console.error('Error getting location:', error);
          setLocationError('Failed to get location');
        }
      } else if (Platform.OS === 'web') {
        // Web fallback - try browser geolocation API
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              setLocation(coords);
              // Reverse geocode to get city and state
              await reverseGeocode(coords);
            },
            (error) => {
              setLocationError('Location permission denied');
              console.error('Geolocation error:', error);
            }
          );
        } else {
          setLocationError('Geolocation not supported');
        }
      }
    })();
  }, [user]);

  const fetchRides = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingRides(true);
    try {
      const response = await getUpcomingRides();
      if (response.success) {
        setRides(response.rides);
      }
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setIsLoadingRides(false);
      setRefreshing(false);
    }
  }, [user]);

  // Filter rides within 50 miles of user's location
  useEffect(() => {
    if (!location || rides.length === 0) {
      // If no location, show all rides (fallback)
      setFilteredRides(rides);
      return;
    }

    const RADIUS_MILES = 50;
    const nearbyRides = rides.filter((ride) => {
      if (!ride.fromLatitude || !ride.fromLongitude) {
        return false; // Skip rides without location data
      }
      
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        ride.fromLatitude,
        ride.fromLongitude
      );
      
      return distance <= RADIUS_MILES;
    });

    // Sort by distance (nearest first)
    nearbyRides.sort((a, b) => {
      if (!a.fromLatitude || !a.fromLongitude || !b.fromLatitude || !b.fromLongitude) {
        return 0;
      }
      const distA = calculateDistance(
        location.latitude,
        location.longitude,
        a.fromLatitude,
        a.fromLongitude
      );
      const distB = calculateDistance(
        location.latitude,
        location.longitude,
        b.fromLatitude,
        b.fromLongitude
      );
      return distA - distB;
    });

    setFilteredRides(nearbyRides);
  }, [location, rides]);

  useFocusEffect(
    useCallback(() => {
      fetchRides();
    }, [fetchRides])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRides();
  }, [fetchRides]);

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

  if (isLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
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
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>
              {user.firstName || user.email}
            </Text>
          </View>
        </View>

        {/* Current Location Display */}
        {location && (
          <View style={styles.locationContainer}>
            <View style={styles.locationContent}>
              <IconSymbol name="location.fill" size={16} color="#4285F4" />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Your location</Text>
                <Text style={styles.locationAddress}>
                  {locationAddress 
                    ? `${locationAddress.city}, ${locationAddress.state}`
                    : `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </Text>
              </View>
            </View>
          </View>
        )}
        {locationError && (
          <View style={styles.locationErrorContainer}>
            <Text style={styles.locationErrorText}>
              {locationError} - Showing all rides
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Where would you like to go?</Text>
          
          <TouchableOpacity
            style={styles.bookRideButton}
            activeOpacity={0.8}
            onPress={() => {
              // TODO: Navigate to ride booking screen
              console.log('Book a ride');
            }}
          >
            <View style={styles.bookRideContent}>
              <Text style={styles.bookRideIcon}>🚗</Text>
              <View style={styles.bookRideTextContainer}>
                <Text style={styles.bookRideTitle}>Book a ride</Text>
                <Text style={styles.bookRideSubtitle}>
                  Get a ride to your destination
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Upcoming Rides */}
        <View style={styles.upcomingRidesContainer}>
          <Text style={styles.sectionTitle}>
            {location ? 'Nearby rides (within 50 mi)' : 'Upcoming rides'}
          </Text>
          
          {isLoadingRides ? (
            <View style={styles.loadingRidesContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
            </View>
          ) : filteredRides.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>📍</Text>
              <Text style={styles.emptyStateText}>
                {location ? 'No nearby rides' : 'No upcoming rides'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {location
                  ? 'No rides found within 50 miles of your location'
                  : 'Available rides will appear here'}
              </Text>
            </View>
          ) : (
            filteredRides.map((ride) => {
              // Calculate distance for display
              const rideDistance = location && ride.fromLatitude && ride.fromLongitude
                ? calculateDistance(
                    location.latitude,
                    location.longitude,
                    ride.fromLatitude,
                    ride.fromLongitude
                  )
                : null;
              
              return (
              <TouchableOpacity
                key={ride.id}
                style={styles.rideCard}
                activeOpacity={0.7}
                onPress={() => {
                  router.push({
                    pathname: '/ride-details',
                    params: {
                      ride: JSON.stringify(ride),
                    },
                  });
                }}
              >
                <View style={styles.rideCardContent}>
                  {/* Header: Driver & Price */}
                  <View style={styles.cardHeader}>
                    <View style={styles.driverInfo}>
                      <View style={styles.driverAvatar}>
                        <Text style={styles.driverAvatarText}>
                          {ride.driverName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.driverDetails}>
                        <Text style={styles.driverName}>{ride.driverName}</Text>
                        {ride.carMake && ride.carModel && (
                          <Text style={styles.carInfo}>
                            {ride.carYear} {ride.carMake} {ride.carModel}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.price}>${ride.price.toFixed(2)}</Text>
                  </View>

                  {/* Route */}
                  <View style={styles.routeContainer}>
                    <View style={styles.routeIndicator}>
                      <View style={styles.routeDot} />
                      <View style={styles.routeLine} />
                      <View style={styles.routeDotEnd} />
                    </View>
                    <View style={styles.addresses}>
                      <Text style={styles.fromAddress} numberOfLines={1}>
                        {ride.fromAddress}
                      </Text>
                      <Text style={styles.toAddress} numberOfLines={1}>
                        {ride.toAddress}
                      </Text>
                    </View>
                  </View>

                  {/* Footer: Time, Distance, Seats */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>
                      {formatDate(ride.departureTime)} at {formatTime(ride.departureTime)}
                    </Text>
                    {rideDistance !== null && (
                      <Text style={styles.footerText}>• {rideDistance.toFixed(1)} mi away</Text>
                    )}
                    {ride.distance && rideDistance === null && (
                      <Text style={styles.footerText}>• {ride.distance.toFixed(1)} mi</Text>
                    )}
                    <Text style={styles.footerText}>
                      • {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              );
            })
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
  },
  loadingText: {
    fontSize: 16,
    color: '#CCCCCC',
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
  greeting: {
    fontSize: 16,
    fontWeight: '400',
    color: '#CCCCCC',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  bookRideButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  bookRideContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookRideIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  bookRideTextContainer: {
    flex: 1,
  },
  bookRideTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  bookRideSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  upcomingRidesContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  loadingRidesContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
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
  rideCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  rideCardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  carInfo: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4285F4',
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
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
  locationContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  locationTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CCCCCC',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 11,
    fontWeight: '400',
    color: '#999999',
  },
  locationErrorContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  locationErrorText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FF6B6B',
    textAlign: 'center',
  },
});
