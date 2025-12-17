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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Get current location
  useEffect(() => {
    (async () => {
      if (Location && Platform.OS !== 'web') {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
          }
        } catch (error) {
          console.warn('Could not get location:', error);
        }
      }
    })();
  }, []);

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
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
    justifyContent: 'space-between',
    marginBottom: 8,
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
