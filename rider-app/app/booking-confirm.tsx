import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { bookRide, type Ride } from '@/services/api';

interface AddressDetails {
  fullAddress: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  zipCode?: string;
}

export default function BookingConfirmScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [ride, setRide] = useState<Ride | null>(null);
  const [pickupDetails, setPickupDetails] = useState<AddressDetails | null>(null);
  const [numberOfSeats, setNumberOfSeats] = useState<number>(1);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const hasParsedParams = useRef(false);

  useEffect(() => {
    // Prevent infinite re-renders by using a ref guard
    if (hasParsedParams.current) return;

    if (params.ride && params.pickupDetails) {
      try {
        const rideData = JSON.parse(params.ride as string);
        const pickupData = JSON.parse(params.pickupDetails as string);
        const distance = params.totalDistance ? parseFloat(params.totalDistance as string) : 0;

        setRide(rideData);
        setPickupDetails(pickupData);
        setTotalDistance(distance);
        hasParsedParams.current = true;
      } catch (error) {
        console.error('Error parsing params:', error);
        Alert.alert('Error', 'Invalid booking data');
        router.back();
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.ride, params.pickupDetails, params.totalDistance]);

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
      return 'Invalid date';
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
      return 'Invalid time';
    }
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

  const handleConfirmBooking = async () => {
    if (!ride || !pickupDetails || !user?.id) {
      Alert.alert('Error', 'Missing booking information');
      return;
    }

    if (numberOfSeats > ride.availableSeats) {
      Alert.alert('Error', `Only ${ride.availableSeats} seat${ride.availableSeats !== 1 ? 's' : ''} available`);
      return;
    }

    setIsBooking(true);
    try {
      const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const response = await bookRide({
        rideId: ride.id,
        riderId: riderId,
        pickupAddress: pickupDetails.fullAddress,
        pickupCity: pickupDetails.city || null,
        pickupState: pickupDetails.state || null,
        pickupZipCode: pickupDetails.zipCode || null,
        pickupLatitude: pickupDetails.latitude,
        pickupLongitude: pickupDetails.longitude,
        numberOfSeats: numberOfSeats,
      });

      if (response.success) {
        Alert.alert(
          'Booking Confirmed!',
          `Your booking has been confirmed. Confirmation number: ${response.booking.confirmationNumber}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to home or your rides
                router.replace('/(tabs)');
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to confirm booking. Please try again.');
    } finally {
      setIsBooking(false);
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

  if (!ride || !pickupDetails) {
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

  const pricePerSeat = ride.price || 0;
  const subtotal = pricePerSeat * numberOfSeats;
  const total = subtotal; // No tax applied

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Ride Overview Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ride Overview</Text>
          
          {/* Route */}
          <View style={styles.routeSection}>
            <View style={styles.routeItem}>
              <View style={styles.routeDot} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>From</Text>
                <Text style={styles.routeAddress}>{ride.fromAddress}</Text>
                <Text style={styles.routeCity}>{ride.fromCity}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>To</Text>
                <Text style={styles.routeAddress}>{ride.toAddress}</Text>
                <Text style={styles.routeCity}>{ride.toCity}</Text>
              </View>
            </View>
          </View>

          {/* Pickup Location */}
          <View style={styles.pickupSection}>
            <IconSymbol name="mappin" size={16} color="#4285F4" />
            <View style={styles.pickupContent}>
              <Text style={styles.pickupLabel}>Your Pickup</Text>
              <Text style={styles.pickupAddress}>{pickupDetails.fullAddress}</Text>
            </View>
          </View>

          {/* Trip Details */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={16} color="#999999" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(ride.departureTime)}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="clock" size={16} color="#999999" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{formatTime(ride.departureTime)}</Text>
              </View>
            </View>
            {totalDistance > 0 && (
              <View style={styles.detailRow}>
                <IconSymbol name="mappin" size={16} color="#999999" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Distance</Text>
                  <Text style={styles.detailValue}>{totalDistance.toFixed(1)} mi</Text>
                </View>
              </View>
            )}
          </View>

          {/* Driver Info */}
          <View style={styles.driverSection}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
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

        {/* Seat Selection Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Number of Seats</Text>
          <View style={styles.seatSelector}>
            <TouchableOpacity
              style={[styles.seatButton, numberOfSeats <= 1 && styles.seatButtonDisabled]}
              onPress={handleDecrementSeats}
              disabled={numberOfSeats <= 1}
              activeOpacity={0.7}
            >
              <IconSymbol name="minus" size={20} color={numberOfSeats <= 1 ? '#666666' : '#FFFFFF'} />
            </TouchableOpacity>
            <View style={styles.seatCountContainer}>
              <Text style={styles.seatCount}>{numberOfSeats}</Text>
              <Text style={styles.seatLabel}>
                {numberOfSeats === 1 ? 'Seat' : 'Seats'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.seatButton,
                numberOfSeats >= ride.availableSeats && styles.seatButtonDisabled,
              ]}
              onPress={handleIncrementSeats}
              disabled={numberOfSeats >= ride.availableSeats}
              activeOpacity={0.7}
            >
              <IconSymbol
                name="plus"
                size={20}
                color={numberOfSeats >= ride.availableSeats ? '#666666' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.availableSeatsText}>
            {ride.availableSeats} seat{ride.availableSeats !== 1 ? 's' : ''} available
          </Text>
        </View>

        {/* Pricing Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>
              ${pricePerSeat.toFixed(2)} × {numberOfSeats} seat{numberOfSeats !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.pricingValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingRow}>
            <Text style={styles.pricingTotalLabel}>Total</Text>
            <Text style={styles.pricingTotalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, isBooking && styles.confirmButtonDisabled]}
          onPress={handleConfirmBooking}
          disabled={isBooking}
          activeOpacity={0.8}
        >
          {isBooking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Booking</Text>
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
  },
  errorText: {
    fontSize: 16,
    color: '#999999',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  routeSection: {
    marginBottom: 16,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    marginTop: 4,
    marginRight: 12,
  },
  routeDotEnd: {
    backgroundColor: '#FF3B30',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#2A2A2C',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  routeCity: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
  pickupSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
    gap: 12,
  },
  pickupContent: {
    flex: 1,
  },
  pickupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  pickupAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  detailsGrid: {
    gap: 12,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  carInfo: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
  },
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  seatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatButtonDisabled: {
    backgroundColor: '#2A2A2C',
    opacity: 0.5,
  },
  seatCountContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  seatCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seatLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999999',
    marginTop: 4,
  },
  availableSeatsText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
    textAlign: 'center',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pricingLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#2A2A2C',
    marginBottom: 12,
  },
  pricingTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pricingTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  confirmButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
    marginTop: 12,
  },
});
