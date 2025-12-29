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
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getRideById } from '@/services/api';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, BUTTONS, RESPONSIVE_SPACING } from '@/constants/designSystem';

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
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      
      if (!apiKey) {
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
        const decoded = decodePolyline(points);
        setRouteCoordinates(decoded);

        setTimeout(() => {
          if (mapRef.current && decoded.length > 0) {
            mapRef.current.fitToCoordinates(decoded, {
              edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
              animated: true,
            });
          }
        }, 500);
      } else {
        setRouteCoordinates([
          { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
          { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
        ]);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setRouteCoordinates([
        { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
        { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
      ]);
    }
  }, [decodePolyline]);

  useEffect(() => {
    if (params.ride && !hasFetchedRoute.current) {
      try {
        const rideData = JSON.parse(params.ride as string);
        setRide(rideData);
        hasFetchedRoute.current = true;
        fetchRoute(rideData);
        
        // Fetch full ride details to get vehicle information
        if (rideData.id) {
          getRideById(rideData.id)
            .then((response) => {
              if (response.success && response.ride) {
                setRide(response.ride);
              }
            })
            .catch((error) => {
              // Silently fail - we already have basic ride data
              console.error('Error fetching full ride details:', error);
            });
        }
      } catch (error) {
        console.error('Error parsing ride data:', error);
      } finally {
        setIsLoading(false);
      }
    } else if (!params.ride) {
      setIsLoading(false);
    }
  }, [params.ride, fetchRoute]);

  useFocusEffect(
    useCallback(() => {
      const refreshRideData = async () => {
        if (ride?.id) {
          try {
            const response = await getRideById(ride.id);
            if (response.success && response.ride) {
              setRide(response.ride);
            }
          } catch (error: any) {
            if (error.status !== 401) {
              console.error('Error refreshing ride data:', error);
            }
          }
        }
      };
      refreshRideData();
    }, [ride?.id])
  );

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
    } catch {
      return '';
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <IconSymbol size={48} name="exclamationmark.triangle" color={COLORS.textTertiary} />
          <Text style={styles.errorText}>Ride not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleBookSeat = () => {
    router.push({
      pathname: '/booking',
      params: {
        ride: JSON.stringify(ride),
      },
    });
  };

  const price = ride.pricePerSeat || ride.price || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol size={22} name="chevron.left" color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Map Section */}
        {ride && (
          <View style={styles.mapContainer}>
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
              loadingBackgroundColor={COLORS.background}
              loadingIndicatorColor={COLORS.primary}
              onMapReady={() => {
                if (mapRef.current && routeCoordinates.length > 0) {
                  setTimeout(() => {
                    mapRef.current?.fitToCoordinates(routeCoordinates, {
                      edgePadding: { top: 30, right: 30, bottom: 30, left: 30 },
                      animated: true,
                    });
                  }, 300);
                } else if (mapRef.current) {
                  setTimeout(() => {
                    mapRef.current?.fitToCoordinates(
                      [
                        { latitude: ride.fromLatitude, longitude: ride.fromLongitude },
                        { latitude: ride.toLatitude, longitude: ride.toLongitude },
                      ],
                      {
                        edgePadding: { top: 30, right: 30, bottom: 30, left: 30 },
                        animated: true,
                      }
                    );
                  }, 300);
                }
              }}
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
                    { latitude: ride.fromLatitude, longitude: ride.fromLongitude },
                    { latitude: ride.toLatitude, longitude: ride.toLongitude },
                  ]}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                  lineDashPattern={[8, 4]}
                />
              )}
              
              {/* Start Marker */}
              <Marker 
                coordinate={{
                  latitude: ride.fromLatitude,
                  longitude: ride.fromLongitude,
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
            
            {/* Distance Badge */}
            {ride.distance && (
              <View style={styles.distanceBadge}>
                <IconSymbol size={14} name="mappin.circle.fill" color={COLORS.primary} />
                <Text style={styles.distanceText}>{ride.distance.toFixed(1)} mi</Text>
              </View>
            )}
          </View>
        )}

        {/* Departure Card */}
        <View style={styles.departureCard}>
          <Text style={styles.departureCardTitle}>Departure</Text>
          
          {/* Pick up */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>Pick up</Text>
            <View style={styles.detailRowValue}>
              <IconSymbol size={16} name="mappin.circle.fill" color={COLORS.primary} />
              <Text style={styles.detailRowText} numberOfLines={1}>{ride.fromAddress}</Text>
            </View>
          </View>
          
          {/* Drop off */}
          <View style={styles.detailRow}>
            <Text style={styles.detailRowLabel}>Drop off</Text>
            <View style={styles.detailRowValue}>
              <IconSymbol size={16} name="mappin.circle.fill" color={COLORS.error} />
              <Text style={styles.detailRowText} numberOfLines={1}>{ride.toAddress}</Text>
            </View>
          </View>
          
          {/* Date */}
          <View style={styles.detailRow}>
            <View style={styles.detailRowLabelContainer}>
              <IconSymbol size={16} name="calendar" color={COLORS.textSecondary} />
              <Text style={styles.detailRowLabel}>Date</Text>
            </View>
            <Text style={styles.detailRowText}>{formatDate(ride.departureTime)}</Text>
          </View>
          
          {/* Depart */}
          <View style={styles.detailRow}>
            <View style={styles.detailRowLabelContainer}>
              <IconSymbol size={16} name="clock.fill" color={COLORS.textSecondary} />
              <Text style={styles.detailRowLabel}>Depart</Text>
            </View>
            <Text style={styles.detailRowText}>{formatTime(ride.departureTime)}</Text>
          </View>
          
          {/* Seats available */}
          <View style={[styles.detailRow, styles.detailRowLast]}>
            <View style={styles.detailRowLabelContainer}>
              <IconSymbol size={16} name="person.2.fill" color={COLORS.textSecondary} />
              <Text style={styles.detailRowLabel}>Seats available</Text>
            </View>
            <Text style={styles.detailRowText}>{ride.availableSeats}</Text>
          </View>
        </View>

        {/* Driver and Vehicle Details Card */}
        {ride.driverName && (
          <View style={styles.driverCard}>
            <Text style={styles.driverCardTitle}>Driver and Vehicle details</Text>
            <View style={styles.driverCardContent}>
              <View style={styles.driverCardAvatar}>
                <Text style={styles.driverCardInitial}>
                  {ride.driverName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.driverCardInfo}>
                <Text style={styles.driverCardName}>{ride.driverName}</Text>
                {(() => {
                  // Check both ride and driver object for vehicle info
                  const carMake = ride.carMake || (ride.driver as any)?.carMake;
                  const carModel = ride.carModel || (ride.driver as any)?.carModel;
                  const carYear = ride.carYear || (ride.driver as any)?.carYear;
                  const carColor = ride.carColor || (ride.driver as any)?.carColor;
                  
                  if (carMake || carModel || carYear) {
                    const parts = [];
                    if (carYear) parts.push(carYear.toString());
                    if (carMake) parts.push(carMake);
                    if (carModel) parts.push(carModel);
                    const vehicleText = parts.join(' ');
                    return (
                      <Text style={styles.driverCardVehicle}>
                        {vehicleText}
                        {carColor && ` • ${carColor}`}
                      </Text>
                    );
                  }
                  return (
                    <Text style={styles.driverCardVehiclePlaceholder}>
                      Vehicle information not available
                    </Text>
                  );
                })()}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Booking Bar - Fixed at bottom */}
      <View style={styles.bookingBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>${price.toFixed(2)}/Passenger</Text>
        </View>
        <TouchableOpacity
          style={styles.bookNowButton}
          onPress={handleBookSeat}
          activeOpacity={0.8}
        >
          <Text style={styles.bookNowButtonText}>Book Now</Text>
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
  // Header
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
  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.base,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.background,
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
  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // Map
  mapContainer: {
    height: 280,
    backgroundColor: COLORS.background,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginTop: SPACING.base,
    marginBottom: SPACING.lg,
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
  distanceBadge: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  distanceText: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  // Departure Card
  departureCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginBottom: SPACING.base,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  departureCardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailRowLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  detailRowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  detailRowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailRowText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'right',
    flex: 1,
  },
  // Driver Card
  driverCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginBottom: SPACING.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverCardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
  },
  driverCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
  },
  driverCardAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverCardInitial: {
    ...TYPOGRAPHY.h2,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  driverCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  driverCardName: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs / 2,
  },
  driverCardVehicle: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  driverCardVehiclePlaceholder: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },
  // Booking Bar
  bookingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.base,
  },
  priceContainer: {
    flex: 1,
  },
  priceText: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bookNowButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookNowButtonText: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
