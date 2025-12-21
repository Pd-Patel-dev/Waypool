import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { updateBooking, type RiderBooking, type UpdateBookingRequest } from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import AddressAutocomplete, { type AddressDetails } from '@/components/AddressAutocomplete';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    // expo-location not available
  }
}

export default function EditBookingScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [booking, setBooking] = useState<RiderBooking | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [pickupDetails, setPickupDetails] = useState<AddressDetails | null>(null);
  const [numberOfSeats, setNumberOfSeats] = useState<number>(1);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (params.booking) {
      try {
        const bookingData = JSON.parse(params.booking as string);
        setBooking(bookingData);
        setPickupAddress(bookingData.pickupAddress || '');
        setNumberOfSeats(bookingData.numberOfSeats || 1);
        
        // Set pickup details from existing booking
        if (bookingData.pickupLatitude && bookingData.pickupLongitude) {
          setPickupDetails({
            fullAddress: bookingData.pickupAddress,
            city: bookingData.pickupCity || undefined,
            state: bookingData.pickupState || undefined,
            zipCode: bookingData.pickupZipCode || undefined,
            latitude: bookingData.pickupLatitude,
            longitude: bookingData.pickupLongitude,
          });
        }
      } catch (error) {
        console.error('Error parsing booking data:', error);
        Alert.alert('Error', 'Invalid booking data');
        router.back();
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.booking]);

  // Get current location for address autocomplete
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
              // Silently fail
            }
          }
        } catch (error) {
          // Silently fail
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectPickup = (addressDetails: AddressDetails) => {
    setPickupDetails(addressDetails);
  };

  const handleIncrementSeats = () => {
    if (booking && numberOfSeats < booking.ride.distance) {
      // Check available seats from the ride
      const maxSeats = (booking.ride as any).availableSeats + numberOfSeats || 10;
      if (numberOfSeats < maxSeats) {
        setNumberOfSeats(numberOfSeats + 1);
      }
    }
  };

  const handleDecrementSeats = () => {
    if (numberOfSeats > 1) {
      setNumberOfSeats(numberOfSeats - 1);
    }
  };

  const handleSave = async () => {
    if (!booking || !user?.id) {
      Alert.alert('Error', 'Missing booking information');
      return;
    }

    // Validate pickup location if changed
    if (pickupAddress && !pickupDetails) {
      Alert.alert('Error', 'Please select a valid pickup location from the suggestions');
      return;
    }

    setIsSaving(true);
    try {
      const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      
      const updateData: UpdateBookingRequest = {};
      
      // Only include fields that changed
      if (pickupDetails) {
        updateData.pickupAddress = pickupDetails.fullAddress;
        updateData.pickupCity = pickupDetails.city || null;
        updateData.pickupState = pickupDetails.state || null;
        updateData.pickupZipCode = pickupDetails.zipCode || null;
        updateData.pickupLatitude = pickupDetails.latitude;
        updateData.pickupLongitude = pickupDetails.longitude;
      }
      
      if (numberOfSeats !== booking.numberOfSeats) {
        updateData.numberOfSeats = numberOfSeats;
      }

      // Check if there are any changes
      if (Object.keys(updateData).length === 0) {
        Alert.alert('No Changes', 'No changes were made to the booking.');
        setIsSaving(false);
        return;
      }

      const response = await updateBooking(booking.id, riderId, updateData);

      if (response.success) {
        Alert.alert(
          'Booking Updated!',
          'Your booking has been updated successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.back();
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update booking. Please try again.');
    } finally {
      setIsSaving(false);
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

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Invalid booking data</Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.routeContainer}>
            <View style={styles.routeItem}>
              <View style={styles.routeDot} />
              <Text style={styles.routeText} numberOfLines={2}>
                {booking.ride.fromAddress}
              </Text>
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotDest]} />
              <Text style={styles.routeText} numberOfLines={2}>
                {booking.ride.toAddress}
              </Text>
            </View>
          </View>
        </View>

        {/* Pickup Location */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup Location</Text>
          <Text style={styles.sectionSubtitle}>Update your pickup address</Text>
          <AddressAutocomplete
            value={pickupAddress}
            onChangeText={setPickupAddress}
            onSelectAddress={handleSelectPickup}
            placeholder="Enter your pickup address"
            currentLocation={currentLocation}
          />
        </View>

        {/* Number of Seats */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Number of Seats</Text>
          <Text style={styles.sectionSubtitle}>Update the number of seats</Text>
          <View style={styles.seatSelector}>
            <TouchableOpacity
              style={[styles.seatButton, numberOfSeats <= 1 && styles.seatButtonDisabled]}
              onPress={handleDecrementSeats}
              disabled={numberOfSeats <= 1}
            >
              <IconSymbol name="minus" size={20} color={numberOfSeats <= 1 ? '#666666' : '#FFFFFF'} />
            </TouchableOpacity>
            <Text style={styles.seatCount}>{numberOfSeats}</Text>
            <TouchableOpacity
              style={styles.seatButton}
              onPress={handleIncrementSeats}
            >
              <IconSymbol name="plus" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
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
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FF3B30',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    marginBottom: 16,
  },
  routeContainer: {
    gap: 12,
    marginTop: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    backgroundColor: '#4285F4',
  },
  routeDotDest: {
    backgroundColor: '#FF3B30',
  },
  routeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#2A2A2C',
    marginLeft: 4,
    borderRadius: 1,
  },
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 8,
  },
  seatButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatButtonDisabled: {
    backgroundColor: '#2A2A2C',
    opacity: 0.5,
  },
  seatCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 60,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

