import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import MapComponent from '@/components/MapComponent';
import { getUpcomingRides, deleteRide, type Ride } from '@/services/api';
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

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

// Calculate total distance for a ride (including passenger pickups)
const calculateTotalDistance = (ride: Ride, driverLocation: LocationCoords | null): number => {
  if (!ride.fromLatitude || !ride.fromLongitude || !ride.toLatitude || !ride.toLongitude) {
    return 0;
  }

  let totalDistance = 0;
  let currentLat = ride.fromLatitude;
  let currentLon = ride.fromLongitude;

  // If driver location is available, calculate distance from driver to start point
  if (driverLocation) {
    totalDistance += calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      ride.fromLatitude,
      ride.fromLongitude
    );
  }

  // Calculate distance from start to destination
  totalDistance += calculateDistance(
    ride.fromLatitude,
    ride.fromLongitude,
    ride.toLatitude,
    ride.toLongitude
  );

  // If there are passengers, add distance to their pickup locations
  if (ride.passengers && ride.passengers.length > 0) {
    ride.passengers.forEach((passenger) => {
      if (passenger.pickupLatitude && passenger.pickupLongitude) {
        // Distance from start to passenger pickup
        totalDistance += calculateDistance(
          currentLat,
          currentLon,
          passenger.pickupLatitude,
          passenger.pickupLongitude
        );
        currentLat = passenger.pickupLatitude;
        currentLon = passenger.pickupLongitude;
      }
    });
  }

  return totalDistance;
};

// Format distance for display (handles both km and miles)
const formatDistance = (distance: number, isKm: boolean = true): string => {
  if (isKm) {
    // Convert km to miles for consistency with AddRideScreen
    const miles = distance * 0.621371;
    return `${miles.toFixed(1)} mi`;
  }
  // If already in miles
  return `${distance.toFixed(1)} mi`;
};

// Calculate earnings for a ride based on booked seats
const calculateEarnings = (ride: Ride): number => {
  const bookedSeats = ride.totalSeats - ride.availableSeats;
  if (ride.price) {
    // If price is per seat, multiply by booked seats
    // If price is total ride price, use it directly
    // Assuming price is per seat for now
    return bookedSeats * ride.price;
  }
  return 0;
};

// Format currency for display
const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

