import React, { useState, useEffect, useRef } from 'react';
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
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, BUTTONS, RESPONSIVE_SPACING, CARDS } from '@/constants/designSystem';

interface AddressDetails {
  fullAddress: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  zipCode?: string;
}

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
  pricePerSeat?: number;
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

export default function RidePreviewScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [pickupDetails, setPickupDetails] = useState<AddressDetails | null>(null);
  const [numberOfSeats, setNumberOfSeats] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const hasParsedParams = useRef(false);

  const decodePolyline = React.useCallback((encoded: string): Array<{ latitude: number; longitude: number }> => {
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

  const fetchRoute = React.useCallback(async (rideData: Ride, pickupData: AddressDetails) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      
      if (!apiKey) {
        setRouteCoordinates([
          { latitude: pickupData.latitude, longitude: pickupData.longitude },
          { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
        ]);
        return;
      }

      const origin = `${pickupData.latitude},${pickupData.longitude}`;
      const destination = `${rideData.toLatitude},${rideData.toLongitude}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        const decoded = decodePolyline(points);
        setRouteCoordinates(decoded);
      } else {
        setRouteCoordinates([
          { latitude: pickupData.latitude, longitude: pickupData.longitude },
          { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
        ]);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setRouteCoordinates([
        { latitude: pickupData.latitude, longitude: pickupData.longitude },
        { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
      ]);
    }
  }, [decodePolyline]);

  useEffect(() => {
    // Prevent infinite re-renders by using a ref guard
    if (hasParsedParams.current) return;

    if (params.ride && params.pickupDetails) {
      try {
        const rideData = JSON.parse(params.ride as string);
        const pickupData = JSON.parse(params.pickupDetails as string);
        setRide(rideData);
        setPickupDetails(pickupData);
        if (params.numberOfSeats) {
          setNumberOfSeats(parseInt(params.numberOfSeats as string, 10) || 1);
        }
        hasParsedParams.current = true;
        setIsLoading(false);
        // Fetch route after state is set
        fetchRoute(rideData, pickupData);
      } catch (error) {
        console.error('Error parsing data:', error);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.ride, params.pickupDetails, params.numberOfSeats, fetchRoute]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
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

  const handleConfirm = () => {
    if (!ride || !pickupDetails) return;
    
    router.push({
      pathname: '/booking-confirm',
      params: {
        ride: JSON.stringify(ride),
        pickupDetails: JSON.stringify(pickupDetails),
        numberOfSeats: numberOfSeats.toString(),
      },
    });
  };

  const handleIncrementSeats = () => {
    if (ride && numberOfSeats < ride.availableSeats) {
      setNumberOfSeats(numberOfSeats + 1);
    }
  };

  const handleDecrementSeats = () => {
    if (numberOfSeats > 1) {
      setNumberOfSeats(numberOfSeats - 1);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading preview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride || !pickupDetails) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <IconSymbol size={48} name="exclamationmark.triangle" color={COLORS.textTertiary} />
          <Text style={styles.errorText}>Missing ride information</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol size={22} name="chevron.left" color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Preview</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Map Section */}
        <View style={styles.mapContainer}>
          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            initialRegion={{
              latitude: (pickupDetails.latitude + ride.toLatitude) / 2,
              longitude: (pickupDetails.longitude + ride.toLongitude) / 2,
              latitudeDelta: Math.abs(ride.toLatitude - pickupDetails.latitude) * 1.8 || 0.1,
              longitudeDelta: Math.abs(ride.toLongitude - pickupDetails.longitude) * 1.8 || 0.1,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            showsTraffic={false}
            toolbarEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {/* Route Line */}
            {routeCoordinates.length > 0 ? (
              <>
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="rgba(66, 133, 244, 0.3)"
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              </>
            ) : (
              <Polyline
                coordinates={[
                  { latitude: pickupDetails.latitude, longitude: pickupDetails.longitude },
                  { latitude: ride.toLatitude, longitude: ride.toLongitude },
                ]}
                strokeColor={COLORS.primary}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
                lineDashPattern={[8, 4]}
              />
            )}
            
            {/* Pickup Marker */}
            <Marker 
              coordinate={{
                latitude: pickupDetails.latitude,
                longitude: pickupDetails.longitude,
              }}
            >
              <View style={styles.markerStart}>
                <View style={styles.markerDot} />
              </View>
            </Marker>
            
            {/* Destination Marker */}
            <Marker 
              coordinate={{
                latitude: ride.toLatitude,
                longitude: ride.toLongitude,
              }}
            >
              <View style={styles.markerEnd}>
                <View style={styles.markerDotEnd} />
              </View>
            </Marker>
          </MapView>
        </View>

        {/* Route Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>Your Pickup</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>{pickupDetails.fullAddress}</Text>
            </View>
          </View>
          
          <View style={styles.routeSeparator} />
          
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDest]} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>{ride.toAddress}</Text>
            </View>
          </View>
        </View>

        {/* Trip Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Details</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <IconSymbol size={18} name="calendar" color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(ride.departureTime)}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <IconSymbol size={18} name="clock.fill" color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Departure Time</Text>
                <Text style={styles.detailValue}>{formatTime(ride.departureTime)}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <IconSymbol size={18} name="person.2.fill" color={COLORS.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Available Seats</Text>
                <Text style={styles.detailValue}>{ride.availableSeats} seats</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Driver Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driver</Text>
          
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverInitial}>
                {ride.driverName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ride.driverName}</Text>
              {ride.carMake && ride.carModel && (
                <Text style={styles.carInfo}>
                  {ride.carYear} {ride.carMake} {ride.carModel}
                  {ride.carColor && ` • ${ride.carColor}`}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Seats Selection Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Number of Seats</Text>
          
          <View style={styles.seatSelector}>
            <TouchableOpacity
              style={[styles.seatButton, numberOfSeats <= 1 && styles.seatButtonDisabled]}
              onPress={handleDecrementSeats}
              disabled={numberOfSeats <= 1}
            >
              <IconSymbol name="minus" size={20} color={numberOfSeats <= 1 ? COLORS.textTertiary : COLORS.textPrimary} />
            </TouchableOpacity>
            
            <Text style={styles.seatCount}>{numberOfSeats}</Text>
            
            <TouchableOpacity
              style={[styles.seatButton, numberOfSeats >= ride.availableSeats && styles.seatButtonDisabled]}
              onPress={handleIncrementSeats}
              disabled={numberOfSeats >= ride.availableSeats}
            >
              <IconSymbol name="plus" size={20} color={numberOfSeats >= ride.availableSeats ? COLORS.textTertiary : COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Confirm Button - Fixed at bottom */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>Continue to Payment</Text>
          <IconSymbol size={20} name="arrow.right" color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  placeholder: {
    width: 40,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.base,
  },
  errorText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  backButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  mapContainer: {
    height: 240,
    backgroundColor: COLORS.background,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginTop: SPACING.base,
    marginBottom: SPACING.base,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  markerStart: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerEnd: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.textPrimary,
  },
  markerDotEnd: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    borderWidth: 3,
    borderColor: COLORS.textPrimary,
  },
  card: {
    ...CARDS.default,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginBottom: SPACING.base,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
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
    marginTop: 6,
    backgroundColor: COLORS.primary,
  },
  routeDotDest: {
    backgroundColor: COLORS.error,
  },
  routeContent: {
    flex: 1,
    minWidth: 0,
  },
  routeLabel: {
    ...TYPOGRAPHY.badge,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs / 2,
  },
  routeAddress: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  routeSeparator: {
    width: 2,
    height: 12,
    backgroundColor: COLORS.border,
    marginLeft: 3,
    marginVertical: SPACING.sm,
  },
  detailRow: {
    marginBottom: SPACING.base,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...TYPOGRAPHY.badge,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs / 2,
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitial: {
    ...TYPOGRAPHY.h3,
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  driverInfo: {
    flex: 1,
    minWidth: 0,
  },
  driverName: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs / 2,
  },
  carInfo: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
  },
  seatButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  seatButtonDisabled: {
    opacity: 0.5,
  },
  seatCount: {
    ...TYPOGRAPHY.h2,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  confirmButton: {
    ...BUTTONS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 52,
  },
  confirmButtonText: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});

