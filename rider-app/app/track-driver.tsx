import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@/context/UserContext';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDriverLocation, type DriverLocationResponse } from '@/services/api';
import { calculateDistance } from '@/utils/distance';
import { type RiderBooking } from '@/services/api';
import { logger } from '@/utils/logger';

// Use Google Maps only on Android, default provider (Apple Maps) on iOS
// Google Maps on iOS requires additional native setup not available in managed Expo
const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

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

export default function TrackDriverScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [booking, setBooking] = useState<RiderBooking | null>(null);
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [previousDriverLocation, setPreviousDriverLocation] = useState<LocationCoords | null>(null);
  const [pickupLocation, setPickupLocation] = useState<LocationCoords | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LocationCoords[]>([]);
  const [eta, setETA] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [driverBearing, setDriverBearing] = useState<number>(0); // Direction driver is facing (0-360 degrees)
  const mapRef = useRef<MapView>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationUpdateRef = useRef<Date | null>(null);
  const markerAnimation = useRef(new Animated.Value(0)).current;
  const shouldFollowDriver = useRef(true);
  const driverLocationRef = useRef<LocationCoords | null>(null); // Use ref to avoid dependency issues
  const previousDriverLocationRef = useRef<LocationCoords | null>(null);
  const hasSetUpIntervalRef = useRef(false); // Prevent interval recreation
  const lastRouteFetchRef = useRef<LocationCoords | null>(null); // Track last route fetch location

  useEffect(() => {
    // Parse booking data from params
    if (params.booking) {
      try {
        const bookingData = JSON.parse(params.booking as string);
        setBooking(bookingData);
        setPickupLocation({
          latitude: bookingData.pickupLatitude,
          longitude: bookingData.pickupLongitude,
        });
      } catch (error) {
        console.error('Error parsing booking data:', error);
        Alert.alert('Error', 'Invalid booking data');
        router.back();
      }
    }

    return () => {
      // Cleanup tracking interval
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, [params.booking]);

  // Calculate bearing (direction) between two points
  const calculateBearing = (from: LocationCoords, to: LocationCoords): number => {
    const lat1 = (from.latitude * Math.PI) / 180;
    const lat2 = (to.latitude * Math.PI) / 180;
    const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;

    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    const bearing = Math.atan2(y, x);
    return ((bearing * 180) / Math.PI + 360) % 360;
  };

  // Fetch driver location and update
  const fetchDriverLocation = useCallback(async () => {
    if (!booking || !user?.id) {
      console.log('⚠️ Cannot fetch driver location: missing booking or user', { booking: !!booking, user: !!user });
      setIsLoading(false); // Clear loading state if we can't fetch
      return;
    }

    try {
      const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      console.log('📍 Fetching driver location for ride:', booking.ride.id, 'rider:', userId);
      
      const response: DriverLocationResponse = await getDriverLocation(booking.ride.id, userId);
      
      console.log('📍 Driver location response:', {
        success: response.success,
        hasDriverLocation: !!response.driverLocation,
        rideStatus: response.ride?.status,
      });

      if (response.success) {
        if (response.driverLocation) {
          const newLocation = {
            latitude: response.driverLocation.latitude,
            longitude: response.driverLocation.longitude,
          };

          // Check if location has actually changed (avoid unnecessary updates)
          const hasLocationChanged = !driverLocationRef.current || 
            Math.abs(driverLocationRef.current.latitude - newLocation.latitude) > 0.0001 || // ~11 meters
            Math.abs(driverLocationRef.current.longitude - newLocation.longitude) > 0.0001;

          if (!hasLocationChanged) {
            console.log('📍 Driver location unchanged, skipping update');
            setIsLoading(false);
            return; // Don't update if location hasn't changed
          }

          console.log('✅ Driver location changed:', {
            location: newLocation,
            previousLocation: driverLocationRef.current,
            rideStatus: response.ride?.status,
          });

          // Calculate bearing if we have previous location
          if (previousDriverLocationRef.current) {
            const bearing = calculateBearing(previousDriverLocationRef.current, newLocation);
            setDriverBearing(bearing);
          }

          // Animate marker update only when location changes
          Animated.sequence([
            Animated.timing(markerAnimation, {
              toValue: 1,
              duration: 200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(markerAnimation, {
              toValue: 0,
              duration: 200,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();

          // Check if this is the first time we're getting driver location
          const wasFirstLocation = !driverLocationRef.current;
          
          // Update refs immediately for next fetch
          previousDriverLocationRef.current = driverLocationRef.current;
          driverLocationRef.current = newLocation;
          
          // Update state for UI
          setPreviousDriverLocation(driverLocationRef.current);
          setDriverLocation(newLocation);
          lastLocationUpdateRef.current = response.driverLocation.updatedAt
            ? new Date(response.driverLocation.updatedAt)
            : new Date();

          // Calculate distance and ETA (only if location changed)
          if (pickupLocation) {
            const dist = calculateDistance(
              response.driverLocation.latitude,
              response.driverLocation.longitude,
              pickupLocation.latitude,
              pickupLocation.longitude
            );
            setDistance(dist);

            // Fetch route between driver and pickup (this will update ETA)
            // Only fetch route if location changed significantly
            fetchRoute(response.driverLocation, pickupLocation);
          }

          // Smoothly follow driver with camera (Uber-style: focus on driver)
          if (mapRef.current && shouldFollowDriver.current) {
            if (wasFirstLocation) {
              // First time getting location - immediate center with zoom (like Uber)
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.animateToRegion(
                    {
                      latitude: newLocation.latitude,
                      longitude: newLocation.longitude,
                      latitudeDelta: 0.015,
                      longitudeDelta: 0.015,
                    },
                    800
                  );
                }
              }, 200);
            } else {
              // Subsequent updates - smooth follow as driver moves
              mapRef.current.animateToRegion(
                {
                  latitude: newLocation.latitude,
                  longitude: newLocation.longitude,
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.015,
                },
                1000
              );
            }
          }
        } else {
          console.log('⚠️ Driver location not available yet. Ride status:', response.ride?.status);
        }
      }
      setIsLoading(false);
    } catch (error: any) {
      console.error('❌ Error fetching driver location:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        booking: booking?.id,
        rideId: booking?.ride?.id,
      });
      setIsLoading(false);
      // Don't show alert on every error, just log it
    }
  }, [booking, user, pickupLocation]); // Removed driverLocation, previousDriverLocation, markerAnimation to prevent infinite loops

  // Fetch route from Google Directions API (only if driver moved significantly)
  const fetchRoute = async (origin: LocationCoords, destination: LocationCoords) => {
    // Check if we need to fetch route (only if driver moved > 100 meters)
    if (lastRouteFetchRef.current) {
      const distanceFromLastFetch = calculateDistance(
        lastRouteFetchRef.current.latitude,
        lastRouteFetchRef.current.longitude,
        origin.latitude,
        origin.longitude
      );
      
      // Only fetch if driver moved more than 100 meters (0.062 miles)
      if (distanceFromLastFetch < 0.1) {
        console.log('📍 Driver moved < 100m, skipping route update');
        return; // Don't fetch route if driver hasn't moved much
      }
    }

    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!GOOGLE_API_KEY) {
        logger.warn('Google Maps API key not configured. Route calculation unavailable.', undefined, 'track-driver');
        // Fallback: simple straight line (but log the issue)
        setRouteCoordinates([origin, destination]);
        return;
      }

      // Update last fetch location
      lastRouteFetchRef.current = origin;

      // Use traffic-aware directions for accurate ETA (like Uber)
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&departure_time=now&traffic_model=best_guess&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        let allPoints: LocationCoords[] = [];

        // Decode polyline
        const decodePolyline = (encoded: string): LocationCoords[] => {
          const poly: LocationCoords[] = [];
          let index = 0;
          const len = encoded.length;
          let lat = 0;
          let lng = 0;

          while (index < len) {
            let b: number;
            let shift = 0;
            let result = 0;
            do {
              b = encoded.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
            lat += dlat;

            shift = 0;
            result = 0;
            do {
              b = encoded.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
            lng += dlng;

            poly.push({ latitude: lat * 1e-5, longitude: lng * 1e-5 });
          }
          return poly;
        };

        // Get points from overview polyline
        if (route.overview_polyline && route.overview_polyline.points) {
          allPoints = decodePolyline(route.overview_polyline.points);

            // Update ETA with actual route data (includes traffic)
            if (route.legs && route.legs.length > 0) {
              const leg = route.legs[0];
              // Use duration_in_traffic if available (more accurate), otherwise use duration
              const durationValue = leg.duration_in_traffic?.value || leg.duration?.value;
              if (durationValue) {
                const durationMinutes = Math.round(durationValue / 60);
                if (durationMinutes < 1) {
                  setETA('Arriving now');
                } else if (durationMinutes === 1) {
                  setETA('1 min');
                } else {
                  setETA(`${durationMinutes} mins`);
                }
              }
              // Update distance with actual route distance
              if (leg.distance) {
                const routeDistanceMiles = leg.distance.value / 1609.34; // Convert meters to miles
                setDistance(routeDistanceMiles);
              }
            }

          setRouteCoordinates(allPoints);
        } else {
          // Fallback: straight line
          setRouteCoordinates([origin, destination]);
        }
      } else {
        // Fallback: straight line
        setRouteCoordinates([origin, destination]);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback: straight line
      setRouteCoordinates([origin, destination]);
    }
  };

  // Initial map setup - focus on driver location when first received
  useEffect(() => {
    if (driverLocation && mapRef.current && shouldFollowDriver.current) {
      // Focus on driver location first (like Uber - driver is primary)
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.015, // Closer zoom on driver
          longitudeDelta: 0.015,
        },
        500 // Quick animation to driver
      );
    } else if (driverLocation && pickupLocation && mapRef.current && !shouldFollowDriver.current) {
      // If user has panned away, show both locations when they first load
      const coordinates = [driverLocation, pickupLocation];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 50, bottom: 280, left: 50 },
        animated: true,
      });
    }
  }, [driverLocation, pickupLocation]);

  // Store fetchDriverLocation in ref to prevent interval recreation
  const fetchDriverLocationRef = useRef(fetchDriverLocation);
  useEffect(() => {
    fetchDriverLocationRef.current = fetchDriverLocation;
  }, [fetchDriverLocation]);

  // Start tracking - only set up once when booking is available
  useEffect(() => {
    if (booking && !hasSetUpIntervalRef.current) {
      hasSetUpIntervalRef.current = true;
      
      // Fetch initial location immediately
      fetchDriverLocationRef.current();

      // Start periodic updates every 5 seconds for smoother tracking (like Uber)
      setIsTracking(true);
      trackingIntervalRef.current = setInterval(() => {
        fetchDriverLocationRef.current();
      }, 5000); // Update every 5 seconds for real-time feel

      return () => {
        hasSetUpIntervalRef.current = false;
        if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current);
          trackingIntervalRef.current = null;
        }
      };
    }
    // Only depend on booking.id to prevent recreation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const formatLastUpdate = (): string => {
    if (!lastLocationUpdateRef.current) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastLocationUpdateRef.current.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 30) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ago`;
  };

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading booking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading only on initial load, then show map even if driver location isn't available yet
  if (isLoading && !driverLocation && !pickupLocation) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate initial region - prioritize driver location if available
  const initialRegion: Region = driverLocation
    ? {
        // Focus on driver location first (like Uber)
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.015, // Closer zoom level
        longitudeDelta: 0.015,
      }
    : pickupLocation
    ? {
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }
    : {
        // Default fallback (shouldn't happen)
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* Header - Matching other screens */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Driver</Text>
        <View style={styles.backButton} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={MAP_PROVIDER}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          onPanDrag={() => {
            // Stop following driver when user manually pans map
            shouldFollowDriver.current = false;
          }}
          onRegionChangeComplete={() => {
            // Optional: re-enable following after user stops interacting
            // For now, we'll keep it off until they tap center button
          }}
        >
          {/* Pickup Location Marker */}
          {pickupLocation && (
            <Marker
              coordinate={pickupLocation}
              title="Your Pickup Location"
              description={booking.pickupAddress}
            >
              <View style={styles.pickupMarker}>
                <View style={styles.pickupMarkerInner}>
                  <IconSymbol size={20} name="mappin" color="#FFFFFF" />
                </View>
                <View style={styles.pickupMarkerPin} />
              </View>
            </Marker>
          )}

          {/* Driver Location Marker - Uber Style Triangle */}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title="Driver Location"
              description={booking.ride.driverName}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={driverBearing}
              flat={true}
            >
              <View style={styles.driverMarkerArrow}>
                <IconSymbol size={16} name="arrowtriangle.up.fill" color="#4285F4" />
              </View>
            </Marker>
          )}

          {/* Route Polyline - Uber style with gradient effect */}
          {routeCoordinates.length > 1 && (
            <>
              {/* Shadow/outline for depth */}
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#1A1A1A"
                strokeWidth={7}
                lineCap="round"
                lineJoin="round"
                zIndex={0}
              />
              {/* Main route line */}
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#4285F4"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
                zIndex={1}
              />
            </>
          )}
        </MapView>


        {/* Center on Driver Button */}
        {driverLocation && (
          <TouchableOpacity
            style={styles.centerButton}
            onPress={() => {
              shouldFollowDriver.current = true;
              if (mapRef.current) {
                // Center on driver with good zoom level
                mapRef.current.animateToRegion(
                  {
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.015,
                  },
                  500
                );
              }
            }}
            activeOpacity={0.7}
          >
            <IconSymbol size={22} name="location.fill" color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Dark Theme Bottom Card */}
      <View style={styles.bottomCard}>
        {/* ETA - Simple & Prominent */}
        {driverLocation && (
          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>{eta || 'Calculating...'}</Text>
            {distance !== null && distance > 0 && (
              <Text style={styles.distanceText}>
                {distance < 0.1 ? '< 0.1' : distance.toFixed(1)} mi away
              </Text>
            )}
          </View>
        )}

        {/* Driver Info - Compact */}
        <View style={styles.driverContainer}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {booking.ride.driverName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{booking.ride.driverName}</Text>
            {booking.ride.carMake && booking.ride.carModel && (
              <Text style={styles.carInfo}>
                {booking.ride.carYear} {booking.ride.carMake} {booking.ride.carModel}
              </Text>
            )}
          </View>
        </View>

        {/* Loading State */}
        {!driverLocation && booking && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4285F4" />
            <Text style={styles.loadingMessage}>
              {booking.ride.status === 'in-progress' 
                ? 'Waiting for driver location...'
                : 'Driver will share location when ride starts'}
            </Text>
          </View>
        )}
      </View>
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
  },
  loadingText: {
    fontSize: 16,
    color: '#CCCCCC',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  pickupMarker: {
    alignItems: 'center',
  },
  pickupMarkerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pickupMarkerPin: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#4285F4',
    marginTop: -2,
  },
  driverMarkerArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  centerButton: {
    position: 'absolute',
    bottom: 260,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  etaContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  etaValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999999',
  },
  driverContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  carInfo: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingMessage: {
    fontSize: 15,
    fontWeight: '400',
    color: '#999999',
  },
});

