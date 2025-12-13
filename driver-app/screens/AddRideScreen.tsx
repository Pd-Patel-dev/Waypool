import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { createRide, type ApiError } from '@/services/api';
import { useUser } from '@/context/UserContext';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
}

export default function AddRideScreen(): React.JSX.Element {
  const { user } = useUser();
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fromAddress, setFromAddress] = useState<string>('');
  const [fromState, setFromState] = useState<string>('');
  const [fromCity, setFromCity] = useState<string>('');
  const [fromZipCode, setFromZipCode] = useState<string>('');
  const [toAddress, setToAddress] = useState<string>('');
  const [toState, setToState] = useState<string>('');
  const [toCity, setToCity] = useState<string>('');
  const [toZipCode, setToZipCode] = useState<string>('');
  
  const [departureDate, setDepartureDate] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>('');
  const [availableSeats, setAvailableSeats] = useState<string>('');
  const [pricePerSeat, setPricePerSeat] = useState<string>('');
  
  // Coordinates for mapping
  const [fromCoords, setFromCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  
  const mapRef = React.useRef<MapView>(null);
  
  // Get current location for sorting suggestions by proximity
  useEffect(() => {
    (async () => {
      if (Location && Platform.OS !== 'web') {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        } catch (error) {
          console.warn('Could not get location for address sorting:', error);
        }
      }
    })();
  }, []);
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  
  // Track active input state for showing/hiding map
  const [isFromInputActive, setIsFromInputActive] = useState(false);
  const [isToInputActive, setIsToInputActive] = useState(false);
  
  // Reset input active states when coming back to step 1
  useEffect(() => {
    if (currentStep === 1) {
      setIsFromInputActive(false);
      setIsToInputActive(false);
    }
  }, [currentStep]);
  
  // Map should only show when both addresses selected and no input is active
  const shouldShowMap = fromCoords && toCoords && !isFromInputActive && !isToInputActive;
  
  const [errors, setErrors] = useState<{
    fromAddress?: string;
    toAddress?: string;
    fromCity?: string;
    toCity?: string;
    departureDate?: string;
    departureTime?: string;
    availableSeats?: string;
    pricePerSeat?: string;
    general?: string;
  }>({});

  const handleSelectFromAddress = (addressDetails: any) => {
    setFromAddress(addressDetails.fullAddress);
    setFromCity(addressDetails.city);
    setFromState(addressDetails.state);
    setFromZipCode(addressDetails.zipCode);
    
    // Set coordinates
    if (addressDetails.latitude && addressDetails.longitude) {
      setFromCoords({
        latitude: addressDetails.latitude,
        longitude: addressDetails.longitude,
      });
    }
    
    // Clear errors when address is selected
    if (errors.fromAddress) {
      setErrors({ ...errors, fromAddress: undefined, fromCity: undefined });
    }
  };

  // Reverse geocode current location to get address
  const handleUseCurrentLocation = async () => {
    if (!currentLocation) {
      Alert.alert('Location Unavailable', 'Please enable location services to use your current location.');
      return;
    }

    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
      if (!GOOGLE_API_KEY) {
        Alert.alert('Error', 'Google API key not configured');
        return;
      }

      // Reverse geocode to get address
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${currentLocation.latitude},${currentLocation.longitude}&key=${GOOGLE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const addressComponents = result.address_components || [];
        
        let city = '';
        let state = '';
        let zipCode = '';
        let streetNumber = '';
        let route = '';

        addressComponents.forEach((component: any) => {
          if (component.types.includes('street_number')) {
            streetNumber = component.long_name;
          } else if (component.types.includes('route')) {
            route = component.long_name;
          } else if (component.types.includes('locality')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.short_name;
          } else if (component.types.includes('postal_code')) {
            zipCode = component.long_name;
          }
        });

        const fullAddress = streetNumber && route 
          ? `${streetNumber} ${route}` 
          : result.formatted_address.split(',')[0];

        // Set the address details
        handleSelectFromAddress({
          fullAddress: fullAddress,
          city: city,
          state: state,
          zipCode: zipCode,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        });
      } else {
        Alert.alert('Error', 'Could not get address for current location');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      Alert.alert('Error', 'Failed to get address for current location');
    }
  };


  const handleSelectToAddress = (addressDetails: any) => {
    setToAddress(addressDetails.fullAddress);
    setToCity(addressDetails.city);
    setToState(addressDetails.state);
    setToZipCode(addressDetails.zipCode);
    
    // Set coordinates
    if (addressDetails.latitude && addressDetails.longitude) {
      setToCoords({
        latitude: addressDetails.latitude,
        longitude: addressDetails.longitude,
      });
    }
    
    // Clear errors when address is selected
    if (errors.toAddress) {
      setErrors({ ...errors, toAddress: undefined, toCity: undefined });
    }
  };

  // Decode Google polyline to coordinates
  const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
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

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  // Fetch route from Google Directions API
  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
      if (!GOOGLE_API_KEY) {
        throw new Error('Google Maps API key is not configured');
      }
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);

        // Get actual driving distance in miles
        const distanceInMeters = route.legs[0].distance.value;
        const distanceInMiles = distanceInMeters / 1609.34;
        setDistance(distanceInMiles);
      } else {
        // Fallback to straight line
        setRouteCoordinates([origin, destination]);
      }
    } catch (error) {
      // Fallback to straight line
      setRouteCoordinates([origin, destination]);
    }
  };

  // Update map when both addresses are selected
  useEffect(() => {
    if (fromCoords && toCoords) {
      // Fetch actual route
      fetchRoute(fromCoords, toCoords);

      // Fit map to show both markers
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates([fromCoords, toCoords], {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }, 500);
      }
    } else {
      setDistance(null);
      setRouteCoordinates([]);
    }
  }, [fromCoords, toCoords]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!fromAddress.trim()) {
      newErrors.fromAddress = 'Pickup address is required';
    }

    if (!fromCity) {
      newErrors.fromCity = 'Pickup city is required';
    }

    if (!toAddress.trim()) {
      newErrors.toAddress = 'Destination address is required';
    }

    if (!toCity) {
      newErrors.toCity = 'Destination city is required';
    }

    if (!departureDate.trim()) {
      newErrors.departureDate = 'Departure date is required';
    }

    if (!departureTime.trim()) {
      newErrors.departureTime = 'Departure time is required';
    }

    if (!availableSeats.trim()) {
      newErrors.availableSeats = 'Number of seats is required';
    } else if (parseInt(availableSeats) < 1 || parseInt(availableSeats) > 8) {
      newErrors.availableSeats = 'Seats must be between 1 and 8';
    }

    if (!pricePerSeat.trim()) {
      newErrors.pricePerSeat = 'Price per seat is required';
    } else if (parseFloat(pricePerSeat) < 0) {
      newErrors.pricePerSeat = 'Price must be positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    // Check if coordinates are available
    if (!fromCoords || !toCoords) {
      setErrors({
        general: 'Please select valid addresses with coordinates.',
      });
      return;
    }
    
    // Check if user is available
    if (!user) {
      setErrors({
        general: 'User session expired. Please login again.',
      });
      return;
    }
    
    setIsLoading(true);
    setErrors({});

    try {
      // Prepare ride data with driver information
      const rideData = {
        // Driver Information
        driverId: user.id,
        driverName: user.fullName,
        driverPhone: user.phoneNumber,
        carMake: user.carMake || undefined,
        carModel: user.carModel || undefined,
        carYear: user.carYear || undefined,
        carColor: user.carColor || undefined,
        // From Location
        fromAddress,
        fromCity,
        fromState,
        fromZipCode,
        fromLatitude: fromCoords.latitude,
        fromLongitude: fromCoords.longitude,
        // To Location
        toAddress,
        toCity,
        toState,
        toZipCode,
        toLatitude: toCoords.latitude,
        toLongitude: toCoords.longitude,
        // Ride Details
        departureDate,
        departureTime,
        availableSeats: parseInt(availableSeats),
        pricePerSeat: parseFloat(pricePerSeat),
        distance: distance || undefined,
      };

      // Call API to create ride
      const response = await createRide(rideData);

      if (response.success) {
        
        // Show success alert
        Alert.alert(
          '🎉 Ride Created!',
          `Your ride from ${fromCity} to ${toCity} has been successfully created.`,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      }
    } catch (error) {
      const apiError = error as ApiError;
      setErrors({
        general: apiError.message || 'Failed to create ride. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentStep === 2) {
              setCurrentStep(1);
            } else {
              router.back();
            }
          }}
          activeOpacity={0.7}>
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentStep === 1 ? 'Plan your ride' : 'Ride details'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Step 1: Address Selection */}
      {currentStep === 1 && (
        <View style={styles.step1Container}>
          {/* Address Input Section */}
          <View style={styles.addressContainer}>
            {/* From Address */}
            <View style={styles.addressInputWrapper}>
              <View style={styles.addressLabelRow}>
                <Text style={styles.addressLabel}>From</Text>
                {currentLocation && !fromAddress && (
                  <TouchableOpacity
                    style={styles.currentLocationIconButton}
                    onPress={handleUseCurrentLocation}
                    activeOpacity={0.7}>
                    <IconSymbol size={20} name="location.fill" color="#4285F4" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.addressInputContainer}>
                <AddressAutocomplete
                  key={`from-${currentStep}`}
                  value={fromAddress}
                  onChangeText={setFromAddress}
                  onSelectAddress={handleSelectFromAddress}
                  placeholder="Pickup location"
                  error={errors.fromAddress}
                  showPredictionsInline={true}
                  currentLocation={currentLocation}
                  onFocusChange={(focused) => {
                    // Mark as inactive when not focused (unless predictions are showing)
                    if (!focused) {
                      setIsFromInputActive(false);
                    }
                  }}
                  onPredictionsChange={(predictions) => {
                    // Update active state based on predictions
                    setIsFromInputActive(predictions && predictions.length > 0);
                  }}
                />
              </View>
            </View>

            {/* To Address */}
            <View style={[styles.addressInputWrapper, styles.addressInputWrapperLast]}>
              <View style={styles.addressLabelRow}>
                <Text style={styles.addressLabel}>To</Text>
              </View>
              <View style={styles.addressInputContainer}>
                <AddressAutocomplete
                  key={`to-${currentStep}`}
                  value={toAddress}
                  onChangeText={setToAddress}
                  onSelectAddress={handleSelectToAddress}
                  placeholder="Where to?"
                  error={errors.toAddress}
                  showPredictionsInline={true}
                  currentLocation={currentLocation}
                  onFocusChange={(focused) => {
                    // Mark as inactive when not focused (unless predictions are showing)
                    if (!focused) {
                      setIsToInputActive(false);
                    }
                  }}
                  onPredictionsChange={(predictions) => {
                    // Update active state based on predictions
                    setIsToInputActive(predictions && predictions.length > 0);
                  }}
                />
              </View>
            </View>
          </View>

          {/* Map Section - Only show when both addresses selected and no input active */}
          {shouldShowMap && (
          <View style={styles.mapSection}>
            <View style={styles.mapFullContainer}>
              <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                style={styles.mapPreview}
                region={{
                  latitude: (fromCoords.latitude + toCoords.latitude) / 2,
                  longitude: (fromCoords.longitude + toCoords.longitude) / 2,
                  latitudeDelta: Math.abs(fromCoords.latitude - toCoords.latitude) * 1.8,
                  longitudeDelta: Math.abs(fromCoords.longitude - toCoords.longitude) * 1.8,
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
                  setTimeout(() => {
                    if (mapRef.current) {
                      mapRef.current.fitToCoordinates([fromCoords, toCoords], {
                        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
                        animated: true,
                      });
                    }
                  }, 300);
                }}>
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
                    coordinates={[fromCoords, toCoords]}
                    strokeColor="#4285F4"
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                    lineDashPattern={[10, 5]}
                  />
                )}
                {/* Start marker - Small Car Icon */}
                <Marker 
                  coordinate={fromCoords}
                  title="Pickup"
                  description="Start location">
                  <View style={styles.markerContainer}>
                    <View style={styles.carMarker}>
                      <IconSymbol size={16} name="car" color="#FFFFFF" />
                    </View>
                  </View>
                </Marker>
                
                {/* Destination marker - Small Flag Icon */}
                <Marker 
                  coordinate={toCoords}
                  title="Destination"
                  description="Drop-off location">
                  <View style={styles.markerContainer}>
                    <View style={styles.destinationMarker}>
                      <IconSymbol size={14} name="flag" color="#FFFFFF" />
                    </View>
                    <View style={styles.markerPin} />
                  </View>
                </Marker>
              </MapView>
              
              {/* Distance Badge */}
              <View style={styles.distanceOverlay}>
                <Text style={styles.distanceText}>
                  {distance ? `${distance.toFixed(1)} mi` : 'Calculating...'}
                </Text>
              </View>
            </View>
          </View>
          )}
              
          {/* Next Button - Fixed at bottom */}
          <View style={styles.stepButtonContainer}>
            <TouchableOpacity
              style={[
                styles.nextButton,
                (!fromAddress || !toAddress || !fromCoords || !toCoords) &&
                  styles.nextButtonDisabled,
              ]}
              onPress={() => setCurrentStep(2)}
              disabled={!fromAddress || !toAddress || !fromCoords || !toCoords}
              activeOpacity={0.8}>
                <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 2: Ride Details */}
      {currentStep === 2 && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {/* Route Summary */}
            <View style={styles.routeSummaryContainer}>
                <View style={styles.routeSummaryRow}>
                  <View style={styles.routeIconCircle} />
                  <View style={styles.routeSummaryTextContainer}>
                    <Text style={styles.routeSummaryLabel}>From</Text>
                    <Text style={styles.routeSummaryText}>{fromAddress}</Text>
                    <Text style={styles.routeSummarySubtext}>
                      {fromCity}, {fromState} {fromZipCode}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.routeSummaryDivider} />
                
                <View style={styles.routeSummaryRow}>
                  <View style={styles.routeIconSquare} />
                  <View style={styles.routeSummaryTextContainer}>
                    <Text style={styles.routeSummaryLabel}>To</Text>
                    <Text style={styles.routeSummaryText}>{toAddress}</Text>
                    <Text style={styles.routeSummarySubtext}>
                      {toCity}, {toState} {toZipCode}
                    </Text>
                  </View>
                </View>
                
                {distance && (
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>
                      {distance.toFixed(1)} mi
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.form}>

            {/* Ride Details Section */}
            <View style={styles.rideDetailsSection}>
              <Text style={styles.sectionLabel}>Ride Details</Text>
                <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.inputHalf]}>
                  <Text style={styles.label}>Date</Text>
                  <TextInput
                    style={[styles.input, errors.departureDate && styles.inputError]}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#666666"
                    value={departureDate}
                    onChangeText={setDepartureDate}
                    keyboardType="numbers-and-punctuation"
                  />
                  {errors.departureDate && (
                    <Text style={styles.errorText}>{errors.departureDate}</Text>
                  )}
                </View>

                <View style={[styles.inputGroup, styles.inputHalf]}>
                  <Text style={styles.label}>Time</Text>
                  <TextInput
                    style={[styles.input, errors.departureTime && styles.inputError]}
                    placeholder="HH:MM AM/PM"
                    placeholderTextColor="#666666"
                    value={departureTime}
                    onChangeText={setDepartureTime}
                  />
                  {errors.departureTime && (
                    <Text style={styles.errorText}>{errors.departureTime}</Text>
                  )}
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.inputHalf]}>
                  <Text style={styles.label}>Available Seats</Text>
                  <TextInput
                    style={[styles.input, errors.availableSeats && styles.inputError]}
                    placeholder="1-8"
                    placeholderTextColor="#666666"
                    value={availableSeats}
                    onChangeText={setAvailableSeats}
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                  {errors.availableSeats && (
                    <Text style={styles.errorText}>{errors.availableSeats}</Text>
                  )}
                </View>

                <View style={[styles.inputGroup, styles.inputHalf]}>
                  <Text style={styles.label}>Price per Seat</Text>
                  <TextInput
                    style={[styles.input, errors.pricePerSeat && styles.inputError]}
                    placeholder="$0.00"
                    placeholderTextColor="#666666"
                    value={pricePerSeat}
                    onChangeText={setPricePerSeat}
                    keyboardType="decimal-pad"
                  />
                  {errors.pricePerSeat && (
                    <Text style={styles.errorText}>{errors.pricePerSeat}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Error Message */}
            {errors.general && (
              <View style={styles.generalError}>
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.8}>
                {isLoading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Ride</Text>
                )}
              </TouchableOpacity>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  step1Container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    zIndex: 10,
  },
    backButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#FFFFFF',
      letterSpacing: -0.3,
      flex: 1,
    },
    headerSpacer: {
      width: 36,
    },
    addressContainer: {
      backgroundColor: '#1E1E1E',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 12,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      overflow: 'visible',
      zIndex: 100,
      elevation: 5,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    mapSection: {
      flex: 1,
      marginHorizontal: 16,
      marginBottom: 90, // Space for Next button
      borderRadius: 12,
      overflow: 'hidden',
    },
    addressInputWrapper: {
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#333333',
      overflow: 'visible',
    },
    addressInputWrapperLast: {
      borderBottomWidth: 0,
    },
    addressLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    addressLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: '#999999',
    },
    currentLocationIconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(66, 133, 244, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  addressInputContainer: {
      width: '100%',
      overflow: 'visible',
    },
    mapFullContainer: {
      width: '100%',
      height: '100%',
      position: 'relative',
      backgroundColor: '#2A2A2A',
      borderRadius: 12,
      overflow: 'hidden',
    },
    mapPreview: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 12,
    },
    distanceOverlay: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4285F4',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    distanceText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
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
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 5,
    },
    destinationMarker: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#EA4335',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 5,
    },
    markerPin: {
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 10,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: '#EA4335',
      marginTop: -2,
    },
  form: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  rideDetailsSection: {
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
    stepButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingBottom: 20,
      backgroundColor: '#000000',
      borderTopWidth: 1,
      borderTopColor: '#1A1A1A',
      zIndex: 200,
      elevation: 10,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    nextButton: {
      backgroundColor: '#4285F4',
      borderRadius: 12,
      paddingVertical: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      shadowColor: '#4285F4',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    nextButtonDisabled: {
      backgroundColor: '#2A2A2A',
      shadowOpacity: 0,
    },
    nextButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  routeSummaryContainer: {
    backgroundColor: '#0F0F0F',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    position: 'relative',
  },
  routeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeIconCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    marginTop: 4,
  },
  routeIconSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#FF3B30',
    marginTop: 4,
  },
  routeSummaryTextContainer: {
    flex: 1,
  },
  routeSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeSummaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  routeSummarySubtext: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
  },
  routeSummaryDivider: {
    height: 1,
    backgroundColor: '#1A1A1A',
    marginVertical: 12,
  },
  distanceBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  distanceBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  inputThird: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 6,
    fontWeight: '500',
  },
  generalError: {
    backgroundColor: '#1A0000',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  generalErrorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#4285F4',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

