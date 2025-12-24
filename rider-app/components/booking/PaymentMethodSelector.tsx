/**
 * Payment Method Selector Component
 * Extracted from booking-confirm.tsx for better code organization
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Card from '@/components/common/Card';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '@/constants/designSystem';

export type PaymentOption = {
  id: string;
  type: 'saved' | 'addNew' | 'applePay' | 'googlePay';
  label: string;
  description?: string;
  paymentMethodId?: string;
};

export interface PaymentMethod {
  id: string;
  type: 'card' | 'applePay' | 'googlePay';
  brand?: string;
  last4?: string;
  isDefault?: boolean;
  card?: {
    brand?: string;
    last4?: string;
  };
  billingDetails?: {
    name?: string;
  };
}

interface PaymentMethodSelectorProps {
  paymentMethods: PaymentMethod[];
  selectedPaymentOption: PaymentOption | null;
  isLoading: boolean;
  isApplePaySupported: boolean;
  isGooglePaySupported: boolean;
  onSelect: (option: PaymentOption) => void;
  onShowDropdown: () => void;
}

export default function PaymentMethodSelector({
  paymentMethods,
  selectedPaymentOption,
  isLoading,
  isApplePaySupported,
  isGooglePaySupported,
  onSelect,
  onShowDropdown,
}: PaymentMethodSelectorProps): React.JSX.Element {
  if (isLoading) {
    return (
      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.paymentMethodLoading}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.sectionLabel}>Payment Method</Text>
      
      {/* Payment Method Dropdown */}
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={onShowDropdown}
        activeOpacity={0.7}
      >
        <View style={styles.dropdownContent}>
          {selectedPaymentOption?.type === 'saved' ? (
            <IconSymbol name="creditcard" size={18} color={COLORS.primary} />
          ) : selectedPaymentOption?.type === 'applePay' ? (
            <IconSymbol name="applelogo" size={18} color={COLORS.textPrimary} />
          ) : selectedPaymentOption?.type === 'googlePay' ? (
            <View style={styles.googlePayIcon}>
              <Text style={styles.googlePayText}>G</Text>
            </View>
          ) : (
            <IconSymbol name="creditcard" size={18} color={COLORS.textTertiary} />
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
          <IconSymbol name="chevron.down" size={16} color={COLORS.textTertiary} />
        </View>
      </TouchableOpacity>

      {/* Google Pay - Keep as separate button for Android */}
      {Platform.OS === 'android' && isGooglePaySupported && (
        <TouchableOpacity
          style={[
            styles.paymentMethodOption,
            selectedPaymentOption?.type === 'googlePay' && styles.paymentMethodOptionSelected,
          ]}
          onPress={() => onSelect({ id: 'googlePay', type: 'googlePay', label: 'Google Pay' })}
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
            <IconSymbol name="checkmark.circle.fill" size={18} color={COLORS.primary} />
          )}
          </TouchableOpacity>
        )}
      </Card>
    );
  }

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
  },
  sectionLabel: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
  },
  paymentMethodLoading: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  dropdownButton: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownSelectedText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dropdownSubText: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dropdownPlaceholder: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textTertiary,
  },
  googlePayIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googlePayText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  paymentMethodOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  paymentMethodText: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  paymentMethodTextSelected: {
    fontWeight: '600',
    color: COLORS.primary,
  },
  googlePayIconSelected: {
    backgroundColor: COLORS.primary,
  },
});

