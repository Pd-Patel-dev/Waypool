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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import { useUser } from '@/context/UserContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { bookRide, type Ride } from '@/services/api';
import { savePaymentMethod } from '@/services/api';

interface AddressDetails {
  fullAddress: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  zipCode?: string;
}

type PaymentMethodType = 'card' | 'applePay' | 'googlePay';

export default function PaymentScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const { 
    initPaymentSheet, 
    presentPaymentSheet,
    isApplePaySupported,
    isGooglePaySupported,
  } = useStripe();
  
  const [ride, setRide] = useState<Ride | null>(null);
  const [pickupDetails, setPickupDetails] = useState<AddressDetails | null>(null);
  const [numberOfSeats, setNumberOfSeats] = useState<number>(1);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(null);
  const hasParsedParams = useRef(false);

  useEffect(() => {
    if (hasParsedParams.current) return;

    if (params.ride && params.pickupDetails && params.numberOfSeats && params.totalAmount) {
      try {
        const rideData = JSON.parse(params.ride as string);
        const pickupData = JSON.parse(params.pickupDetails as string);
        const seats = parseInt(params.numberOfSeats as string);
        const amount = parseFloat(params.totalAmount as string);

        setRide(rideData);
        setPickupDetails(pickupData);
        setNumberOfSeats(seats);
        setTotalAmount(amount);
        hasParsedParams.current = true;
      } catch (error) {
        console.error('Error parsing params:', error);
        Alert.alert('Error', 'Invalid payment data');
        router.back();
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.ride, params.pickupDetails, params.numberOfSeats, params.totalAmount]);

  const handlePaymentMethodSelection = async (method: PaymentMethodType) => {
    setSelectedPaymentMethod(method);
    
    if (method === 'card') {
      // For card, we'll use payment sheet to collect and save payment method
      await handleSaveCard();
    } else {
      // For wallet payments, also save the payment method
      await handleSaveWalletPayment(method);
    }
  };

  const handleSaveCard = async () => {
    if (!ride || !pickupDetails || !user?.id) {
      Alert.alert('Error', 'Missing booking information');
      return;
    }

    setIsProcessing(true);

    try {
      // Create setup intent to save payment method (no charge)
      const setupIntentResponse = await savePaymentMethod({
        riderId: typeof user.id === 'string' ? parseInt(user.id) : user.id,
        paymentMethodType: 'card',
        rideId: ride.id,
      });

      if (!setupIntentResponse.success) {
        throw new Error(setupIntentResponse.message || 'Failed to initialize payment method setup');
      }

      // Check if we have a valid client secret (not a mock)
      if (!setupIntentResponse.setupIntentClientSecret || setupIntentResponse.setupIntentClientSecret === 'mock_client_secret') {
        // If using mock, skip Stripe and proceed directly to booking
        console.warn('Using mock payment method - skipping Stripe');
        await confirmBooking('mock_payment_method_id');
        return;
      }

      // Initialize payment sheet for card collection
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Waypool',
        setupIntentClientSecret: setupIntentResponse.setupIntentClientSecret,
        defaultBillingDetails: {
          name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
          email: user.email || undefined,
        },
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          throw new Error(presentError.message);
        }
        // User canceled - reset selection
        setSelectedPaymentMethod(null);
        setIsProcessing(false);
        return;
      }

      // PaymentSheet completed successfully
      // The SetupIntent has been confirmed and the payment method is attached to the customer
      // We can proceed with booking - the payment method is already saved
      await confirmBooking('setup_intent_payment_method');
    } catch (error: any) {
      console.error('Payment method save error:', error);
      Alert.alert('Error', error.message || 'Failed to save payment method. Please try again.');
      setSelectedPaymentMethod(null);
      setIsProcessing(false);
    }
  };

  const handleSaveWalletPayment = async (method: PaymentMethodType) => {
    if (!ride || !pickupDetails || !user?.id) {
      Alert.alert('Error', 'Missing booking information');
      return;
    }

    setIsProcessing(true);

    try {
      // Check wallet support (if available in SDK)
      if (method === 'applePay' && isApplePaySupported !== undefined && !isApplePaySupported) {
        Alert.alert('Not Available', 'Apple Pay is not available on this device');
        setSelectedPaymentMethod(null);
        setIsProcessing(false);
        return;
      }

      if (method === 'googlePay' && isGooglePaySupported !== undefined && !isGooglePaySupported) {
        Alert.alert('Not Available', 'Google Pay is not available on this device');
        setSelectedPaymentMethod(null);
        setIsProcessing(false);
        return;
      }

      // Create setup intent for wallet payment
      const setupIntentResponse = await savePaymentMethod({
        riderId: typeof user.id === 'string' ? parseInt(user.id) : user.id,
        paymentMethodType: method,
        rideId: ride.id,
      });

      if (!setupIntentResponse.success) {
        throw new Error(setupIntentResponse.message || 'Failed to initialize payment method setup');
      }

      // Check if we have a valid client secret (not a mock)
      if (!setupIntentResponse.setupIntentClientSecret || setupIntentResponse.setupIntentClientSecret === 'mock_client_secret') {
        // If using mock, skip Stripe and proceed directly to booking
        console.warn('Using mock payment method - skipping Stripe');
        await confirmBooking('mock_payment_method_id');
        return;
      }

      // Initialize payment sheet for wallet payment
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Waypool',
        setupIntentClientSecret: setupIntentResponse.setupIntentClientSecret,
        applePay: method === 'applePay' ? {
          merchantCountryCode: 'US',
        } : undefined,
        googlePay: method === 'googlePay' ? {
          merchantCountryCode: 'US',
          testEnv: __DEV__,
        } : undefined,
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          throw new Error(presentError.message);
        }
        // User canceled - reset selection
        setSelectedPaymentMethod(null);
        setIsProcessing(false);
        return;
      }

      // PaymentSheet completed successfully
      // The SetupIntent has been confirmed and the payment method is attached to the customer
      // We can proceed with booking - the payment method is already saved
      await confirmBooking('setup_intent_payment_method');
    } catch (error: any) {
      console.error('Payment method save error:', error);
      Alert.alert('Error', error.message || 'Failed to save payment method. Please try again.');
      setSelectedPaymentMethod(null);
      setIsProcessing(false);
    }
  };

  const confirmBooking = async (paymentMethodId: string) => {
    if (!ride || !pickupDetails || !user?.id) {
      throw new Error('Missing booking information');
    }

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
          `Your booking has been confirmed. Confirmation number: ${response.booking.confirmationNumber}\n\nYour payment method has been saved. You will be charged when the ride is completed.`,
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else {
        throw new Error('Failed to confirm booking');
      }
    } catch (error: any) {
      console.error('Booking confirmation error:', error);
      
      // Handle specific error cases
      const errorMessage = error.message || 'Failed to confirm booking';
      
      if (errorMessage.includes('already have a pending request') || errorMessage.includes('already have a confirmed booking')) {
        // User already has a booking for this ride
        Alert.alert(
          'Booking Already Exists',
          'You already have a booking request for this ride. Please check your activity.',
          [
            {
              text: 'View Activity',
              onPress: () => {
                router.replace('/(tabs)/explore');
              },
            },
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => {
                router.back();
              },
            },
          ]
        );
        return; // finally block will handle setIsProcessing(false)
      }
      
      // For other errors, show generic error
      throw new Error(errorMessage || 'Failed to confirm booking. Please contact support.');
    } finally {
      setIsProcessing(false);
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
          <Text style={styles.errorText}>Invalid payment data</Text>
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
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Payment Method</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <IconSymbol name="info.circle" size={20} color="#4285F4" />
          <Text style={styles.infoText}>
            Add a payment method to confirm your booking. You'll be charged when the ride is completed.
          </Text>
        </View>

        {/* Order Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ride</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {ride.fromCity} → {ride.toCity}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Seats</Text>
            <Text style={styles.summaryValue}>{numberOfSeats}</Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>${totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>

          {/* Card Payment */}
          <TouchableOpacity
            style={[
              styles.paymentMethodOption,
              selectedPaymentMethod === 'card' && styles.paymentMethodOptionSelected,
              isProcessing && styles.paymentMethodOptionDisabled,
            ]}
            onPress={() => handlePaymentMethodSelection('card')}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <View style={styles.paymentMethodContent}>
              <IconSymbol name="creditcard" size={20} color={selectedPaymentMethod === 'card' ? '#4285F4' : '#999999'} />
              <Text style={[styles.paymentMethodName, selectedPaymentMethod === 'card' && styles.paymentMethodNameSelected]}>
                Card
              </Text>
            </View>
            {selectedPaymentMethod === 'card' && isProcessing ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : selectedPaymentMethod === 'card' ? (
              <IconSymbol name="checkmark.circle.fill" size={20} color="#4285F4" />
            ) : null}
          </TouchableOpacity>

          {/* Apple Pay */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[
                styles.paymentMethodOption,
                selectedPaymentMethod === 'applePay' && styles.paymentMethodOptionSelected,
                isProcessing && styles.paymentMethodOptionDisabled,
              ]}
              onPress={() => handlePaymentMethodSelection('applePay')}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <View style={styles.paymentMethodContent}>
                <IconSymbol name="applelogo" size={20} color={selectedPaymentMethod === 'applePay' ? '#FFFFFF' : '#999999'} />
                <Text style={[styles.paymentMethodName, selectedPaymentMethod === 'applePay' && styles.paymentMethodNameSelected]}>
                  Apple Pay
                </Text>
              </View>
              {selectedPaymentMethod === 'applePay' && isProcessing ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : selectedPaymentMethod === 'applePay' ? (
                <IconSymbol name="checkmark.circle.fill" size={20} color="#4285F4" />
              ) : null}
            </TouchableOpacity>
          )}

          {/* Google Pay */}
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[
                styles.paymentMethodOption,
                selectedPaymentMethod === 'googlePay' && styles.paymentMethodOptionSelected,
                isProcessing && styles.paymentMethodOptionDisabled,
              ]}
              onPress={() => handlePaymentMethodSelection('googlePay')}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.googlePayIcon, selectedPaymentMethod === 'googlePay' && styles.googlePayIconSelected]}>
                  <Text style={styles.googlePayText}>G</Text>
                </View>
                <Text style={[styles.paymentMethodName, selectedPaymentMethod === 'googlePay' && styles.paymentMethodNameSelected]}>
                  Google Pay
                </Text>
              </View>
              {selectedPaymentMethod === 'googlePay' && isProcessing ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : selectedPaymentMethod === 'googlePay' ? (
                <IconSymbol name="checkmark.circle.fill" size={20} color="#4285F4" />
              ) : null}
            </TouchableOpacity>
          )}
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <IconSymbol name="lock.shield" size={16} color="#999999" />
          <Text style={styles.securityText}>
            Your payment information is encrypted and secure. You'll be charged when the ride completes.
          </Text>
        </View>
      </ScrollView>

      {/* Processing Indicator */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContent}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={styles.processingText}>Saving payment method...</Text>
          </View>
        </View>
      )}
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1F3A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A3A5A',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#E0E7FF',
    lineHeight: 20,
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#2A2A2C',
    marginVertical: 12,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    backgroundColor: '#141416',
    marginBottom: 8,
  },
  paymentMethodOptionSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#1A1F3A',
  },
  paymentMethodOptionDisabled: {
    opacity: 0.5,
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
  },
  paymentMethodNameSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  googlePayIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googlePayIconSelected: {
    backgroundColor: '#FFFFFF',
  },
  googlePayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4285F4',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
    flex: 1,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContent: {
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
    marginTop: 12,
  },
});

