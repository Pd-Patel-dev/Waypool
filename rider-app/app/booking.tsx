import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import AddressAutocomplete, { type AddressDetails } from '@/components/AddressAutocomplete';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
}

interface Ride {
  id: number;
  fromAddress: string;
  toAddress: string;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
}

export default function BookingScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [pickupDetails, setPickupDetails] = useState<AddressDetails | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Parse ride data from params
    if (params.ride) {
      try {
        const rideData = JSON.parse(params.ride as string);
        setRide(rideData);
      } catch (error) {
        console.error('Error parsing ride data:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.ride]);

  // Get current location
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      if (Location && Platform.OS !== 'web') {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted' && isMounted) {
            try {
              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeout: 10000,
              });
              if (isMounted) {
                setCurrentLocation({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                });
              }
            } catch (locationError) {
              // Silently fail - location is optional for address autocomplete
              // It will still work without current location, just won't have location bias
            }
          }
        } catch (error) {
          // Silently fail - location is optional
        }
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Fetch route when pickup is selected
  useEffect(() => {
    if (ride && pickupDetails?.latitude && pickupDetails?.longitude) {
      fetchRoute();
    }
  }, [ride, pickupDetails]);

  const fetchRoute = async () => {
    if (!ride || !pickupDetails?.latitude || !pickupDetails?.longitude) return;

    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyB3dqyiWNGJLqv_UYA2zQxUdYpiIbmw3k4';
      
      // Route: Original Pickup → Rider Pickup → Destination
      const origin = `${ride.fromLatitude},${ride.fromLongitude}`; // Start: Original pickup
      const destination = `${ride.toLatitude},${ride.toLongitude}`; // End: Destination
      const waypoints = [
        `${pickupDetails.latitude},${pickupDetails.longitude}`, // Waypoint: Rider pickup
      ];
      const waypointsStr = waypoints.join('|');
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypointsStr}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        // Use the overview polyline for a cleaner route
        const route = data.routes[0];
        const overviewPolyline = route.overview_polyline?.points;
        
        let allCoordinates: Array<{ latitude: number; longitude: number }> = [];
        let totalDistanceMeters = 0;
        
        if (overviewPolyline) {
          // Decode the overview polyline for a smooth route
          allCoordinates = decodePolyline(overviewPolyline);
        } else {
          // Fallback: combine all route segments if overview not available
          data.routes[0].legs.forEach((leg: any) => {
            if (leg.steps) {
              leg.steps.forEach((step: any) => {
                const points = step.polyline.points;
                const decoded = decodePolyline(points);
                allCoordinates.push(...decoded);
              });
            }
          });
        }
        
        // Sum up distance from all legs
        data.routes[0].legs.forEach((leg: any) => {
          if (leg.distance && leg.distance.value) {
            totalDistanceMeters += leg.distance.value;
          }
        });

        // Convert meters to miles
        const totalDistanceMiles = totalDistanceMeters / 1609.34;
        setTotalDistance(totalDistanceMiles);
        setRouteCoordinates(allCoordinates);

         // Fit map to show entire route
         setTimeout(() => {
           if (mapRef.current && allCoordinates.length > 0) {
             const allPoints = [
               { latitude: ride.fromLatitude, longitude: ride.fromLongitude }, // Stop 1: Original Pickup
               { latitude: pickupDetails.latitude!, longitude: pickupDetails.longitude! }, // Stop 2: Rider Pickup
               { latitude: ride.toLatitude, longitude: ride.toLongitude }, // Stop 3: Destination
             ];
             mapRef.current.fitToCoordinates(allPoints, {
               edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
               animated: true,
             });
           }
         }, 500);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  const handleSelectPickup = (addressDetails: AddressDetails) => {
    setPickupDetails(addressDetails);
  };

  const handleContinue = () => {
    if (!pickupDetails || !ride) return;
    
    // Navigate to confirmation screen with ride and pickup details
    router.push({
      pathname: '/booking-confirm',
      params: {
        ride: JSON.stringify(ride),
        pickupDetails: JSON.stringify(pickupDetails),
        totalDistance: totalDistance?.toString() || '0',
      },
    });
  };

  if (isLoading || !ride) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Your Seat</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Map Section */}
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
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {/* Route */}
            {routeCoordinates.length > 0 && (
              <>
                {/* Shadow/outline for better visibility */}
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="rgba(0, 0, 0, 0.5)"
                  strokeWidth={10}
                  lineCap="round"
                  lineJoin="round"
                  zIndex={0}
                />
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="rgba(66, 133, 244, 0.4)"
                  strokeWidth={8}
                  lineCap="round"
                  lineJoin="round"
                  zIndex={1}
                />
                {/* Main route line */}
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#4285F4"
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                  zIndex={2}
                />
              </>
            )}

             {/* Stop 1: Original Pickup Marker */}
             <Marker
               coordinate={{
                 latitude: ride.fromLatitude,
                 longitude: ride.fromLongitude,
               }}
               title="Stop 1: Original Pickup"
               description={ride.fromAddress}
             >
               <View style={styles.simpleMarker}>
                 <Text style={styles.simpleMarkerText}>1</Text>
               </View>
             </Marker>

             {/* Stop 2: Your Pickup Marker */}
             {pickupDetails?.latitude && pickupDetails?.longitude && (
               <Marker
                 coordinate={{
                   latitude: pickupDetails.latitude,
                   longitude: pickupDetails.longitude,
                 }}
                 title="Stop 2: Your Pickup"
                 description={pickupDetails.fullAddress}
               >
                 <View style={[styles.simpleMarker, styles.simpleMarkerGreen]}>
                   <Text style={styles.simpleMarkerText}>2</Text>
                 </View>
               </Marker>
             )}

             {/* Stop 3: Destination Marker */}
             <Marker
               coordinate={{
                 latitude: ride.toLatitude,
                 longitude: ride.toLongitude,
               }}
               title="Stop 3: Destination"
               description={ride.toAddress}
             >
               <View style={[styles.simpleMarker, styles.simpleMarkerBlack]}>
                 <Text style={styles.simpleMarkerText}>3</Text>
               </View>
             </Marker>
          </MapView>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Select Your Pickup Location</Text>
            
            <AddressAutocomplete
              value={pickupAddress}
              onChangeText={setPickupAddress}
              onSelectAddress={handleSelectPickup}
              placeholder="Enter your pickup address"
              currentLocation={currentLocation}
            />

            {/* Route Info - Stops */}
            {pickupDetails && (
              <View style={styles.routeInfo}>
                <Text style={styles.stopsTitle}>Route Stops</Text>
                
                {/* Stop 1: Original Pickup */}
                <View style={styles.stopItem}>
                  <View style={styles.stopNumber}>
                    <Text style={styles.stopNumberText}>1</Text>
                  </View>
                  <View style={styles.stopContent}>
                    <Text style={styles.stopLabel}>Original Pickup</Text>
                    <Text style={styles.stopAddress} numberOfLines={1}>{ride.fromAddress}</Text>
                  </View>
                </View>

                {/* Stop 2: Your Pickup */}
                <View style={styles.stopItem}>
                  <View style={[styles.stopNumber, styles.stopNumberOriginal]}>
                    <Text style={styles.stopNumberText}>2</Text>
                  </View>
                  <View style={styles.stopContent}>
                    <Text style={styles.stopLabel}>Your Pickup</Text>
                    <Text style={styles.stopAddress} numberOfLines={1}>{pickupDetails.fullAddress}</Text>
                  </View>
                </View>

                {/* Stop 3: Destination */}
                <View style={styles.stopItem}>
                  <View style={[styles.stopNumber, styles.stopNumberEnd]}>
                    <Text style={styles.stopNumberText}>3</Text>
                  </View>
                  <View style={styles.stopContent}>
                    <Text style={styles.stopLabel}>Destination</Text>
                    <Text style={styles.stopAddress} numberOfLines={1}>{ride.toAddress}</Text>
                  </View>
                </View>
                
                {/* Distance Display */}
                {totalDistance !== null && (
                  <View style={styles.distanceContainer}>
                    <IconSymbol name="mappin" size={14} color="#4285F4" />
                    <Text style={styles.distanceText}>
                      {totalDistance.toFixed(1)} mi
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !pickupDetails && styles.confirmButtonDisabled,
              ]}
              onPress={handleContinue}
              disabled={!pickupDetails}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
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
    height: '35%',
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  simpleMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  simpleMarkerGreen: {
    backgroundColor: '#34C759',
  },
  simpleMarkerBlack: {
    backgroundColor: '#FF3B30',
  },
  simpleMarkerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  routeInfo: {
    marginTop: 16,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  stopsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
  },
  stopNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  stopNumberOriginal: {
    backgroundColor: '#34C759',
  },
  stopNumberEnd: {
    backgroundColor: '#FF3B30',
  },
  stopNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopContent: {
    flex: 1,
    paddingRight: 8,
  },
  stopLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  stopAddress: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  stopMarker: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  stopDotOriginal: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  stopDotEnd: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  confirmButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#2A2A2C',
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
    gap: 6,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
});

