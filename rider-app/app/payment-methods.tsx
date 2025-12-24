import React, { useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getPaymentMethods, deletePaymentMethod } from '@/services/api';
import { handleErrorSilently, handleErrorWithAlert } from '@/utils/errorHandler';
import { Card, Button, LoadingState, EmptyState, ScreenHeader } from '@/components/common';

interface PaymentMethod {
  id: string;
  type: 'card' | 'applePay' | 'googlePay';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

export default function PaymentMethodsScreen(): React.JSX.Element {
  const { user } = useUser();
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadPaymentMethods();
    }, [])
  );

  const loadPaymentMethods = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const response = await getPaymentMethods(riderId);
      if (response.success) {
        setPaymentMethods(response.paymentMethods || []);
      } else {
        // If backend returns an error, show empty array (payment methods not available)
        setPaymentMethods([]);
      }
    } catch (error) {
      const appError = handleErrorSilently(error, 'loadPaymentMethods');
      
      // Check if it's a Stripe configuration error
      const errorMessage = appError.message || '';
      if (errorMessage.includes('Stripe API key') || errorMessage.includes('STRIPE_SECRET_KEY')) {
        // Backend Stripe is not configured - silently show empty state
        // This is a backend configuration issue, not a user error
      }
      
      // Set empty array - show empty state to user
      setPaymentMethods([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCard = () => {
    router.push('/add-card');
  };


  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!user?.id) return;

    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to delete this payment method?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const riderId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
              const response = await deletePaymentMethod(riderId, paymentMethodId);
              
              if (response.success) {
                Alert.alert('Success', 'Payment method deleted successfully');
                await loadPaymentMethods();
              } else {
                throw new Error(response.message || 'Failed to delete payment method');
              }
            } catch (error) {
              handleErrorWithAlert(error, {
                context: 'deletePaymentMethod',
                title: 'Delete Payment Method',
              });
            }
          },
        },
      ]
    );
  };

  const formatCardBrand = (brand: string | undefined): string => {
    if (!brand) return 'Card';
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  const formatPaymentMethodLabel = (method: PaymentMethod): string => {
    if (method.type === 'card' && method.last4) {
      return `${formatCardBrand(method.brand)} •••• ${method.last4}`;
    }
    if (method.type === 'applePay') return 'Apple Pay';
    if (method.type === 'googlePay') return 'Google Pay';
    return 'Card';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      <ScreenHeader title="Payment Methods" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Existing Payment Methods */}
        {paymentMethods.length > 0 ? (
          <View style={styles.paymentMethodsList}>
            {paymentMethods.map((method) => (
              <Card key={method.id} style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodIcon}>
                  {method.type === 'card' && (
                    <IconSymbol name="creditcard" size={18} color="#4285F4" />
                  )}
                  {method.type === 'applePay' && (
                    <IconSymbol name="applelogo" size={18} color="#FFFFFF" />
                  )}
                  {method.type === 'googlePay' && (
                    <Text style={styles.googlePayIconText}>G</Text>
                  )}
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodLabel}>{formatPaymentMethodLabel(method)}</Text>
                  {method.isDefault && (
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePaymentMethod(method.id)}
                  activeOpacity={0.7}
                >
                  <IconSymbol name="trash" size={16} color="#999999" />
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="creditcard.fill"
            title="No payment methods saved"
            description="Add a payment method to book rides quickly. Your card information is securely stored."
            actionLabel="Add Payment Method"
            onAction={handleAddCard}
          />
        )}

        {/* Add Payment Method Section */}
        <View style={styles.addSection}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddCard}
            activeOpacity={0.7}
          >
            <IconSymbol name="plus" size={16} color="#4285F4" />
            <Text style={styles.addButtonText}>Add Card</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  paymentMethodsList: {
    marginBottom: 16,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  paymentMethodIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googlePayIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  paymentMethodInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4285F4',
  },
  deleteButton: {
    padding: 4,
  },
  addSection: {
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2C',
    gap: 10,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  googlePayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
    width: 16,
    textAlign: 'center',
  },
});

