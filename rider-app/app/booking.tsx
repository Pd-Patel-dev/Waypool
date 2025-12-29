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
  Animated,
  PanResponder,
  Dimensions,
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
import { logger } from '@/utils/logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MIN_HEIGHT = 250; // Increased from 120 to show more content
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.85;

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
  departureTime: string;
  availableSeats: number;
  driverName?: string;
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  carColor?: string | null;
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
  const [numberOfSeats, setNumberOfSeats] = useState(1);
  const mapRef = useRef<MapView>(null);
  
  // Bottom Sheet Animation
  const bottomSheetY = useRef(new Animated.Value(SCREEN_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        bottomSheetY.setOffset((bottomSheetY as any)._value);
        bottomSheetY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const currentY = (bottomSheetY as any)._offset + (bottomSheetY as any)._value;
        const newY = currentY + gestureState.dy;
        const minY = SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT;
        const maxY = SCREEN_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
        
        if (newY >= minY && newY <= maxY) {
          bottomSheetY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        bottomSheetY.flattenOffset();
        const currentY = (bottomSheetY as any)._value;
        const velocity = gestureState.vy;
        
        let targetY = SCREEN_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
        const expanded = isExpanded;
        
        if (velocity < -0.5 || (!expanded && currentY < SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT * 0.7)) {
          targetY = SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT;
          setIsExpanded(true);
        } else if (velocity > 0.5 || (expanded && currentY > SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT * 0.3)) {
          targetY = SCREEN_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
          setIsExpanded(false);
        } else {
          targetY = expanded ? SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT : SCREEN_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
        }
        
        Animated.spring(bottomSheetY, {
          toValue: targetY,
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }).start();
      },
    })
  ).current;
  
  useEffect(() => {
    Animated.spring(bottomSheetY, {
      toValue: SCREEN_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  }, []);

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
      // Only load if user is logged in
      if (!user?.id) {
        setIsLoadingSavedAddresses(false);
        return;
      }
      
      setIsLoadingSavedAddresses(true);
      try {
        const response = await getSavedAddresses();
        if (response.success) {
          setSavedAddresses(response.addresses);
        }
      } catch (error: any) {
        // Silently fail - saved addresses are optional for booking flow
        // Don't log 401 errors (authentication issues) as they're expected if user isn't fully authenticated
        // Only log other errors that might indicate a real problem
        if (error.status && error.status !== 401) {
          logger.warn('Failed to load saved addresses', error.message || 'Unknown error', 'booking');
        }
        // For 401 errors, just silently fail - user can still book without saved addresses
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
    
    // Navigate directly to booking confirmation/payment screen
    router.push({
      pathname: '/booking-confirm',
      params: {
        ride: JSON.stringify(ride),
        pickupDetails: JSON.stringify(pickupDetails),
        numberOfSeats: numberOfSeats.toString(),
        totalDistance: totalDistance?.toString() || '0',
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
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const handleBottomSheetPress = () => {
    // Expand bottom sheet when tapped if not already expanded
    if (!isExpanded) {
      setIsExpanded(true);
      Animated.spring(bottomSheetY, {
        toValue: SCREEN_HEIGHT - BOTTOM_SHEET_MAX_HEIGHT,
        useNativeDriver: false,
        tension: 50,
        friction: 8,
      }).start();
    }
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
      
      {/* Full Screen Map */}
      <View style={styles.fullMapContainer}>
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
          
          {/* Header Overlay */}
          <View style={styles.headerOverlay}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <IconSymbol size={24} name="chevron.left" color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Book Your Seat</Text>
            <View style={styles.placeholder} />
          </View>
          
          {/* Map Info Badge */}
          {totalDistance !== null && pickupDetails && (
            <View style={styles.mapInfoBadge}>
              <IconSymbol name="mappin.circle.fill" size={14} color={COLORS.primary} />
              <Text style={styles.mapInfoText}>{totalDistance.toFixed(1)} miles</Text>
            </View>
          )}
        </View>

        {/* Swipeable Bottom Sheet */}
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              top: bottomSheetY,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Drag Handle - Tap to Expand */}
          <TouchableOpacity
            style={styles.dragHandle}
            onPress={handleBottomSheetPress}
            activeOpacity={0.7}
          >
            <View style={styles.dragHandleBar} />
          </TouchableOpacity>
          
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            {/* Tap overlay when collapsed - allows tapping anywhere to expand */}
            {!isExpanded && (
              <TouchableOpacity
                style={styles.expandTapOverlay}
                onPress={handleBottomSheetPress}
                activeOpacity={1}
              />
            )}
            
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={isExpanded}
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

            {/* Action Button - Fixed at Bottom */}
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
                <Text style={styles.confirmButtonText}>Continue to Payment</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
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
  // Full Screen Map
  fullMapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Header Overlay
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.base,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    height: BOTTOM_SHEET_MAX_HEIGHT,
    ...SHADOWS.xl,
    zIndex: 20,
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  expandTapOverlay: {
    position: 'absolute',
    top: 50, // Below drag handle
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  mapInfoBadge: {
    position: 'absolute',
    bottom: BOTTOM_SHEET_MIN_HEIGHT + SPACING.base,
    left: RESPONSIVE_SPACING.padding,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 15,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
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
  // Preview Step Styles
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
  // Departure Card (Matching Ride Details)
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
  // Driver Card (Matching Ride Details)
  driverCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginBottom: SPACING.base,
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
  // Seats Card
  seatsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: RESPONSIVE_SPACING.margin,
    marginBottom: SPACING.lg,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  seatsCardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
  },
  seatsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingVertical: SPACING.base,
  },
  seatsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  seatsButtonDisabled: {
    opacity: 0.4,
    borderColor: COLORS.border,
  },
  seatsCountContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  seatsCount: {
    ...TYPOGRAPHY.h2,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    lineHeight: 38,
  },
  seatsLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -4,
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
  // Booking Bar (Matching Ride Details)
  bookingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: SPACING.base,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  priceText: {
    ...TYPOGRAPHY.h2,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  priceLabel: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
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

