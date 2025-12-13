import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';


interface Ride {
  id: number;
  driverName: string;
  driverPhone: string;
  fromAddress: string;
  toAddress: string;
  fromCity: string;
  toCity: string;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
  departureTime: string;
  availableSeats: number;
  totalSeats: number;
  price: number;
  status: string;
  distance?: number | null;
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  carColor?: string | null;
  driver: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    photoUrl?: string | null;
  };
}

export default function RideDetailsScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const mapRef = useRef<MapView>(null);
  const hasFetchedRoute = useRef<boolean>(false);

  // Decode Google Maps polyline
  const decodePolyline = useCallback((encoded: string): Array<{ latitude: number; longitude: number }> => {
    const poly: Array<{ latitude: number; longitude: number }> = [];
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
  }, []);

  const fetchRoute = useCallback(async (rideData: Ride) => {
    try {
      // Use API key from environment variable
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyB3dqyiWNGJLqv_UYA2zQxUdYpiIbmw3k4';
      
      if (!apiKey) {
        console.warn('Google Maps API key not found');
        // Fallback: create simple route with just start and end points
        setRouteCoordinates([
          { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
          { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
        ]);
        return;
      }

      const origin = `${rideData.fromLatitude},${rideData.fromLongitude}`;
      const destination = `${rideData.toLatitude},${rideData.toLongitude}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        // Decode polyline points
        const decoded = decodePolyline(points);
        setRouteCoordinates(decoded);

        // Fit map to show entire route after a short delay to ensure map is ready
        setTimeout(() => {
          if (mapRef.current && decoded.length > 0) {
            mapRef.current.fitToCoordinates(decoded, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          }
        }, 500);
      } else {
        // Fallback: create simple route
        setRouteCoordinates([
          { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
          { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
        ]);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback: create simple route
      setRouteCoordinates([
        { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
        { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
      ]);
    }
  }, [decodePolyline]);

  useEffect(() => {
    // Parse ride data from params only once
    if (params.ride && !hasFetchedRoute.current) {
      try {
        const rideData = JSON.parse(params.ride as string);
        setRide(rideData);
        hasFetchedRoute.current = true;
        fetchRoute(rideData);
      } catch (error) {
        console.error('Error parsing ride data:', error);
      } finally {
        setIsLoading(false);
      }
    } else if (!params.ride) {
      setIsLoading(false);
    }
  }, [params.ride, fetchRoute]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ride not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleBookSeat = () => {
    // Navigate to booking screen with ride data
    router.push({
      pathname: '/booking',
      params: {
        ride: JSON.stringify(ride),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map Section - Takes up most of the screen */}
      {ride && (
        <View style={styles.mapSection}>
              <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                style={styles.map}
                initialRegion={{
                  latitude: (ride.fromLatitude + ride.toLatitude) / 2,
                  longitude: (ride.fromLongitude + ride.toLongitude) / 2,
                  latitudeDelta: Math.abs(ride.toLatitude - ride.fromLatitude) * 1.8 || 0.1,
                  longitudeDelta: Math.abs(ride.toLongitude - ride.fromLongitude) * 1.8 || 0.1,
                }}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsTraffic={false}
                toolbarEnabled={false}
                loadingEnabled={true}
                loadingBackgroundColor="#2A2A2A"
                loadingIndicatorColor="#4285F4"
                onMapReady={() => {
                  // Fit to coordinates after map loads
                  if (mapRef.current && routeCoordinates.length > 0) {
                    setTimeout(() => {
                      mapRef.current?.fitToCoordinates(routeCoordinates, {
                        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                        animated: true,
                      });
                    }, 300);
                  } else if (mapRef.current) {
                    // Fallback: fit to start and end points
                    setTimeout(() => {
                      mapRef.current?.fitToCoordinates(
                        [
                          { latitude: ride.fromLatitude, longitude: ride.fromLongitude },
                          { latitude: ride.toLatitude, longitude: ride.toLongitude },
                        ],
                        {
                          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                          animated: true,
                        }
                      );
                    }, 300);
                  }
                }}
              >
                {/* Route line - actual road route with gradient effect */}
                {routeCoordinates.length > 0 ? (
                  <>
                    {/* Shadow/outline */}
                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor="rgba(66, 133, 244, 0.3)"
                      strokeWidth={8}
                      lineCap="round"
                      lineJoin="round"
                    />
                    {/* Main route */}
                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor="#4285F4"
                      strokeWidth={5}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </>
                ) : (
                  <Polyline
                    coordinates={[
                      { latitude: ride.fromLatitude, longitude: ride.fromLongitude },
                      { latitude: ride.toLatitude, longitude: ride.toLongitude },
                    ]}
                    strokeColor="#4285F4"
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                    lineDashPattern={[10, 5]}
                  />
                )}
                {/* Start marker - Small Car Icon */}
                <Marker 
                  coordinate={{
                    latitude: ride.fromLatitude,
                    longitude: ride.fromLongitude,
                  }}
                  title="Pickup"
                  description={ride.fromAddress}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.carMarker}>
                      <IconSymbol size={16} name="car" color="#FFFFFF" />
                    </View>
                  </View>
                </Marker>
                
                {/* Destination marker - Small Flag Icon */}
                <Marker 
                  coordinate={{
                    latitude: ride.toLatitude,
                    longitude: ride.toLongitude,
                  }}
                  title="Destination"
                  description={ride.toAddress}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.destinationMarker}>
                      <IconSymbol size={14} name="flag" color="#FFFFFF" />
                    </View>
                    <View style={styles.markerPin} />
                  </View>
                </Marker>
              </MapView>
              
              {/* Distance Badge */}
              {ride.distance && (
                <View style={styles.distanceOverlay}>
                  <Text style={styles.distanceText}>
                    {ride.distance.toFixed(1)} mi
                  </Text>
                </View>
              )}
            </View>
          )}

      {/* Content Below Map */}
      <View style={styles.contentContainer}>
        <View style={styles.content}>
          {/* Driver Info */}
          <View style={styles.driverSection}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {ride.driverName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ride.driverName}</Text>
              {ride.carMake && ride.carModel && (
                <Text style={styles.carInfo}>
                  {ride.carYear} {ride.carMake} {ride.carModel}
                </Text>
              )}
            </View>
            <View style={styles.priceSection}>
              <Text style={styles.price}>${ride.price.toFixed(0)}</Text>
              <Text style={styles.priceLabel}>per seat</Text>
            </View>
          </View>

          {/* Route */}
          <View style={styles.routeSection}>
            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {ride.fromAddress}
              </Text>
            </View>
            <View style={styles.routeItem}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {ride.toAddress}
              </Text>
            </View>
          </View>

          {/* Trip Details */}
          <View style={styles.detailsSection}>
            <View style={styles.detailItem}>
              <IconSymbol size={16} name="clock" color="#666666" />
              <Text style={styles.detailText}>
                {formatDate(ride.departureTime)} • {formatTime(ride.departureTime)}
              </Text>
            </View>
            {ride.distance && (
              <View style={styles.detailItem}>
                <IconSymbol size={16} name="mappin" color="#666666" />
                <Text style={styles.detailText}>{ride.distance.toFixed(1)} mi</Text>
              </View>
            )}
            <View style={styles.detailItem}>
              <IconSymbol size={16} name="person" color="#666666" />
              <Text style={styles.detailText}>
                {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''} available
              </Text>
            </View>
          </View>

          {/* Book Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.bookButton}
              onPress={handleBookSeat}
              activeOpacity={0.8}
            >
              <Text style={styles.bookButtonText}>Book Seat</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapSection: {
    height: '45%',
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  destinationMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerPin: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#000000',
    marginTop: -2,
  },
  distanceOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  distanceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  carInfo: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4285F4',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
    marginTop: 2,
  },
  routeSection: {
    marginBottom: 24,
  },
  routeItem: {
    marginBottom: 20,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  detailsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666666',
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  bookButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
  },
});

