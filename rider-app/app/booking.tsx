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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import AddressAutocomplete, { type AddressDetails } from '@/components/AddressAutocomplete';
import { getSavedAddresses, type SavedAddress } from '@/services/api';
import { useUser } from '@/context/UserContext';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, BUTTONS, SHADOWS, RESPONSIVE_SPACING, CARDS } from '@/constants/designSystem';

// Conditionally import Location only on native platforms
let Location: LocationService | null = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    logger.warn('expo-location not available', e, 'booking');
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
  const { user } = useUser();
  const [ride, setRide] = useState<Ride | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [pickupDetails, setPickupDetails] = useState<AddressDetails | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [totalDistance, setTotalDistance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isLoadingSavedAddresses, setIsLoadingSavedAddresses] = useState(false);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<SavedAddress | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Parse ride data from params
    if (params.ride) {
      try {
        const rideData = JSON.parse(params.ride as string);
        setRide(rideData);
      } catch (error) {
        logger.error('Error parsing ride data', error, 'booking');
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.ride]);

  // Load saved addresses
  useEffect(() => {
    const loadSavedAddresses = async () => {
      if (!user?.id) return;
      setIsLoadingSavedAddresses(true);
      try {
        const response = await getSavedAddresses();
        if (response.success) {
          setSavedAddresses(response.addresses);
        }
      } catch (error: any) {
        logger.error('Error loading saved addresses', error, 'booking');
        // Silently fail - saved addresses are optional for booking flow
        // Only log 401 errors, don't show alert to avoid interrupting booking
        if (error.status !== 401) {
          logger.warn('Failed to load saved addresses', error.message, 'booking');
        }
      } finally {
        setIsLoadingSavedAddresses(false);
      }
    };
    loadSavedAddresses();
  }, [user]);

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
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      
      if (!apiKey) {
        logger.warn('Google Places API key not configured. Route calculation will be limited.', undefined, 'booking');
        // Fallback: Use simple straight-line distance if API key is missing
        setRouteCoordinates([
          { latitude: pickupDetails.latitude, longitude: pickupDetails.longitude },
          { latitude: ride.toLatitude, longitude: ride.toLongitude },
        ]);
        return;
      }
      
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
          data.routes[0].legs.forEach((leg) => {
            if (leg.steps) {
              leg.steps.forEach((step) => {
                const points = step.polyline.points;
                const decoded = decodePolyline(points);
                allCoordinates.push(...decoded);
              });
            }
          });
        }
        
        // Sum up distance from all legs
        data.routes[0].legs.forEach((leg) => {
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
      logger.error('Error fetching route', error, 'booking');
    }
  };

  const handleSelectPickup = (addressDetails: AddressDetails) => {
    setPickupDetails(addressDetails);
  };

  const handleSelectSavedAddress = (savedAddress: SavedAddress) => {
    const addressDetails: AddressDetails = {
      fullAddress: savedAddress.address,
      placeId: '', // Not needed for saved addresses
      city: savedAddress.city || '',
      state: savedAddress.state || '',
      zipCode: savedAddress.zipCode || '',
      latitude: savedAddress.latitude,
      longitude: savedAddress.longitude,
    };
    setSelectedSavedAddress(savedAddress);
    setPickupAddress(savedAddress.address);
    setPickupDetails(addressDetails);
    setShowAddressDropdown(false);
  };

  const handleClearSavedAddress = () => {
    setSelectedSavedAddress(null);
    setPickupAddress('');
    setPickupDetails(null);
  };

  const getLabelIcon = (label: string): string => {
    if (label === 'home') return 'house.fill';
    if (label === 'work') return 'briefcase.fill';
    return 'mappin.circle.fill';
  };

  const getLabelDisplay = (label: string): string => {
    if (label === 'home') return 'Home';
    if (label === 'work') return 'Work';
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const handleContinue = () => {
    if (!pickupDetails || !ride) return;
    
    // Navigate to ride preview screen first
    router.push({
      pathname: '/ride-preview',
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
          {/* Map Overlay Info */}
          {totalDistance !== null && pickupDetails && (
            <View style={styles.mapInfoBadge}>
              <IconSymbol name="mappin.circle.fill" size={14} color={COLORS.primary} />
              <Text style={styles.mapInfoText}>{totalDistance.toFixed(1)} miles</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Section: Pickup Location */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pickup Location</Text>
              
              {/* Saved Addresses Dropdown */}
              {savedAddresses.length > 0 && (
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowAddressDropdown(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownContent}>
                    {selectedSavedAddress ? (
                      <>
                        <View style={styles.dropdownIconContainer}>
                          <IconSymbol
                            size={20}
                            name={getLabelIcon(selectedSavedAddress.label)}
                            color={COLORS.primary}
                          />
                        </View>
                        <View style={styles.dropdownTextContainer}>
                          <Text style={styles.dropdownLabel}>
                            {getLabelDisplay(selectedSavedAddress.label)}
                          </Text>
                          <Text style={styles.dropdownAddress} numberOfLines={1}>
                            {selectedSavedAddress.address}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleClearSavedAddress();
                          }}
                          style={styles.clearIconButton}
                        >
                          <IconSymbol name="xmark.circle.fill" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <View style={styles.dropdownIconContainer}>
                          <IconSymbol name="mappin" size={20} color={COLORS.textSecondary} />
                        </View>
                        <Text style={styles.dropdownPlaceholder}>Select saved address</Text>
                      </>
                    )}
                    <IconSymbol name="chevron.down" size={16} color={COLORS.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}
              
              {/* Address Input */}
              <View style={styles.addressInputWrapper}>
                <Text style={styles.inputLabel}>
                  {savedAddresses.length > 0 ? 'Or enter address' : 'Enter pickup address'}
                </Text>
            <AddressAutocomplete
              value={pickupAddress}
                  onChangeText={(text) => {
                    setPickupAddress(text);
                    if (selectedSavedAddress) {
                      setSelectedSavedAddress(null);
                    }
                  }}
                  onSelectAddress={(details) => {
                    handleSelectPickup(details);
                    setSelectedSavedAddress(null);
                  }}
                  placeholder="Search for an address"
              currentLocation={currentLocation}
            />
              </View>
            </View>

            {/* Route Preview */}
            {pickupDetails && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Route Preview</Text>
                <View style={styles.routeCard}>
                {/* Stop 1: Original Pickup */}
                  <View style={styles.routeStopRow}>
                    <View style={styles.routeStopBadge}>
                      <Text style={styles.routeStopBadgeText}>1</Text>
                  </View>
                    <View style={styles.routeStopInfo}>
                      <Text style={styles.routeStopLabel}>Original Pickup</Text>
                      <Text style={styles.routeStopAddress} numberOfLines={2}>
                        {ride.fromAddress}
                      </Text>
                  </View>
                </View>

                {/* Stop 2: Your Pickup */}
                  <View style={styles.routeStopDivider} />
                  <View style={styles.routeStopRow}>
                    <View style={[styles.routeStopBadge, styles.routeStopBadgeGreen]}>
                      <Text style={styles.routeStopBadgeText}>2</Text>
                  </View>
                    <View style={styles.routeStopInfo}>
                      <Text style={styles.routeStopLabel}>Your Pickup</Text>
                      <Text style={styles.routeStopAddress} numberOfLines={2}>
                        {pickupDetails.fullAddress}
                      </Text>
                  </View>
                </View>

                {/* Stop 3: Destination */}
                  <View style={styles.routeStopDivider} />
                  <View style={styles.routeStopRow}>
                    <View style={[styles.routeStopBadge, styles.routeStopBadgeRed]}>
                      <Text style={styles.routeStopBadgeText}>3</Text>
                    </View>
                    <View style={styles.routeStopInfo}>
                      <Text style={styles.routeStopLabel}>Destination</Text>
                      <Text style={styles.routeStopAddress} numberOfLines={2}>
                        {ride.toAddress}
                      </Text>
                  </View>
                  </View>
                </View>
              </View>
            )}

            {/* Saved Addresses Dropdown Modal */}
            <Modal
              visible={showAddressDropdown}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowAddressDropdown(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowAddressDropdown(false)}
              >
                <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Saved Addresses</Text>
                    <TouchableOpacity
                      onPress={() => setShowAddressDropdown(false)}
                      style={styles.modalCloseButton}
                    >
                      <IconSymbol name="xmark" size={20} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                    {savedAddresses.map((savedAddr) => {
                      const isSelected = selectedSavedAddress?.id === savedAddr.id;
                      return (
                        <TouchableOpacity
                          key={savedAddr.id}
                          style={[
                            styles.modalOption,
                            isSelected && styles.modalOptionSelected,
                          ]}
                          onPress={() => handleSelectSavedAddress(savedAddr)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.modalOptionContent}>
                            <View style={[
                              styles.modalOptionIconContainer,
                              isSelected && styles.modalOptionIconContainerSelected
                            ]}>
                              <IconSymbol
                                size={18}
                                name={getLabelIcon(savedAddr.label)}
                                color={isSelected ? COLORS.primary : COLORS.textSecondary}
                              />
                            </View>
                            <View style={styles.modalOptionInfo}>
                              <Text style={[
                                styles.modalOptionLabel,
                                isSelected && styles.modalOptionLabelSelected
                              ]}>
                                {getLabelDisplay(savedAddr.label)}
                              </Text>
                              <Text style={styles.modalOptionAddress} numberOfLines={2}>
                                {savedAddr.address}
                              </Text>
                            </View>
                          </View>
                          {isSelected && (
                            <IconSymbol name="checkmark.circle.fill" size={22} color={COLORS.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
          </ScrollView>

          {/* Continue Button - Fixed at Bottom */}
          <View style={styles.buttonContainer}>
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
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.base,
    backgroundColor: COLORS.background,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    color: COLORS.textPrimary,
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
  mapContainer: {
    height: 280,
    backgroundColor: COLORS.background,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginTop: SPACING.base,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapInfoBadge: {
    position: 'absolute',
    bottom: SPACING.base,
    left: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapInfoText: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  simpleMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.textPrimary,
    ...SHADOWS.lg,
  },
  simpleMarkerGreen: {
    backgroundColor: COLORS.success,
  },
  simpleMarkerBlack: {
    backgroundColor: COLORS.error,
  },
  simpleMarkerText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingBottom: 100,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
  },
  dropdownButton: {
    ...CARDS.default,
    marginBottom: SPACING.base,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dropdownIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  dropdownLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  dropdownAddress: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  dropdownPlaceholder: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textTertiary,
    flex: 1,
  },
  clearIconButton: {
    padding: SPACING.xs,
    marginRight: -SPACING.xs,
  },
  addressInputWrapper: {
    gap: SPACING.sm,
  },
  inputLabel: {
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  routeCard: {
    ...CARDS.default,
    gap: 0,
  },
  routeStopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.base,
  },
  routeStopBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  routeStopBadgeGreen: {
    backgroundColor: COLORS.success,
  },
  routeStopBadgeRed: {
    backgroundColor: COLORS.error,
  },
  routeStopBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  routeStopInfo: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  routeStopLabel: {
    ...TYPOGRAPHY.badge,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  routeStopAddress: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  routeStopDivider: {
    width: 2,
    height: 16,
    backgroundColor: COLORS.border,
    marginLeft: 15,
    marginVertical: SPACING.sm,
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
    ...SHADOWS.lg,
  },
  confirmButton: {
    width: '100%',
    ...BUTTONS.primary,
    minHeight: 56,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.surfaceElevated,
    opacity: 0.5,
  },
  confirmButtonText: {
    ...TYPOGRAPHY.body,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlayDark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '75%',
    paddingBottom: SPACING.xl,
    ...SHADOWS.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base * 1.25,
    paddingVertical: SPACING.base * 1.25,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: COLORS.surfaceElevated,
  },
  modalScrollView: {
    paddingTop: SPACING.sm,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base * 1.25,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionSelected: {
    backgroundColor: COLORS.primaryTint,
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.base,
  },
  modalOptionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptionIconContainerSelected: {
    backgroundColor: COLORS.primaryTint,
  },
  modalOptionInfo: {
    flex: 1,
    minWidth: 0,
  },
  modalOptionLabel: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  modalOptionLabelSelected: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  modalOptionAddress: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

