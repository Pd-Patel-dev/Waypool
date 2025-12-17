import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
import MapView from 'react-native-maps';
import { createRide, type ApiError } from '@/services/api';
import { useUser } from '@/context/UserContext';

// Import new components
import { RouteMap, DateTimeSelector, RideDetailsForm } from '@/components/add-ride';

// Conditionally import Location
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
  const mapRef = useRef<MapView>(null);

  // Form state
  const [fromAddress, setFromAddress] = useState('');
  const [fromCity, setFromCity] = useState('');
  const [fromState, setFromState] = useState('');
  const [fromZipCode, setFromZipCode] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [toCity, setToCity] = useState('');
  const [toState, setToState] = useState('');
  const [toZipCode, setToZipCode] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [availableSeats, setAvailableSeats] = useState('');
  const [pricePerSeat, setPricePerSeat] = useState('');

  // Coordinates
  const [fromCoords, setFromCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [distance, setDistance] = useState<number | null>(null);

  // UI state
  const [isFromInputActive, setIsFromInputActive] = useState(false);
  const [isToInputActive, setIsToInputActive] = useState(false);
  
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

  // Fetch actual route from Google Directions API
  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
      if (!GOOGLE_API_KEY) {
        console.warn('Google Maps API key not configured, using straight line');
        return [origin, destination];
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        let allPoints: { latitude: number; longitude: number }[] = [];

        // Extract all points from route steps
        if (route.legs && route.legs.length > 0) {
          route.legs.forEach((leg: any) => {
            if (leg.steps) {
              leg.steps.forEach((step: any) => {
                if (step.polyline && step.polyline.points) {
                  const stepPoints = decodePolyline(step.polyline.points);
                  allPoints = allPoints.concat(stepPoints);
                }
              });
            }
          });
        }

        // If we couldn't get detailed steps, use overview polyline
        if (allPoints.length === 0 && route.overview_polyline && route.overview_polyline.points) {
          allPoints = decodePolyline(route.overview_polyline.points);
        }

        return allPoints.length > 0 ? allPoints : [origin, destination];
      } else {
        console.warn('Directions API error:', data.status);
        return [origin, destination];
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      return [origin, destination];
    }
  };

  // Calculate route when both addresses are selected
  useEffect(() => {
    if (fromCoords && toCoords) {
      // Fetch actual route from Google Directions API
      fetchRoute(fromCoords, toCoords).then((routePoints) => {
        setRouteCoordinates(routePoints);
      });

      // Calculate distance (simple Haversine)
      const R = 3959; // Earth radius in miles
      const dLat = ((toCoords.latitude - fromCoords.latitude) * Math.PI) / 180;
      const dLon = ((toCoords.longitude - fromCoords.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((fromCoords.latitude * Math.PI) / 180) *
          Math.cos((toCoords.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;
      setDistance(dist);

      // Fit map to coordinates
      if (mapRef.current) {
        mapRef.current.fitToCoordinates([fromCoords, toCoords], {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  }, [fromCoords, toCoords]);

  const handleSelectFromAddress = (addressDetails: any) => {
    setFromAddress(addressDetails.fullAddress);
    setFromCity(addressDetails.city);
    setFromState(addressDetails.state);
    setFromZipCode(addressDetails.zipCode);

    if (addressDetails.latitude && addressDetails.longitude) {
      setFromCoords({
        latitude: addressDetails.latitude,
        longitude: addressDetails.longitude,
      });
    }

    if (errors.fromAddress) {
      setErrors({ ...errors, fromAddress: undefined, fromCity: undefined });
    }
    setIsFromInputActive(false);
  };

  const handleSelectToAddress = (addressDetails: any) => {
    setToAddress(addressDetails.fullAddress);
    setToCity(addressDetails.city);
    setToState(addressDetails.state);
    setToZipCode(addressDetails.zipCode);

    if (addressDetails.latitude && addressDetails.longitude) {
      setToCoords({
        latitude: addressDetails.latitude,
        longitude: addressDetails.longitude,
      });
    }

    if (errors.toAddress) {
      setErrors({ ...errors, toAddress: undefined, toCity: undefined });
    }
    setIsToInputActive(false);
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!fromAddress.trim()) newErrors.fromAddress = 'From address is required';
    if (!fromCity.trim()) newErrors.fromCity = 'From city is required';
    if (!toAddress.trim()) newErrors.toAddress = 'To address is required';
    if (!toCity.trim()) newErrors.toCity = 'To city is required';
    if (!departureDate) newErrors.departureDate = 'Departure date is required';
    if (!departureTime) newErrors.departureTime = 'Departure time is required';
    if (!availableSeats) {
      newErrors.availableSeats = 'Number of seats is required';
    } else if (parseInt(availableSeats) < 1 || parseInt(availableSeats) > 8) {
      newErrors.availableSeats = 'Seats must be between 1 and 8';
    }
    if (!pricePerSeat) {
      newErrors.pricePerSeat = 'Price per seat is required';
    } else if (parseFloat(pricePerSeat) <= 0) {
      newErrors.pricePerSeat = 'Price must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields correctly.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to create a ride.');
      return;
    }

    const driverId = typeof user.id === 'string' ? parseInt(user.id) : user.id;

    setIsSubmitting(true);

    try {
      const rideData = {
        driverId,
        driverName: user.fullName || 'Driver',
        driverPhone: user.phoneNumber || '',
        fromAddress,
        fromCity,
        fromState,
        fromZipCode,
        toAddress,
        toCity,
        toState,
        toZipCode,
        fromLatitude: fromCoords?.latitude || 0,
        fromLongitude: fromCoords?.longitude || 0,
        toLatitude: toCoords?.latitude || 0,
        toLongitude: toCoords?.longitude || 0,
        departureDate,
        departureTime,
        totalSeats: parseInt(availableSeats),
        availableSeats: parseInt(availableSeats),
        pricePerSeat: parseFloat(pricePerSeat),
        distance: distance || 0,
      };

      await createRide(rideData);

      Alert.alert(
        'Success',
        'Your ride has been created successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      const apiError = error as ApiError;
      Alert.alert(
        'Error',
        apiError.message || 'Failed to create ride. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const shouldShowMap = fromCoords && toCoords && !isFromInputActive && !isToInputActive;

  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.addressLabel}>From</Text>
              <View style={styles.addressInputContainer}>
                <AddressAutocomplete
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
              <Text style={styles.addressLabel}>To</Text>
              <View style={styles.addressInputContainer}>
                <AddressAutocomplete
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
            <Text style={styles.title}>Create New Ride</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Map Preview */}
          {shouldShowMap && (
            <View style={styles.mapContainer}>
              <RouteMap
                mapRef={mapRef}
                fromCoords={fromCoords}
                toCoords={toCoords}
                routeCoordinates={routeCoordinates}
                fromAddress={fromAddress}
                toAddress={toAddress}
              />
              {distance && (
                <View style={styles.distanceBadge}>
                  <IconSymbol size={16} name="arrow.left.arrow.right" color="#FFFFFF" />
                  <Text style={styles.distanceText}>{distance.toFixed(1)} mi</Text>
                </View>
              )}
            </View>
          )}

          {/* From Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>From</Text>
            <AddressAutocomplete
              placeholder="Enter pickup location"
              value={fromAddress}
              onChangeText={setFromAddress}
              onSelectAddress={handleSelectFromAddress}
              onFocusChange={setIsFromInputActive}
            />
            {errors.fromAddress && (
              <Text style={styles.errorText}>{errors.fromAddress}</Text>
            )}
          </View>

          {/* To Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>To</Text>
            <AddressAutocomplete
              placeholder="Enter destination"
              value={toAddress}
              onChangeText={setToAddress}
              onSelectAddress={handleSelectToAddress}
              onFocusChange={setIsToInputActive}
            />
            {errors.toAddress && (
              <Text style={styles.errorText}>{errors.toAddress}</Text>
            )}
          </View>

          {/* Date & Time */}
          <DateTimeSelector
            departureDate={departureDate}
            departureTime={departureTime}
            onDateChange={setDepartureDate}
            onTimeChange={setDepartureTime}
            errors={errors}
          />

          {/* Seats & Price */}
          <RideDetailsForm
            availableSeats={availableSeats}
            pricePerSeat={pricePerSeat}
            onSeatsChange={setAvailableSeats}
            onPriceChange={setPricePerSeat}
            errors={errors}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol size={20} name="plus.circle.fill" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Create Ride</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
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
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#333333',
      overflow: 'visible',
    },
    addressInputWrapperLast: {
      borderBottomWidth: 0,
    },
    addressLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: '#999999',
      width: 50,
      marginRight: 8,
    },
    addressInputContainer: {
      flex: 1,
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  distanceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: -4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
