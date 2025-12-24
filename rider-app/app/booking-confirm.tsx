import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { bookRide, type Ride, getPaymentMethods, type PaymentMethod, type BookingRequest } from '@/services/api';
import { useStripe } from '@stripe/stripe-react-native';
import { calculateRiderTotal } from '@/utils/fees';
import { handleErrorSilently, handleErrorWithAlert } from '@/utils/errorHandler';
import RouteInfoCard from '@/components/booking/RouteInfoCard';
import SeatSelector from '@/components/booking/SeatSelector';
import PricingBreakdown from '@/components/booking/PricingBreakdown';
import PaymentMethodSelector, { type PaymentOption } from '@/components/booking/PaymentMethodSelector';
import PaymentMethodModal from '@/components/booking/PaymentMethodModal';

interface AddressDetails {
  fullAddress: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  zipCode?: string;
}

type PaymentOption = {
  id: string;
  type: 'saved' | 'addNew' | 'applePay' | 'googlePay';
  label: string;
  description?: string;
  paymentMethodId?: string;
};

export default function BookingConfirmScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const { isApplePaySupported, isGooglePaySupported } = useStripe();
  const [ride, setRide] = useState<Ride | null>(null);
  const [pickupDetails, setPickupDetails] = useState<AddressDetails | null>(null);
  const [numberOfSeats, setNumberOfSeats] = useState<number>(1);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [showCardDropdown, setShowCardDropdown] = useState(false);
  const hasParsedParams = useRef(false);

  useEffect(() => {
    // Prevent infinite re-renders by using a ref guard
    if (hasParsedParams.current) return;

    if (params.ride && params.pickupDetails) {
      try {
        const rideData = JSON.parse(params.ride as string);
        const pickupData = JSON.parse(params.pickupDetails as string);
        const distance = params.totalDistance ? parseFloat(params.totalDistance as string) : 0;
        const seats = params.numberOfSeats ? parseInt(params.numberOfSeats as string, 10) : 1;

        setRide(rideData);
        setPickupDetails(pickupData);
        setTotalDistance(distance);
        setNumberOfSeats(seats);
        hasParsedParams.current = true;
      } catch (error) {
        handleErrorWithAlert(error, {
          context: 'parseBookingParams',
          title: 'Error',
          onError: () => router.back(),
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.ride, params.pickupDetails, params.totalDistance]);

    // Load payment methods when user is available
  const loadPaymentMethods = useCallback(async () => {
      if (!user?.id) return;
      
      setIsLoadingPaymentMethods(true);
      try {
        const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        const response = await getPaymentMethods(riderId);
        
        if (response.success && response.paymentMethods) {
          setPaymentMethods(response.paymentMethods);
          // Auto-select default payment method if available
          const defaultMethod = response.paymentMethods.find(pm => pm.isDefault);
          if (defaultMethod) {
            const brand = defaultMethod.brand || defaultMethod.card?.brand || 'Card';
            const last4 = defaultMethod.last4 || defaultMethod.card?.last4 || '0000';
            setSelectedPaymentOption({
              id: defaultMethod.id,
              type: 'saved',
              label: `${brand.toUpperCase()} •••• ${last4}`,
              paymentMethodId: defaultMethod.id,
            });
          }
        }
      } catch (error) {
      // Silently handle payment method loading errors - continue without payment methods
      handleErrorSilently(error, 'loadPaymentMethods');
      } finally {
        setIsLoadingPaymentMethods(false);
      }
  }, [user?.id]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  // Reload payment methods when screen comes into focus (e.g., after adding a card)
  const reloadPaymentMethods = useCallback(async () => {
      if (!user?.id) return;

        try {
          const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
          const response = await getPaymentMethods(riderId);
          if (response.success && response.paymentMethods) {
            setPaymentMethods(response.paymentMethods);
            // Auto-select default if no selection and default exists
        setSelectedPaymentOption(prev => {
          if (prev) return prev; // Don't override existing selection
          
              const defaultMethod = response.paymentMethods.find(pm => pm.isDefault);
              if (defaultMethod) {
                const brand = defaultMethod.brand || defaultMethod.card?.brand || 'Card';
                const last4 = defaultMethod.last4 || defaultMethod.card?.last4 || '0000';
            return {
                  id: defaultMethod.id,
                  type: 'saved',
                  label: `${brand.toUpperCase()} •••• ${last4}`,
                  paymentMethodId: defaultMethod.id,
            };
          }
          return null;
                });
          }
        } catch (error) {
      // Silently handle payment method reload errors
      handleErrorSilently(error, 'reloadPaymentMethods');
        }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      reloadPaymentMethods();
    }, [reloadPaymentMethods])
  );

  // Memoize date formatting functions
  const formatDate = useCallback((dateString: string): string => {
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
  }, []);

  const formatTime = useCallback((dateString: string): string => {
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
  }, []);

  // Memoize seat handlers to prevent re-renders
  const handleIncrementSeats = useCallback(() => {
    if (ride && numberOfSeats < ride.availableSeats) {
      setNumberOfSeats(prev => prev + 1);
    }
  }, [ride, numberOfSeats]);

  const handleDecrementSeats = useCallback(() => {
    if (numberOfSeats > 1) {
      setNumberOfSeats(prev => prev - 1);
    }
  }, [numberOfSeats]);

  const handlePaymentOptionSelect = useCallback((option: PaymentOption) => {
    if (option.type === 'addNew') {
      // Navigate to add-card screen to add new payment method
      router.push('/add-card');
    } else if (option.type === 'applePay' || option.type === 'googlePay') {
      // Navigate to payment screen for wallet payments
      if (ride && pickupDetails) {
        // Calculate total on the fly to avoid dependency on memoized value
        const pricePerSeat = ride.price || 0;
        const subtotal = pricePerSeat * numberOfSeats;
        const riderTotal = calculateRiderTotal(subtotal);
        const totalAmount = riderTotal.total;
        
      router.push({
        pathname: '/payment',
        params: {
          ride: JSON.stringify(ride),
          pickupDetails: JSON.stringify(pickupDetails),
          numberOfSeats: numberOfSeats.toString(),
            totalAmount: totalAmount.toFixed(2),
          paymentMethodType: option.type,
        },
      });
      }
    } else {
      setSelectedPaymentOption(option);
    }
  }, [ride, pickupDetails, numberOfSeats]);

  const handleConfirmBooking = useCallback(async () => {
    if (!ride || !pickupDetails || !user?.id) {
      Alert.alert('Error', 'Missing booking information');
      return;
    }

    if (numberOfSeats > ride.availableSeats) {
      Alert.alert('Error', `Only ${ride.availableSeats} seat${ride.availableSeats !== 1 ? 's' : ''} available`);
      return;
    }

    // Navigate to add payment method if no payment method selected
    if (!selectedPaymentOption) {
      Alert.alert('Payment Required', 'Please select a payment method to continue.', [
        { text: 'OK' },
      ]);
      return;
    }

    // If selected option requires payment setup (Apple Pay, Google Pay)
    if (selectedPaymentOption.type === 'applePay' || selectedPaymentOption.type === 'googlePay') {
      router.push({
        pathname: '/payment',
        params: {
          ride: JSON.stringify(ride),
          pickupDetails: JSON.stringify(pickupDetails),
          numberOfSeats: numberOfSeats.toString(),
          totalAmount: total.toFixed(2),
          paymentMethodType: selectedPaymentOption.type,
        },
      });
      return;
    }

    setIsBooking(true);
    try {
      const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      
      // Prepare booking data with payment method if selected
      const bookingData: BookingRequest & { paymentMethodId?: string } = {
        rideId: ride.id,
        riderId: riderId,
        pickupAddress: pickupDetails.fullAddress,
        pickupCity: pickupDetails.city || null,
        pickupState: pickupDetails.state || null,
        pickupZipCode: pickupDetails.zipCode || null,
        pickupLatitude: pickupDetails.latitude,
        pickupLongitude: pickupDetails.longitude,
        numberOfSeats: numberOfSeats,
      };

      // Add payment method ID if a saved payment method is selected
      if (selectedPaymentOption?.type === 'saved' && selectedPaymentOption.paymentMethodId) {
        bookingData.paymentMethodId = selectedPaymentOption.paymentMethodId;
      }

      const response = await bookRide(bookingData);

      if (response.success) {
        Alert.alert(
          'Booking Confirmed!',
          `Your booking has been confirmed and payment has been authorized. Confirmation number: ${response.booking.confirmationNumber}\n\nPayment will be charged when the ride is completed.`,
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
    } catch (error) {
      handleErrorWithAlert(error, {
        context: 'confirmBooking',
        title: 'Booking Error',
      });
    } finally {
      setIsBooking(false);
    }
  }, [ride, pickupDetails, numberOfSeats, selectedPaymentOption, user?.id, total]);

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

  // Memoize price calculations to prevent unnecessary recalculations
  const priceCalculations = useMemo(() => {
    if (!ride) return { pricePerSeat: 0, subtotal: 0, riderTotal: null, total: 0 };

  const pricePerSeat = ride.price || 0;
  const subtotal = pricePerSeat * numberOfSeats;
    const riderTotal = calculateRiderTotal(subtotal);
    const total = riderTotal.total;
    
    return { pricePerSeat, subtotal, riderTotal, total };
  }, [ride, numberOfSeats]);

  const { pricePerSeat, subtotal, riderTotal, total } = priceCalculations;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Route Info */}
        <View style={styles.card}>
          <View style={styles.routeRow}>
              <View style={styles.routeDot} />
            <View style={styles.routeText}>
              <Text style={styles.routeFrom}>{ride.fromCity}</Text>
              <Text style={styles.routeTo}>{ride.toCity}</Text>
            </View>
          </View>

          <View style={styles.divider} />
          
          {/* Compact Details */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <IconSymbol name="calendar" size={14} color="#999999" />
              <Text style={styles.detailText}>{formatDate(ride.departureTime)}</Text>
            </View>
            <View style={styles.detailItem}>
              <IconSymbol name="clock" size={14} color="#999999" />
              <Text style={styles.detailText}>{formatTime(ride.departureTime)}</Text>
            </View>
          </View>

          <View style={styles.pickupRow}>
            <IconSymbol name="mappin" size={14} color="#4285F4" />
            <Text style={styles.pickupText} numberOfLines={1}>{pickupDetails.fullAddress}</Text>
          </View>
        </View>

        {/* Compact Seat & Price */}
        <View style={styles.card}>
          <View style={styles.seatPriceRow}>
            <View style={styles.seatSection}>
              <Text style={styles.sectionLabel}>Seats</Text>
          <View style={styles.seatSelector}>
            <TouchableOpacity
              style={[styles.seatButton, numberOfSeats <= 1 && styles.seatButtonDisabled]}
              onPress={handleDecrementSeats}
              disabled={numberOfSeats <= 1}
            >
                  <IconSymbol name="minus" size={16} color={numberOfSeats <= 1 ? '#666666' : '#FFFFFF'} />
            </TouchableOpacity>
              <Text style={styles.seatCount}>{numberOfSeats}</Text>
            <TouchableOpacity
                  style={[styles.seatButton, numberOfSeats >= ride.availableSeats && styles.seatButtonDisabled]}
              onPress={handleIncrementSeats}
              disabled={numberOfSeats >= ride.availableSeats}
            >
                  <IconSymbol name="plus" size={16} color={numberOfSeats >= ride.availableSeats ? '#666666' : '#FFFFFF'} />
            </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.priceSection}>
              <Text style={styles.sectionLabel}>Total</Text>
              <Text style={styles.totalPrice}>${total.toFixed(2)}</Text>
          </View>
        </View>

          {/* Pricing Breakdown */}
          <View style={styles.pricingBreakdown}>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Subtotal</Text>
              <Text style={styles.pricingValue}>${riderTotal.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Processing Fee</Text>
              <Text style={styles.pricingValue}>${riderTotal.processingFee.toFixed(2)}</Text>
                    </View>
            <View style={styles.pricingRow}>
              <Text style={styles.pricingLabel}>Platform Fee</Text>
              <Text style={styles.pricingValue}>${riderTotal.commission.toFixed(2)}</Text>
                  </View>
            <View style={styles.pricingDivider} />
            <View style={styles.pricingRow}>
              <Text style={styles.pricingTotalLabel}>Total</Text>
              <Text style={styles.pricingTotalValue}>${riderTotal.total.toFixed(2)}</Text>
                </View>
          </View>
        </View>

        <PaymentMethodSelector
          paymentMethods={paymentMethods}
          selectedPaymentOption={selectedPaymentOption}
          isLoading={isLoadingPaymentMethods}
          isApplePaySupported={isApplePaySupported}
          isGooglePaySupported={isGooglePaySupported}
          onSelect={handlePaymentOptionSelect}
          onShowDropdown={() => setShowCardDropdown(true)}
        />

        <PaymentMethodModal
          visible={showCardDropdown}
          paymentMethods={paymentMethods}
          selectedPaymentOption={selectedPaymentOption}
          isApplePaySupported={isApplePaySupported}
          onSelect={handlePaymentOptionSelect}
          onClose={() => setShowCardDropdown(false)}
        />
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
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
    marginRight: 10,
  },
  routeText: {
    flex: 1,
  },
  routeFrom: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  routeTo: {
    fontSize: 13,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2C',
    marginVertical: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickupText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
    flex: 1,
  },
  seatPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seatSection: {
    flex: 1,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  seatSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seatButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatButtonDisabled: {
    backgroundColor: '#2A2A2C',
    opacity: 0.5,
  },
  seatCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 24,
    textAlign: 'center',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  confirmButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#4285F4',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
    marginTop: 12,
  },
  paymentMethodLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dropdownButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    backgroundColor: '#141416',
    marginTop: 8,
    marginBottom: 8,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dropdownSubText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#CCCCCC',
    marginTop: 2,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    backgroundColor: '#141416',
    marginTop: 8,
  },
  paymentMethodOptionSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#1A1F3A',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  paymentMethodTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  paymentMethodName: {
    fontSize: 11,
    fontWeight: '400',
    color: '#666666',
    marginTop: 2,
  },
  googlePayIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googlePayIconSelected: {
    backgroundColor: '#FFFFFF',
  },
  googlePayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4285F4',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  modalCardOptionSelected: {
    backgroundColor: '#1A1F3A',
  },
  modalCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  modalCardTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalCardName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
    marginTop: 4,
  },
  modalCardOptionDisabled: {
    opacity: 0.5,
  },
  modalCardTextDisabled: {
    color: '#666666',
  },
  pricingBreakdown: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
  },
  pricingValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#2A2A2C',
    marginVertical: 8,
  },
  pricingTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pricingTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
