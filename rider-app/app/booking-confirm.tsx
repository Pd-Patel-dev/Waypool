import React, { useState, useEffect, useRef } from 'react';
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
import { bookRide, type Ride, getPaymentMethods, type PaymentMethod } from '@/services/api';
import { useStripe } from '@stripe/stripe-react-native';

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

  useEffect(() => {
    // Load payment methods when user is available
    const loadPaymentMethods = async () => {
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
        console.error('Error loading payment methods:', error);
        // Don't show error to user, just continue without payment methods
      } finally {
        setIsLoadingPaymentMethods(false);
      }
    };

    loadPaymentMethods();
  }, [user?.id]);

  // Reload payment methods when screen comes into focus (e.g., after adding a card)
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.id) return;

      const reloadPaymentMethods = async () => {
        try {
          const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
          const response = await getPaymentMethods(riderId);
          if (response.success && response.paymentMethods) {
            setPaymentMethods(response.paymentMethods);
            // Auto-select default if no selection and default exists
            if (!selectedPaymentOption) {
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
          }
        } catch (error) {
          console.error('Error reloading payment methods:', error);
        }
      };
      reloadPaymentMethods();
    }, [user?.id])
  );

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

  const handlePaymentOptionSelect = (option: PaymentOption) => {
    if (option.type === 'addNew') {
      // Navigate to add-card screen to add new payment method
      router.push('/add-card');
    } else if (option.type === 'applePay' || option.type === 'googlePay') {
      // Navigate to payment screen for wallet payments
      router.push({
        pathname: '/payment',
        params: {
          ride: JSON.stringify(ride),
          pickupDetails: JSON.stringify(pickupDetails),
          numberOfSeats: numberOfSeats.toString(),
          totalAmount: total.toFixed(2),
          paymentMethodType: option.type,
        },
      });
    } else {
      setSelectedPaymentOption(option);
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
      const bookingData: any = {
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
        </View>

        {/* Payment Method Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Payment Method</Text>
          {isLoadingPaymentMethods ? (
            <View style={styles.paymentMethodLoading}>
              <ActivityIndicator size="small" color="#4285F4" />
            </View>
          ) : (
            <>
              {/* Payment Method Dropdown */}
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCardDropdown(true)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownContent}>
                  {selectedPaymentOption?.type === 'saved' ? (
                    <IconSymbol name="creditcard" size={18} color="#4285F4" />
                  ) : selectedPaymentOption?.type === 'applePay' ? (
                    <IconSymbol name="applelogo" size={18} color="#FFFFFF" />
                  ) : selectedPaymentOption?.type === 'googlePay' ? (
                    <View style={styles.googlePayIcon}>
                      <Text style={styles.googlePayText}>G</Text>
                    </View>
                  ) : (
                    <IconSymbol name="creditcard" size={18} color="#999999" />
                  )}
                  <View style={styles.dropdownTextContainer}>
                    {selectedPaymentOption ? (
                      <>
                        <Text style={styles.dropdownSelectedText}>
                          {selectedPaymentOption.label}
                        </Text>
                        {selectedPaymentOption.type === 'saved' && paymentMethods.find(m => m.id === selectedPaymentOption.paymentMethodId)?.billingDetails?.name && (
                          <Text style={styles.dropdownSubText}>
                            {paymentMethods.find(m => m.id === selectedPaymentOption.paymentMethodId)?.billingDetails?.name}
            </Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.dropdownPlaceholder}>Select payment method</Text>
                    )}
                  </View>
                  <IconSymbol name="chevron.down" size={16} color="#999999" />
                </View>
              </TouchableOpacity>

              {/* Google Pay - Keep as separate button for Android */}
              {Platform.OS === 'android' && isGooglePaySupported && (
                <TouchableOpacity
                  style={[
                    styles.paymentMethodOption,
                    selectedPaymentOption?.type === 'googlePay' && styles.paymentMethodOptionSelected,
                  ]}
                  onPress={() => handlePaymentOptionSelect({ id: 'googlePay', type: 'googlePay', label: 'Google Pay' })}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentMethodContent}>
                    <View style={[styles.googlePayIcon, selectedPaymentOption?.type === 'googlePay' && styles.googlePayIconSelected]}>
                      <Text style={styles.googlePayText}>G</Text>
          </View>
                    <Text style={[styles.paymentMethodText, selectedPaymentOption?.type === 'googlePay' && styles.paymentMethodTextSelected]}>
                      Google Pay
                    </Text>
          </View>
                  {selectedPaymentOption?.type === 'googlePay' && (
                    <IconSymbol name="checkmark.circle.fill" size={18} color="#4285F4" />
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Payment Method Dropdown Modal */}
        <Modal
          visible={showCardDropdown}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCardDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCardDropdown(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Payment Method</Text>
                <TouchableOpacity
                  onPress={() => setShowCardDropdown(false)}
                  style={styles.modalCloseButton}
                >
                  <IconSymbol name="xmark" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                {/* Saved Cards */}
                {paymentMethods.map((method) => {
                  const brand = method.brand || method.card?.brand || 'Card';
                  const last4 = method.last4 || method.card?.last4 || '0000';
                  const cardholderName = method.billingDetails?.name;
                  const isSelected = selectedPaymentOption?.id === method.id && selectedPaymentOption?.type === 'saved';
                  
                  const option: PaymentOption = {
                    id: method.id,
                    type: 'saved',
                    label: `${brand.toUpperCase()} •••• ${last4}`,
                    paymentMethodId: method.id,
                  };
                  
                  return (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.modalCardOption,
                        isSelected && styles.modalCardOptionSelected,
                      ]}
                      onPress={() => {
                        handlePaymentOptionSelect(option);
                        setShowCardDropdown(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.paymentMethodContent}>
                        <IconSymbol name="creditcard" size={20} color={isSelected ? '#4285F4' : '#999999'} />
                        <View style={styles.paymentMethodInfo}>
                          <Text style={[styles.modalCardText, isSelected && styles.modalCardTextSelected]}>
                            {option.label}
                          </Text>
                          {cardholderName && (
                            <Text style={styles.modalCardName}>{cardholderName}</Text>
                          )}
                        </View>
                      </View>
                      {isSelected && (
                        <IconSymbol name="checkmark.circle.fill" size={20} color="#4285F4" />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Add New Card */}
                <TouchableOpacity
                  style={[
                    styles.modalCardOption,
                    selectedPaymentOption?.type === 'addNew' && styles.modalCardOptionSelected,
                  ]}
                  onPress={() => {
                    handlePaymentOptionSelect({ id: 'addNew', type: 'addNew', label: 'Add New Card' });
                    setShowCardDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentMethodContent}>
                    <IconSymbol name="plus.circle" size={20} color={selectedPaymentOption?.type === 'addNew' ? '#4285F4' : '#999999'} />
                    <Text style={[styles.modalCardText, selectedPaymentOption?.type === 'addNew' && styles.modalCardTextSelected]}>
                      Add New Card
                    </Text>
                  </View>
                  {selectedPaymentOption?.type === 'addNew' && (
                    <IconSymbol name="checkmark.circle.fill" size={20} color="#4285F4" />
                  )}
                </TouchableOpacity>

                {/* Apple Pay */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[
                      styles.modalCardOption,
                      selectedPaymentOption?.type === 'applePay' && styles.modalCardOptionSelected,
                      !isApplePaySupported && styles.modalCardOptionDisabled,
                    ]}
                    onPress={() => {
                      if (isApplePaySupported) {
                        handlePaymentOptionSelect({ id: 'applePay', type: 'applePay', label: 'Apple Pay' });
                        setShowCardDropdown(false);
                      }
                    }}
                    activeOpacity={isApplePaySupported ? 0.7 : 1}
                    disabled={!isApplePaySupported}
                  >
                    <View style={styles.paymentMethodContent}>
                      <IconSymbol name="applelogo" size={20} color={selectedPaymentOption?.type === 'applePay' ? '#FFFFFF' : isApplePaySupported ? '#999999' : '#666666'} />
                      <View style={styles.paymentMethodInfo}>
                        <Text style={[styles.modalCardText, selectedPaymentOption?.type === 'applePay' && styles.modalCardTextSelected, !isApplePaySupported && styles.modalCardTextDisabled]}>
                          Apple Pay
                        </Text>
                        {!isApplePaySupported && (
                          <Text style={styles.modalCardName}>Not available on this device</Text>
                        )}
                      </View>
                    </View>
                    {selectedPaymentOption?.type === 'applePay' && (
                      <IconSymbol name="checkmark.circle.fill" size={20} color="#4285F4" />
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
});
