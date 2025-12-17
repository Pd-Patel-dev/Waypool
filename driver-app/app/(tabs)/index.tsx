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
import { calculateTotalDistance } from '@/utils/distance';

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
  
  // Filter and sort state
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'in-progress' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'distance' | 'earnings'>('date');
  const [showFilters, setShowFilters] = useState(false);
  
  // Current active ride - automatically detected from rides
  const currentRide = rides.find((ride) => ride.status === 'in-progress') || null;
  
  // Calculate progress for active ride (simplified - would need route data for accurate calculation)
  // For now, we'll show a placeholder. Real progress calculation would require route coordinates
  const activeRideProgress = currentRide ? 0 : 0; // Will be calculated when viewing ride details

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
          // Check if location services are enabled
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            setLocationError('Location services are disabled');
            return;
          }

          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            setLocationError('Location permission denied');
            return;
          }

          // Get location with timeout
          const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            maximumAge: 10000,
          });
          
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Location request timeout")), 15000)
          );
          
          const currentLocation = await Promise.race([
            locationPromise,
            timeoutPromise,
          ]) as any;

          const coords = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          };
          
          // Validate coordinates
          if (isFinite(coords.latitude) && isFinite(coords.longitude)) {
          setLocation(coords);
            setLocationError(null); // Clear any previous errors
          // Reverse geocode to get city and state
          await reverseGeocode(coords.latitude, coords.longitude);
          } else {
            throw new Error("Invalid location coordinates received");
          }
        } catch (error: any) {
          console.error('Error getting location:', error);
          let errorMessage = 'Failed to get location';
          if (error?.message?.includes("timeout")) {
            errorMessage = 'Location request timed out';
          } else if (error?.message?.includes("permission")) {
            errorMessage = 'Location permission denied';
          }
          setLocationError(errorMessage);
          
          // Try to use last known location as fallback
          try {
            const lastKnownLocation = await Location.getLastKnownPositionAsync({
              maximumAge: 60000,
            });
            if (lastKnownLocation) {
              const fallbackCoords = {
                latitude: lastKnownLocation.coords.latitude,
                longitude: lastKnownLocation.coords.longitude,
              };
              if (isFinite(fallbackCoords.latitude) && isFinite(fallbackCoords.longitude)) {
                setLocation(fallbackCoords);
                await reverseGeocode(fallbackCoords.latitude, fallbackCoords.longitude);
              }
            }
          } catch (fallbackError) {
            console.error("Error getting last known location:", fallbackError);
          }
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

  // Filter rides based on selected filter
  const filteredRides = rides.filter((ride) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'scheduled') return ride.status === 'scheduled' || !ride.status;
    if (filterStatus === 'in-progress') return ride.status === 'in-progress';
    if (filterStatus === 'completed') return ride.status === 'completed';
    return true;
  });

  // Sort rides
  const sortedRides = [...filteredRides].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
    }
    if (sortBy === 'distance') {
      const distA = calculateTotalDistance(a);
      const distB = calculateTotalDistance(b);
      return distB - distA; // Descending
    }
    if (sortBy === 'earnings') {
      const earningsA = calculateEarnings(a);
      const earningsB = calculateEarnings(b);
      return earningsB - earningsA; // Descending
    }
    return 0;
  });

  // Separate rides into today's rides and upcoming rides (excluding active ride)
  const ridesExcludingActive = sortedRides.filter((ride) => ride.status !== 'in-progress');
  const todaysRides = ridesExcludingActive.filter((ride) => isToday(ride.departureTime));
  const upcomingRides = ridesExcludingActive.filter((ride) => !isToday(ride.departureTime));

  // Get status badge info
  const getStatusBadge = (ride: Ride) => {
    if (ride.status === 'in-progress') {
      return { text: 'IN PROGRESS', color: '#4285F4', bgColor: 'rgba(66, 133, 244, 0.15)' };
    }
    if (ride.status === 'completed') {
      return { text: 'COMPLETED', color: '#34C759', bgColor: 'rgba(52, 199, 89, 0.15)' };
    }
    if (ride.status === 'cancelled') {
      return { text: 'CANCELLED', color: '#FF3B30', bgColor: 'rgba(255, 59, 48, 0.15)' };
    }
    return { text: 'SCHEDULED', color: '#FFD60A', bgColor: 'rgba(255, 214, 10, 0.15)' };
  };

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
    if (!ride) {
      console.error('Ride not found with ID:', rideId);
      return;
    }

    // For in-progress rides, navigate to current ride screen
    if (ride.status === 'in-progress') {
      router.push({
        pathname: '/current-ride',
        params: {
          rideId: String(ride.id),
          ride: JSON.stringify(ride),
        },
      });
    } else {
      // For scheduled/upcoming rides, navigate to upcoming ride details screen (read-only)
      router.push({
        pathname: '/upcoming-ride-details',
        params: {
          rideId: String(ride.id),
        },
      });
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
            onPress={() => handleRidePress(currentRide.id)}
            activeOpacity={0.9}>
            
            <View style={styles.liveHeader}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE RIDE</Text>
              </View>
              <TouchableOpacity
                style={styles.viewRideButton}
                onPress={() => handleRidePress(currentRide.id)}
                activeOpacity={0.7}>
                <Text style={styles.viewRideButtonText}>View Ride</Text>
                <IconSymbol size={14} name="chevron.right" color="#4285F4" />
              </TouchableOpacity>
            </View>

            <View style={styles.currentRideInfo}>
                  <View style={styles.statusRow}>
                <IconSymbol size={16} name="car.fill" color="#4285F4" />
                <Text style={styles.statusLabel}>Active Ride</Text>
                  </View>
              <Text style={styles.currentRouteLabel}>Route</Text>
              <View style={styles.currentRouteContainer}>
                <View style={styles.currentRouteItem}>
                  <View style={styles.currentRouteIndicator} />
                  <Text style={styles.currentRouteText} numberOfLines={1}>
                    {currentRide.fromAddress}
                  </Text>
                  </View>
                <View style={styles.currentRouteConnector} />
                <View style={styles.currentRouteItem}>
                  <View style={[styles.currentRouteIndicator, styles.currentRouteIndicatorDest]} />
                  <Text style={styles.currentRouteText} numberOfLines={1}>
                    {currentRide.toAddress}
                  </Text>
                  </View>
                  </View>
              
              {currentRide.passengers && currentRide.passengers.length > 0 && (
                <View style={styles.currentPassengersInfo}>
                  <IconSymbol size={14} name="person.2.fill" color="#FFFFFF" />
                  <Text style={styles.currentPassengersText}>
                    {currentRide.passengers.length} passenger{currentRide.passengers.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
        </View>

            {/* Progress Bar - Shows distance covered */}
            <View style={styles.progressBar}>
              <View style={[styles.progress, { width: `${activeRideProgress}%` }]} />
            </View>
            {activeRideProgress > 0 && (
              <Text style={styles.progressText}>
                {activeRideProgress.toFixed(0)}% complete
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Filter and Sort Section */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() => setShowFilters(!showFilters)}
              activeOpacity={0.7}>
              <IconSymbol size={18} name="line.3.horizontal.decrease" color="#FFFFFF" />
              <Text style={styles.filterToggleText}>Filter & Sort</Text>
              {showFilters && <IconSymbol size={14} name="chevron.up" color="#FFFFFF" />}
              {!showFilters && <IconSymbol size={14} name="chevron.down" color="#FFFFFF" />}
            </TouchableOpacity>
            {(filterStatus !== 'all' || sortBy !== 'date') && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={() => {
                  setFilterStatus('all');
                  setSortBy('date');
                }}
                activeOpacity={0.7}>
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {showFilters && (
            <View style={styles.filtersContainer}>
              {/* Status Filter */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'scheduled', 'in-progress', 'completed'] as const).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterChip,
                        filterStatus === status && styles.filterChipActive,
                      ]}
                      onPress={() => setFilterStatus(status)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.filterChipText,
                          filterStatus === status && styles.filterChipTextActive,
                        ]}>
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort Options */}
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Sort By</Text>
                <View style={styles.filterOptions}>
                  {(['date', 'distance', 'earnings'] as const).map((sort) => (
                    <TouchableOpacity
                      key={sort}
                      style={[
                        styles.filterChip,
                        sortBy === sort && styles.filterChipActive,
                      ]}
                      onPress={() => setSortBy(sort)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.filterChipText,
                          sortBy === sort && styles.filterChipTextActive,
                        ]}>
                        {sort === 'date' ? 'Date' : sort.charAt(0).toUpperCase() + sort.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

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
                      <View style={styles.rideTimeRow}>
                      <Text style={styles.rideDate}>{formatDate(ride.departureTime)}</Text>
                        {(() => {
                          const statusBadge = getStatusBadge(ride);
                          return (
                            <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                              <View style={[styles.statusDot, { backgroundColor: statusBadge.color }]} />
                              <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                                {statusBadge.text}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
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
                    {(() => {
                      const totalDistance = calculateTotalDistance(ride);
                      return totalDistance > 0 ? (
                        <View style={styles.infoItem}>
                          <IconSymbol size={14} name="mappin" color="#999999" />
                          <Text style={styles.infoValue}>
                            {totalDistance.toFixed(1)} mi
                          </Text>
                        </View>
                      ) : null;
                    })()}
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
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => router.push({ pathname: '/edit-ride', params: { rideId: ride.id.toString() } })}
                    activeOpacity={0.7}>
                    <IconSymbol size={18} name="pencil" color="#4285F4" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteRide(ride)}
                    activeOpacity={0.7}>
                    <IconSymbol size={18} name="trash" color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                </View>
                {/* Action Buttons - Only for today's rides */}
                {/* Only show Start Ride for scheduled rides that are today */}
                {(ride.status === 'scheduled' || !ride.status) && isToday(ride.departureTime) ? (
                <TouchableOpacity
                  style={styles.startRideButton}
                  onPress={() => handleStartRide(ride)}
                  activeOpacity={0.8}>
                  <IconSymbol size={18} name="play.fill" color="#000000" />
                  <Text style={styles.startRideButtonText}>Start Ride</Text>
                </TouchableOpacity>
                ) : ride.status === 'in-progress' ? (
                  <TouchableOpacity
                    style={[styles.startRideButton, styles.viewRideButtonStyle]}
                    onPress={() => handleRidePress(ride.id)}
                    activeOpacity={0.8}>
                    <IconSymbol size={18} name="arrow.right.circle.fill" color="#FFFFFF" />
                    <Text style={[styles.startRideButtonText, styles.viewRideButtonTextStyle]}>Continue Ride</Text>
                  </TouchableOpacity>
                ) : null}
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
                    <View style={styles.rideTimeRow}>
                    <Text style={styles.rideDate}>{formatDate(ride.departureTime)}</Text>
                      {(() => {
                        const statusBadge = getStatusBadge(ride);
                        return (
                          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusBadge.color }]} />
                            <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                              {statusBadge.text}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
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
                  {(() => {
                    const totalDistance = calculateTotalDistance(ride);
                    return totalDistance > 0 ? (
                      <View style={styles.infoItem}>
                        <IconSymbol size={14} name="mappin" color="#999999" />
                        <Text style={styles.infoValue}>
                          {totalDistance.toFixed(1)} mi
                        </Text>
                      </View>
                    ) : null;
                  })()}
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
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => router.push({ pathname: '/edit-ride', params: { rideId: ride.id.toString() } })}
                  activeOpacity={0.7}>
                  <IconSymbol size={18} name="pencil" color="#4285F4" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteRide(ride)}
                  activeOpacity={0.7}>
                  <IconSymbol size={18} name="trash" color="#FF3B30" />
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#4285F4',
    borderRadius: 4,
    minWidth: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666666',
    marginTop: 4,
    textAlign: 'right',
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
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  editButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Active Ride Card Styles
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
  currentRouteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentRouteContainer: {
    gap: 8,
    marginBottom: 12,
  },
  currentRouteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currentRouteIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  currentRouteIndicatorDest: {
    backgroundColor: '#FF3B30',
  },
  currentRouteText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  currentRouteConnector: {
    width: 2,
    height: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.3)',
    marginLeft: 3,
    marginVertical: 2,
    borderRadius: 1,
  },
  currentPassengersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  currentPassengersText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.7,
  },
  // Status Badge Styles
  rideTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Filter & Sort Styles
  filterSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
  filtersContainer: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    gap: 16,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  filterChipActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.7,
  },
  filterChipTextActive: {
    color: '#000000',
    opacity: 1,
  },
  viewRideButtonStyle: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  viewRideButtonTextStyle: {
    color: '#FFFFFF',
  },
});
