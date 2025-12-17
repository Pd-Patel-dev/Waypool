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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  
  // Date and Time Picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Set initial date to today at midnight to allow selecting today and future dates
  const getTodayAtMidnight = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };
  
  const [selectedDate, setSelectedDate] = useState<Date>(getTodayAtMidnight());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  
  // Coordinates for mapping
  const [fromCoords, setFromCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [estimatedTimeMinutes, setEstimatedTimeMinutes] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  
  // New feature states
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringPattern, setRecurringPattern] = useState<'daily' | 'weekly' | 'monthly' | null>(null);
  const [recurringEndDate, setRecurringEndDate] = useState<string>('');
  const [showRecurringEndDatePicker, setShowRecurringEndDatePicker] = useState(false);
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

  // Fetch route from Google Directions API with traffic-aware estimates
  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
      if (!GOOGLE_API_KEY) {
        throw new Error('Google Maps API key is not configured');
      }
      // Use traffic_model=best_guess for accurate time estimates
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&traffic_model=best_guess&departure_time=now&key=${GOOGLE_API_KEY}`;

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

        // Get estimated time in minutes (use duration_in_traffic if available, otherwise duration)
        const durationInSeconds = route.legs[0].duration_in_traffic?.value || route.legs[0].duration.value;
        const durationInMinutes = Math.ceil(durationInSeconds / 60);
        setEstimatedTimeMinutes(durationInMinutes);
      } else {
        // Fallback to straight line
        setRouteCoordinates([origin, destination]);
        setEstimatedTimeMinutes(null);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback to straight line
      setRouteCoordinates([origin, destination]);
      setEstimatedTimeMinutes(null);
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
    } else {
      // Validate that the date is not in the past
      try {
        const [month, day, year] = departureDate.split('/').map(Number);
        const selectedDateObj = new Date(year, month - 1, day);
        const today = getTodayAtMidnight();
        
        if (selectedDateObj < today) {
          newErrors.departureDate = 'Departure date cannot be in the past';
        }
      } catch (error) {
        newErrors.departureDate = 'Invalid date format';
      }
    }

    if (!departureTime.trim()) {
      newErrors.departureTime = 'Departure time is required';
    } else if (departureDate.trim()) {
      // Validate that the date+time combination is not in the past
      try {
        const [month, day, year] = departureDate.split('/').map(Number);
        const timeMatch = departureTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const meridiem = timeMatch[3].toUpperCase();
          
          // Convert to 24-hour format
          if (meridiem === 'PM' && hours !== 12) hours += 12;
          if (meridiem === 'AM' && hours === 12) hours = 0;
          
          const selectedDateTime = new Date(year, month - 1, day, hours, minutes);
          const now = new Date();
          
          if (selectedDateTime < now) {
            newErrors.departureTime = 'Departure time cannot be in the past';
          }
        }
      } catch (error) {
        // Ignore validation errors if date/time parsing fails
      }
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
        estimatedTimeMinutes: estimatedTimeMinutes || undefined,
        isRecurring: isRecurring,
        recurringPattern: recurringPattern || undefined,
        recurringEndDate: recurringEndDate || undefined,
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
      
      // Handle duplicate ride error
      if (apiError.status === 409 || apiError.message?.includes('duplicate') || apiError.message?.includes('similar ride')) {
        Alert.alert(
          'Duplicate Ride Detected',
          apiError.message || 'A similar ride already exists for this route and time.',
          [
            {
              text: 'View Existing Ride',
              onPress: () => {
                // Navigate to existing ride if ID is provided
                if ((apiError as any).duplicateRideId) {
                  router.push(`/ride-details?id=${(apiError as any).duplicateRideId}`);
                }
              },
            },
            {
              text: 'Modify Time',
              style: 'cancel',
            },
          ]
        );
      } else {
      setErrors({
        general: apiError.message || 'Failed to create ride. Please try again.',
      });
      }
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
                  <TouchableOpacity
                    style={[styles.input, styles.pickerInput, errors.departureDate && styles.inputError]}
                    onPress={() => {
                      console.log('Date picker button pressed, showDatePicker:', showDatePicker);
                      setShowDatePicker(true);
                      console.log('After setting showDatePicker to true');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, !departureDate && styles.pickerPlaceholder]}>
                      {departureDate || 'MM/DD/YYYY'}
                    </Text>
                    <IconSymbol size={18} name="calendar" color="#666666" />
                  </TouchableOpacity>
                  {errors.departureDate && (
                    <Text style={styles.errorText}>{errors.departureDate}</Text>
                  )}
                  {Platform.OS === 'android' && showDatePicker && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        console.log('Android date picker onChange:', event.type, date);
                        setShowDatePicker(false);
                        if (date && event.type !== 'dismissed') {
                          setSelectedDate(date);
                          // Format as MM/DD/YYYY
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const year = date.getFullYear();
                          setDepartureDate(`${month}/${day}/${year}`);
                        }
                      }}
                      minimumDate={getTodayAtMidnight()}
                    />
                  )}
                </View>

                <View style={[styles.inputGroup, styles.inputHalf]}>
                  <Text style={styles.label}>Time</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.pickerInput, errors.departureTime && styles.inputError]}
                    onPress={() => {
                      console.log('Time picker button pressed');
                      setShowTimePicker(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerText, !departureTime && styles.pickerPlaceholder]}>
                      {departureTime || 'HH:MM AM/PM'}
                    </Text>
                    <IconSymbol size={18} name="clock" color="#666666" />
                  </TouchableOpacity>
                  {errors.departureTime && (
                    <Text style={styles.errorText}>{errors.departureTime}</Text>
                  )}
                  {Platform.OS === 'android' && showTimePicker && (
                    <DateTimePicker
                      value={selectedTime}
                      mode="time"
                      display="default"
                      is24Hour={false}
                      onChange={(event, time) => {
                        console.log('Android time picker onChange:', event.type, time);
                        setShowTimePicker(false);
                        if (time && event.type !== 'dismissed') {
                          setSelectedTime(time);
                          // Format as HH:MM AM/PM
                          let hours = time.getHours();
                          const minutes = time.getMinutes();
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          hours = hours % 12;
                          hours = hours ? hours : 12; // the hour '0' should be '12'
                          const minutesStr = String(minutes).padStart(2, '0');
                          setDepartureTime(`${hours}:${minutesStr} ${ampm}`);
                        }
                      }}
                    />
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

            {/* Estimated Distance & Time Display */}
            {(distance || estimatedTimeMinutes) && (
              <View style={styles.estimateCard}>
                <View style={styles.estimateRow}>
                  <IconSymbol size={20} name="map" color="#4285F4" />
                  <View style={styles.estimateContent}>
                    <Text style={styles.estimateLabel}>Route Estimate</Text>
                    <View style={styles.estimateDetails}>
                      {distance && (
                        <Text style={styles.estimateText}>
                          {distance.toFixed(1)} mi
                        </Text>
                      )}
                      {estimatedTimeMinutes && (
                        <Text style={styles.estimateText}>
                          {estimatedTimeMinutes} min
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Recurring Ride Option */}
            <View style={styles.recurringSection}>
              <TouchableOpacity
                style={styles.recurringToggle}
                onPress={() => setIsRecurring(!isRecurring)}
                activeOpacity={0.7}>
                <View style={[styles.checkbox, isRecurring && styles.checkboxChecked]}>
                  {isRecurring && <IconSymbol size={16} name="checkmark" color="#FFFFFF" />}
                </View>
                <Text style={styles.recurringLabel}>Make this a recurring ride</Text>
              </TouchableOpacity>

              {isRecurring && (
                <View style={styles.recurringOptions}>
                  <Text style={styles.recurringSubLabel}>Repeat</Text>
                  <View style={styles.recurringButtons}>
                    {(['daily', 'weekly', 'monthly'] as const).map((pattern) => (
                      <TouchableOpacity
                        key={pattern}
                        style={[
                          styles.recurringButton,
                          recurringPattern === pattern && styles.recurringButtonActive,
                        ]}
                        onPress={() => setRecurringPattern(pattern)}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.recurringButtonText,
                            recurringPattern === pattern && styles.recurringButtonTextActive,
                          ]}>
                          {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {recurringPattern && (
                    <View style={styles.recurringEndDateContainer}>
                      <Text style={styles.recurringSubLabel}>End Date (Optional)</Text>
                      <TouchableOpacity
                        style={styles.recurringEndDateInput}
                        onPress={() => setShowRecurringEndDatePicker(true)}
                        activeOpacity={0.7}>
                        <Text style={[styles.recurringEndDateText, !recurringEndDate && styles.placeholder]}>
                          {recurringEndDate || 'No end date'}
                        </Text>
                        <IconSymbol size={18} name="calendar" color="#666666" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Error Message */}
            {errors.general && (
              <View style={styles.generalError}>
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                onPress={async () => {
                  await handleSubmit();
                }}
                disabled={isLoading}
                activeOpacity={0.8}>
                {isLoading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <>
                    <IconSymbol size={18} name="checkmark.circle.fill" color="#000000" />
                  <Text style={styles.submitButtonText}>Create Ride</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            </View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}

      {/* Date Picker Modal - Outside ScrollView */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => {
            console.log('Date Modal onRequestClose');
            setShowDatePicker(false);
          }}
          presentationStyle="overFullScreen"
        >
          <TouchableOpacity
            style={styles.pickerModalContainer}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity
                  onPress={() => {
                    console.log('Date Cancel pressed');
                    setShowDatePicker(false);
                  }}
                  style={styles.pickerModalButton}
                >
                  <Text style={styles.pickerModalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerModalTitle}>Select Date</Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log('Date Done pressed');
                    setShowDatePicker(false);
                    // Ensure date is at midnight to allow any time selection
                    const dateAtMidnight = new Date(selectedDate);
                    dateAtMidnight.setHours(0, 0, 0, 0);
                    setSelectedDate(dateAtMidnight);
                    // Format as MM/DD/YYYY
                    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    const day = String(selectedDate.getDate()).padStart(2, '0');
                    const year = selectedDate.getFullYear();
                    setDepartureDate(`${month}/${day}/${year}`);
                  }}
                  style={styles.pickerModalButton}
                >
                  <Text style={[styles.pickerModalButtonText, styles.pickerModalButtonDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  console.log('Date changed:', date);
                  if (date) {
                    setSelectedDate(date);
                  }
                }}
                minimumDate={getTodayAtMidnight()}
                style={styles.pickerIOS}
                textColor="#FFFFFF"
                themeVariant="dark"
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Time Picker Modal - Outside ScrollView */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => {
            console.log('Time Modal onRequestClose');
            setShowTimePicker(false);
          }}
          presentationStyle="overFullScreen"
        >
          <TouchableOpacity
            style={styles.pickerModalContainer}
            activeOpacity={1}
            onPress={() => setShowTimePicker(false)}
          >
            <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity
                  onPress={() => {
                    console.log('Time Cancel pressed');
                    setShowTimePicker(false);
                  }}
                  style={styles.pickerModalButton}
                >
                  <Text style={styles.pickerModalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerModalTitle}>Select Time</Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log('Time Done pressed');
                    setShowTimePicker(false);
                    // Format as HH:MM AM/PM
                    let hours = selectedTime.getHours();
                    const minutes = selectedTime.getMinutes();
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    hours = hours % 12;
                    hours = hours ? hours : 12; // the hour '0' should be '12'
                    const minutesStr = String(minutes).padStart(2, '0');
                    setDepartureTime(`${hours}:${minutesStr} ${ampm}`);
                  }}
                  style={styles.pickerModalButton}
                >
                  <Text style={[styles.pickerModalButtonText, styles.pickerModalButtonDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={(event, time) => {
                  console.log('Time changed:', time);
                  if (time) {
                    setSelectedTime(time);
                  }
                }}
                style={styles.pickerIOS}
                textColor="#FFFFFF"
                themeVariant="dark"
              />
            </View>
          </TouchableOpacity>
        </Modal>
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
  pickerInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#666666',
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
  estimateCard: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  estimateContent: {
    flex: 1,
  },
  estimateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  estimateDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  estimateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recurringSection: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#666666',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  recurringLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recurringOptions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  recurringSubLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 12,
  },
  recurringButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  recurringButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  recurringButtonActive: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  recurringButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  recurringButtonTextActive: {
    color: '#FFFFFF',
  },
  recurringEndDateContainer: {
    marginTop: 12,
  },
  recurringEndDateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  recurringEndDateText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  placeholder: {
    color: '#666666',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMapContainer: {
    flex: 1,
    position: 'relative',
  },
  modalMap: {
    flex: 1,
  },
  modalRouteInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F0F0F',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalRouteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  modalRouteMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    marginTop: 4,
  },
  modalRouteMarkerDest: {
    backgroundColor: '#FF3B30',
  },
  modalRouteContent: {
    flex: 1,
  },
  modalRouteLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalRouteAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  modalRouteCity: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
  },
  modalRouteStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  modalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerModalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pickerModalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pickerModalButtonText: {
    fontSize: 16,
    color: '#999999',
    fontWeight: '500',
  },
  pickerModalButtonDone: {
    color: '#4285F4',
    fontWeight: '600',
  },
  pickerIOS: {
    height: 200,
    backgroundColor: '#1C1C1E',
  },
});