export default function HomeScreen(): React.JSX.Element {
  const { user } = useUser();
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<string | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoadingRides, setIsLoadingRides] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Current active ride - set to null if no active ride
  // TODO: Integrate with real-time ride tracking
  const [currentRide] = useState<any>(null);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Reverse geocode coordinates to get city and state
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
      if (!GOOGLE_API_KEY) {
        console.warn('Google Places API key not configured');
        return;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const addressComponents = result.address_components || [];
        
        let city = '';
        let state = '';

        addressComponents.forEach((component: any) => {
          if (component.types.includes('locality')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name;
          }
        });

        setCurrentCity(city);
        setCurrentState(state);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  // Request location permissions and get current location (native only)
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
          await reverseGeocode(coords.latitude, coords.longitude);
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
              await reverseGeocode(coords.latitude, coords.longitude);
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

  // Fetch upcoming rides
  const fetchRides = async () => {
    if (!user?.id) {
      console.log('⚠️ No user ID, skipping ride fetch');
      setIsLoadingRides(false);
      return;
    }
    
    try {
      setIsLoadingRides(true);
      console.log('🔄 Fetching rides for driver ID:', user.id);
      const data = await getUpcomingRides(user.id);
      console.log('✅ Received rides:', data.length, 'rides');
      setRides(data);
    } catch (error) {
      console.error('❌ Error fetching rides:', error);
      // Set empty array on error instead of leaving it undefined
      setRides([]);
    } finally {
      setIsLoadingRides(false);
    }
  };

  // Refetch rides when screen comes into focus (e.g., after adding a ride)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchRides();
      }
      return () => {};
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // Check if a ride is scheduled for today
  const isToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Separate rides into today's rides and upcoming rides
  const todaysRides = rides.filter((ride) => isToday(ride.departureTime));
  const upcomingRides = rides.filter((ride) => !isToday(ride.departureTime));

  // If user is not logged in, show nothing (should redirect)
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initialRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  const handleAddRide = () => {
    router.push('/add-ride');
  };

  const handleRidePress = (rideId: number) => {
    // Find the ride from the rides array
    const ride = rides.find((r) => r.id === rideId);
    if (ride) {
      // Navigate to current ride screen with ride ID and ride data
      router.push({
        pathname: '/current-ride',
        params: {
          rideId: String(ride.id),
          ride: JSON.stringify(ride), // Keep for fallback
        },
      });
    } else {
      console.error('Ride not found with ID:', rideId);
    }
  };

  const handleStartRide = (ride: Ride) => {
    // Navigate to current ride screen with ride ID and ride data
    router.push({
      pathname: '/current-ride',
      params: {
        rideId: String(ride.id),
        ride: JSON.stringify(ride), // Keep for fallback
      },
    });
  };

  const handleDeleteRide = (ride: Ride) => {
    Alert.alert(
      'Delete Ride',
      'Are you sure you want to delete this ride? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) {
              Alert.alert('Error', 'User not found');
              return;
            }

            try {
              await deleteRide(ride.id, user.id);
              // Refresh the rides list
              await fetchRides();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message || 'Failed to delete ride. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
        }>
        {/* Greeting Section */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.name}>{user.fullName}</Text>
          {(currentCity || currentState) && (
            <View style={styles.locationContainer}>
              <IconSymbol size={14} name="location.fill" color="#4285F4" />
              <Text style={styles.locationText}>
                {currentCity && currentState 
                  ? `${currentCity}, ${currentState}`
                  : currentCity || currentState || ''}
              </Text>
            </View>
          )}
        </View>

        {/* Map Section - Hidden for now, can be re-enabled later */}
        {/* <View style={styles.mapWrapper}>
          <MapComponent
            location={location}
            locationError={locationError}
            initialRegion={initialRegion}
          />
        </View> */}

        {/* Current Active Ride */}
        {currentRide && (
          <TouchableOpacity 
            style={styles.currentRideCard}
            onPress={() => router.push('/current-ride')}
            activeOpacity={0.9}>
            
            <View style={styles.liveHeader}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  {currentRide.status === 'heading-to-pickup' ? 'PICKING UP' : 'IN TRANSIT'}
                </Text>
              </View>
              <Text style={styles.currentEta}>{currentRide.estimatedTime}</Text>
            </View>

            <View style={styles.currentRideInfo}>
              {currentRide.status === 'heading-to-pickup' ? (
                <>
                  <View style={styles.statusRow}>
                    <IconSymbol size={16} name="house" color="#4285F4" />
                    <Text style={styles.statusLabel}>Heading to pick up</Text>
                  </View>
                  <Text style={styles.currentPassenger}>{currentRide.passenger}</Text>
                  <View style={styles.currentDestination}>
                    <IconSymbol size={14} name="location" color="#4285F4" />
                    <Text style={styles.currentDestText}>{currentRide.pickupLocation}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.statusRow}>
                    <IconSymbol size={16} name="flag" color="#FF3B30" />
                    <Text style={styles.statusLabel}>Heading to destination</Text>
                  </View>
                  <Text style={styles.currentPassenger}>With {currentRide.passenger}</Text>
                  <View style={styles.currentDestination}>
                    <IconSymbol size={14} name="flag" color="#FF3B30" />
                    <Text style={styles.currentDestText}>{currentRide.destination}</Text>
                  </View>
                </>
              )}
        </View>

            <View style={styles.progressBar}>
              <View style={styles.progress} />
            </View>
          </TouchableOpacity>
        )}

        {/* Today's Rides Section */}
        {todaysRides.length > 0 && (
          <View style={styles.ridesContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today's rides</Text>
            </View>
            {todaysRides.map((ride) => (
              <View key={ride.id} style={styles.rideCard}>
                <View style={styles.rideCardHeader}>
                  <TouchableOpacity 
                    onPress={() => handleRidePress(ride.id)}
                    activeOpacity={0.7}
                    style={styles.rideCardContent}>
                    <View style={styles.rideHeader}>
                      <View style={styles.rideTimeContainer}>
                        <Text style={styles.rideDate}>{formatDate(ride.departureTime)}</Text>
                        <Text style={styles.rideTime}>{formatTime(ride.departureTime)}</Text>
                      </View>
                      <View style={styles.seatsContainer}>
                        <View style={styles.seatsInfo}>
                        <Text style={styles.seatsValue}>{ride.availableSeats}</Text>
                          <Text style={styles.seatsLabel}>available</Text>
                          {ride.totalSeats > ride.availableSeats && (
                            <Text style={styles.bookedSeatsLabel}>
                              {ride.totalSeats - ride.availableSeats} booked
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.routeContainer}>
                      <View style={styles.routeItem}>
                        <View style={styles.routeIndicator} />
                        <View style={styles.routeContent}>
                          <Text style={styles.routeAddress}>{ride.fromAddress}</Text>
                        </View>
                      </View>
                      <View style={styles.routeConnector} />
                      <View style={styles.routeItem}>
                        <View style={[styles.routeIndicator, styles.routeIndicatorDest]} />
                        <View style={styles.routeContent}>
                          <Text style={styles.routeAddress}>{ride.toAddress}</Text>
                        </View>
                      </View>
                    </View>
                    {/* Distance and Price display */}
                    <View style={styles.infoContainer}>
                      {ride.distance !== undefined && (
                        <View style={styles.infoItem}>
                          <IconSymbol size={14} name="mappin" color="#999999" />
                          <Text style={styles.infoValue}>
                            {ride.distance.toFixed(1)} mi
                          </Text>
                        </View>
                      )}
                      {ride.price && (
                        <View style={styles.infoItem}>
                          <IconSymbol size={14} name="dollarsign.circle.fill" color="#4285F4" />
                          <Text style={styles.priceValue}>
                            ${ride.price.toFixed(2)}/seat
                          </Text>
                        </View>
                      )}
                      {ride.totalSeats > ride.availableSeats && (
                        <View style={styles.infoItem}>
                          <IconSymbol size={14} name="dollarsign.circle.fill" color="#4285F4" />
                          <Text style={styles.earningsValue}>
                            ${calculateEarnings(ride).toFixed(2)} earned
                          </Text>
                        </View>
                      )}
                  </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteRide(ride)}
                    activeOpacity={0.7}>
                    <IconSymbol size={18} name="trash" color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                {/* Start Ride Button - Only for today's rides */}
                <TouchableOpacity
                  style={styles.startRideButton}
                  onPress={() => handleStartRide(ride)}
                  activeOpacity={0.8}>
                  <IconSymbol size={18} name="play.fill" color="#000000" />
                  <Text style={styles.startRideButtonText}>Start Ride</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming Rides Section */}
        <View style={styles.ridesContainer}>
          <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming rides</Text>
            <TouchableOpacity 
              style={styles.addRideButton}
              onPress={handleAddRide}
              activeOpacity={0.7}>
              <Text style={styles.addRideIcon}>+</Text>
            </TouchableOpacity>
          </View>
          
          {isLoadingRides ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingText}>Loading rides...</Text>
            </View>
          ) : rides.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol size={48} name="car" color="#333333" />
              <Text style={styles.emptyTitle}>No upcoming rides</Text>
              <Text style={styles.emptySubtext}>Tap the + button to create your first ride</Text>
            </View>
          ) : upcomingRides.length === 0 && todaysRides.length > 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol size={48} name="calendar" color="#333333" />
              <Text style={styles.emptyTitle}>No upcoming rides</Text>
              <Text style={styles.emptySubtext}>All your rides are scheduled for today</Text>
            </View>
          ) : (
            upcomingRides.map((ride) => (
              <View key={ride.id} style={styles.rideCard}>
                <View style={styles.rideCardHeader}>
                  <TouchableOpacity 
                    onPress={() => handleRidePress(ride.id)}
                    activeOpacity={0.7}
                    style={styles.rideCardContent}>
                    <View style={styles.rideHeader}>
                      <View style={styles.rideTimeContainer}>
                        <Text style={styles.rideDate}>{formatDate(ride.departureTime)}</Text>
                        <Text style={styles.rideTime}>{formatTime(ride.departureTime)}</Text>
                      </View>
                      <View style={styles.seatsContainer}>
                        <View style={styles.seatsInfo}>
                        <Text style={styles.seatsValue}>{ride.availableSeats}</Text>
                          <Text style={styles.seatsLabel}>available</Text>
                          {ride.totalSeats > ride.availableSeats && (
                            <Text style={styles.bookedSeatsLabel}>
                              {ride.totalSeats - ride.availableSeats} booked
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.routeContainer}>
                      <View style={styles.routeItem}>
                        <View style={styles.routeIndicator} />
                        <View style={styles.routeContent}>
                          <Text style={styles.routeAddress}>{ride.fromAddress}</Text>
                        </View>
                      </View>
                      <View style={styles.routeConnector} />
                      <View style={styles.routeItem}>
                        <View style={[styles.routeIndicator, styles.routeIndicatorDest]} />
                        <View style={styles.routeContent}>
                          <Text style={styles.routeAddress}>{ride.toAddress}</Text>
                        </View>
                      </View>
                    </View>
                    {/* Distance and Price display */}
                    <View style={styles.infoContainer}>
                      {ride.distance !== undefined && (
                        <View style={styles.infoItem}>
                          <IconSymbol size={14} name="mappin" color="#999999" />
                          <Text style={styles.infoValue}>
                            {ride.distance.toFixed(1)} mi
                          </Text>
                        </View>
                      )}
                      {ride.price && (
                        <View style={styles.infoItem}>
                          <IconSymbol size={14} name="dollarsign.circle.fill" color="#4285F4" />
                          <Text style={styles.priceValue}>
                            ${ride.price.toFixed(2)}/seat
                          </Text>
                        </View>
                      )}
                      {ride.totalSeats > ride.availableSeats && (
                        <View style={styles.infoItem}>
                          <IconSymbol size={14} name="dollarsign.circle.fill" color="#4285F4" />
                          <Text style={styles.earningsValue}>
                            ${calculateEarnings(ride).toFixed(2)} earned
                          </Text>
                        </View>
                      )}
                  </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteRide(ride)}
                    activeOpacity={0.7}>
                    <IconSymbol size={18} name="trash" color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  greetingContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    opacity: 0.9,
  },
  name: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4285F4',
    opacity: 0.9,
  },
  mapWrapper: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  currentRideCard: {
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
  currentEta: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4285F4',
  },
  currentRideInfo: {
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
  currentPassenger: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  currentDestination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currentDestText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.8,
    flex: 1,
    lineHeight: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    width: '65%',
    backgroundColor: '#4285F4',
    borderRadius: 4,
  },
  ridesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  addRideButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addRideIcon: {
    fontSize: 24,
    fontWeight: '300',
    color: '#000000',
    lineHeight: 24,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.6,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.5,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 250,
  },
  rideCard: {
    backgroundColor: '#0F0F0F',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderTopWidth: 2,
    borderLeftWidth: 1.5,
    borderRightWidth: 1,
    borderBottomWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftColor: 'rgba(255, 255, 255, 0.05)',
    borderRightColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  rideTimeContainer: {
    flex: 1,
  },
  rideDate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.4,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rideTime: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  seatsContainer: {
    alignItems: 'flex-end',
  },
  seatsInfo: {
    alignItems: 'flex-end',
  },
  seatsValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  seatsLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.4,
    marginTop: 2,
    textTransform: 'lowercase',
  },
  bookedSeatsLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
    marginTop: 2,
    textTransform: 'lowercase',
  },
  routeContainer: {
    gap: 6,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
    marginTop: 4,
    marginRight: 10,
  },
  routeIndicatorDest: {
    backgroundColor: '#FF3B30',
  },
  routeConnector: {
    width: 2,
    height: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    marginLeft: 3,
    marginVertical: 2,
    borderRadius: 1,
  },
  routeContent: {
    flex: 1,
  },
  routeAddress: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  infoContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.6,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4',
  },
  earningsValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4',
  },
  pricePerSeat: {
    fontSize: 11,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
  },
  passengerCount: {
    fontSize: 11,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
  },
  startRideButton: {
    marginTop: 16,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startRideButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.3,
  },
  rideCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rideCardContent: {
    flex: 1,
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
});
