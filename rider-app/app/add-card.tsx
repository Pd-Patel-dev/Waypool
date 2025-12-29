import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useStripe, CardField } from '@stripe/stripe-react-native';
import { useUser } from '@/context/UserContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { savePaymentMethod } from '@/services/api';

export default function AddCardScreen(): React.JSX.Element {
  const { user } = useUser();
  const stripe = useStripe();
  const { createPaymentMethod, isApplePaySupported, isGooglePaySupported } = stripe || {};
  
  // Log Stripe initialization status
  React.useEffect(() => {
    console.log('=== STRIPE INITIALIZATION CHECK ===');
    console.log('Stripe object exists:', !!stripe);
    console.log('createPaymentMethod exists:', !!createPaymentMethod);
    console.log('isApplePaySupported:', isApplePaySupported);
    console.log('isGooglePaySupported:', isGooglePaySupported);
    if (!stripe || !createPaymentMethod) {
      console.error('❌ Stripe is not properly initialized!');
      console.error('This may be due to:');
      console.error('1. Missing StripeProvider in _layout.tsx');
      console.error('2. Invalid or missing Stripe publishable key');
      console.error('3. Stripe package not properly installed');
    } else {
      console.log('✅ Stripe is properly initialized');
    }
    console.log('===================================');
  }, [stripe, createPaymentMethod]);
  
  // CardField handles card number, expiry, and CVV automatically
  // We only need to collect cardholder name and zip code manually
  const [zipCode, setZipCode] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardFieldComplete, setCardFieldComplete] = useState(false);

  const handleZipCodeChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 10);
    setZipCode(cleaned);
  };
  
  // Handle CardField completion status
  const handleCardFieldChange = (details: any) => {
    console.log('=== CardField onChange ===');
    console.log('Details:', JSON.stringify(details, null, 2));
    console.log('Complete:', details.complete);
    console.log('Brand:', details.brand);
    console.log('Last4:', details.last4);
    console.log('Expiry Month:', details.expiryMonth);
    console.log('Expiry Year:', details.expiryYear);
    console.log('All fields:', {
      hasNumber: !!details.number,
      hasExpiryMonth: !!details.expiryMonth,
      hasExpiryYear: !!details.expiryYear,
      hasCvc: !!details.cvc,
    });
    
    // Set completion status - CardField sets complete to true when all fields are valid
    const isComplete = details.complete === true;
    console.log('Setting cardFieldComplete to:', isComplete);
    setCardFieldComplete(isComplete);
  };

  const validateForm = (): boolean => {
    console.log('=== Validating Form ===');
    console.log('CardField Complete Status:', cardFieldComplete);
    console.log('Cardholder Name:', cardholderName.trim());
    console.log('Zip Code:', zipCode.trim());
    
    // Note: We don't check cardFieldComplete here because:
    // 1. CardField's complete property might not always be reliable
    // 2. Stripe will validate the card when we call createPaymentMethod
    // 3. If the card is incomplete, Stripe will return a clear error message
    
    // Zip code is optional for Stripe, but we'll validate if provided
    if (zipCode && zipCode.length > 0 && zipCode.length < 5) {
      Alert.alert('Error', 'Please enter a valid zip code (5 digits minimum)');
      return false;
    }

    if (!cardholderName.trim()) {
      Alert.alert('Error', 'Please enter cardholder name');
      return false;
    }

    console.log('✅ Form validation passed (card validation will be done by Stripe)');
    return true;
  };

  const handleAddCard = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please log in and try again.');
      router.replace('/login');
      return;
    }
    
    // Validate user ID is a valid number
    const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    if (isNaN(riderId) || riderId <= 0) {
      Alert.alert(
        'Session Expired',
        'Your session is invalid. Please log out and log back in.',
        [
          { text: 'OK', onPress: () => router.replace('/login') }
        ]
      );
      return;
    }
    
    // Check if Stripe is initialized
    if (!stripe || !createPaymentMethod) {
      Alert.alert('Error', 'Payment system is not initialized. Please restart the app.');
      console.error('Stripe initialization check:', { stripe: !!stripe, createPaymentMethod: !!createPaymentMethod });
      return;
    }

    // Use validateForm for basic validation
    // Card validation will be handled by Stripe when we call createPaymentMethod
    if (!validateForm()) {
      return;
    }
    
    // Log CardField status for debugging (but don't block)
    console.log('CardField Complete Status:', cardFieldComplete);
    if (!cardFieldComplete) {
      console.warn('⚠️ CardField complete status is false');
      console.warn('Proceeding anyway - Stripe will validate the card and return an error if incomplete');
    }

    setIsProcessing(true);

    try {
      console.log('=== CREATING PAYMENT METHOD WITH CARD FIELD ===');
      console.log('Card Field Complete:', cardFieldComplete);
      console.log('Cardholder Name:', cardholderName.trim());
      console.log('Zip Code:', zipCode.trim());
      console.log('User Email:', user.email);
      
      // When using CardField, Stripe automatically handles card details
      // We only need to pass paymentMethodType and billingDetails
      // CardField provides the card data automatically
      
      // Prepare billing details
      const billingDetails: {
        name?: string;
        email?: string;
        address?: {
          postalCode?: string;
        };
      } = {};
      
      if (cardholderName.trim()) {
        billingDetails.name = cardholderName.trim();
      }
      
      if (user.email) {
        billingDetails.email = user.email;
      }
      
      if (zipCode.trim()) {
        billingDetails.address = {
          postalCode: zipCode.trim(),
        };
      }
      
      // When using CardField, you don't pass card details manually
      // Stripe automatically uses the card data from CardField
      const stripeRequest: {
        paymentMethodType: 'Card';
        billingDetails?: {
          name?: string;
          email?: string;
          address?: {
            postalCode?: string;
          };
        };
      } = {
        paymentMethodType: 'Card',
      };
      
      // Add billingDetails if available
      if (Object.keys(billingDetails).length > 0) {
        stripeRequest.billingDetails = billingDetails;
      }
      
      console.log('=== STRIPE REQUEST (using CardField) ===');
      console.log('Payment Method Type:', stripeRequest.paymentMethodType);
      console.log('Billing Details:', stripeRequest.billingDetails || 'None');
      console.log('Note: Card details are automatically provided by CardField component');
      console.log('========================================');
      
      // Verify Stripe is initialized
      if (!createPaymentMethod) {
        console.error('❌ createPaymentMethod is not available');
        console.error('Stripe object:', stripe);
        throw new Error('Stripe is not initialized. Please check your StripeProvider configuration and publishable key.');
      }
      
      // Call Stripe createPaymentMethod
      // CardField automatically provides card details, so we don't pass them manually
      console.log('=== CALLING STRIPE createPaymentMethod (CardField) ===');
      const { paymentMethod, error } = await createPaymentMethod(stripeRequest);
      
      console.log('=== STRIPE RESPONSE ===');
      if (error) {
        console.error('❌ STRIPE ERROR:', error);
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Error Type:', error.type);
        console.error('Full Error Object:', JSON.stringify(error, null, 2));
      } else {
        console.log('✅ STRIPE SUCCESS');
        console.log('Payment Method ID:', paymentMethod?.id);
        console.log('Payment Method Type:', paymentMethod?.type);
        console.log('Payment Method Card:', paymentMethod?.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.expMonth,
          expYear: paymentMethod.card.expYear,
        } : null);
        console.log('Full Payment Method:', JSON.stringify(paymentMethod, null, 2));
      }
      console.log('========================');

      if (error) {
        console.error('Stripe createPaymentMethod error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error type:', error.type);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        
        // Handle specific Stripe errors
        let errorMessage = 'Failed to add card. ';
        
        // Check for specific error codes first
        if (error.code === 'card_declined') {
          errorMessage += 'Your card was declined. Please try a different card.';
        } else if (error.code === 'expired_card') {
          errorMessage += 'Your card has expired. Please use a different card.';
        } else if (error.code === 'incorrect_cvc') {
          errorMessage += 'Your card\'s security code is incorrect.';
        } else if (error.code === 'processing_error') {
          errorMessage += 'An error occurred while processing your card. Please try again.';
        } else if (error.code === 'invalid_number') {
          errorMessage += 'The card number is invalid. Please check and try again.';
        } else if (error.code === 'invalid_expiry_month') {
          errorMessage += 'The expiry month is invalid. Please enter a valid month (01-12).';
        } else if (error.code === 'invalid_expiry_year') {
          errorMessage += 'The expiry year is invalid. Please enter a valid year.';
        } else if (error.code === 'invalid_cvc') {
          errorMessage += 'The CVV is invalid. Please enter a valid 3-4 digit CVV.';
        } else if (error.message) {
          // Check error message for common issues
          const lowerMessage = error.message.toLowerCase();
          if (lowerMessage.includes('not complete') || lowerMessage.includes('incomplete')) {
            errorMessage += 'Please make sure all card fields are filled correctly.';
          } else if (lowerMessage.includes('invalid')) {
            errorMessage += error.message;
          } else {
            errorMessage += error.message;
          }
        } else {
          errorMessage += 'Please check your card details and try again.';
        }
        
        console.error('Final error message:', errorMessage);
        throw new Error(errorMessage);
      }

      if (!paymentMethod || !paymentMethod.id) {
        throw new Error('Failed to create payment method. Please try again.');
      }

      // Send tokenized payment method ID to backend
      // Backend will securely attach it to the Stripe customer using secret key
      if (!user?.id) {
        throw new Error('User not found. Please log in and try again.');
      }
      
      const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      
      if (isNaN(riderId) || riderId <= 0) {
        throw new Error('Invalid user ID. Please log out and log back in.');
      }
      
      console.log('Saving payment method:', {
        riderId,
        userEmail: user.email,
        paymentMethodId: paymentMethod.id,
        paymentMethodType: 'card',
      });
      
      const response = await savePaymentMethod({
        riderId,
        paymentMethodId: paymentMethod.id, // Secure tokenized ID (not actual card details)
        paymentMethodType: 'card',
      });

      console.log('Save payment method response:', response);

      if (!response.success) {
        throw new Error(response.message || 'Failed to save card to your account. Please try again.');
      }

      Alert.alert(
        'Card Added',
        'Your card has been saved securely and will be used for future bookings.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Add card error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        stack: error.stack,
      });
      
      // Handle specific error cases
      let errorMessage = error.message || 'Failed to add card. Please try again.';
      
      // Handle JSON parse errors (usually means server returned HTML instead of JSON)
      if (error.message?.includes('JSON Parse error') || error.message?.includes('Unexpected character')) {
        errorMessage = 'Server communication error. Please check your internet connection and try again.';
        if (error.status === 404) {
          errorMessage = 'The payment service endpoint was not found. Please contact support.';
        } else if (error.status === 500) {
          errorMessage = 'Server error occurred. Please try again in a moment.';
        }
      }
      
      // If rider not found (404), suggest logging out and back in
      if (error.status === 404 && (error.message?.includes('Rider not found') || error.message?.includes('not found'))) {
        Alert.alert(
          'Account Not Found',
          'Your account is not found in the system. This may happen if the database was reset. Please log out and log back in to refresh your account.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Go to Login', 
              onPress: () => router.replace('/login')
            }
          ]
        );
        return; // Don't show additional error message
      } else if (error.status === 403 && error.message?.includes('not a rider')) {
        errorMessage = 'Your account is not registered as a rider. Please use the rider app to sign up.';
        Alert.alert('Error', errorMessage);
      } else {
        console.error('Showing error alert:', errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Card</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cardholder Name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Cardholder Name</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#666666"
              value={cardholderName}
              onChangeText={setCardholderName}
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
            />
          </View>

          {/* Stripe CardField - Handles card number, expiry, and CVV securely */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Card Details</Text>
            <View style={styles.cardFieldContainer}>
              <CardField
                postalCodeEnabled={false} // We'll collect zip code separately
                placeholders={{
                  number: '4242 4242 4242 4242',
                }}
                cardStyle={{
                  backgroundColor: '#1C1C1E',
                  textColor: '#FFFFFF',
                  borderColor: cardFieldComplete ? '#4285F4' : '#2A2A2C',
                  borderWidth: 1,
                  borderRadius: 8,
                  fontSize: 16,
                  placeholderColor: '#666666',
                }}
                style={styles.cardField}
                onCardChange={handleCardFieldChange}
              />
            </View>
            {!cardFieldComplete ? (
              <Text style={styles.hintText}>Enter your card number, expiry date (MM/YY), and CVV</Text>
            ) : (
              <Text style={[styles.hintText, { color: '#4285F4' }]}>✓ Card details complete</Text>
            )}
          </View>

          {/* Zip Code - Optional */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Zip Code (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="12345"
              placeholderTextColor="#666666"
              value={zipCode}
              onChangeText={handleZipCodeChange}
              keyboardType="number-pad"
              maxLength={10}
              autoComplete="postal-code"
            />
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <IconSymbol name="lock.shield" size={14} color="#4285F4" />
            <Text style={styles.securityText}>
              Your card details are securely tokenized by Stripe. We never store your full card number.
            </Text>
          </View>
        </ScrollView>

        {/* Add Card Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.addButton,
              isProcessing && styles.addButtonDisabled
            ]}
            onPress={handleAddCard}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="creditcard" size={18} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Card</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
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
  formGroup: {
    marginBottom: 20,
    flex: 1,
  },
  cardFieldContainer: {
    marginTop: 8,
  },
  cardField: {
    width: '100%',
    height: 52,
  },
  hintText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    height: 52,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  addButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
