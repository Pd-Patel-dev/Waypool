import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { PaymentMethod } from '@/services/api';

export interface PaymentOption {
  id: string;
  type: 'saved' | 'addNew' | 'applePay' | 'googlePay';
  label: string;
  description?: string;
  paymentMethodId?: string;
}

interface PaymentMethodModalProps {
  visible: boolean;
  paymentMethods: PaymentMethod[];
  selectedPaymentOption: PaymentOption | null;
  isApplePaySupported: boolean;
  onSelect: (option: PaymentOption) => void;
  onClose: () => void;
}

export default function PaymentMethodModal({
  visible,
  paymentMethods,
  selectedPaymentOption,
  isApplePaySupported,
  onSelect,
  onClose,
}: PaymentMethodModalProps): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Payment Method</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScrollView}>
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
                    onSelect(option);
                    onClose();
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

            <TouchableOpacity
              style={[
                styles.modalCardOption,
                selectedPaymentOption?.type === 'addNew' && styles.modalCardOptionSelected,
              ]}
              onPress={() => {
                onSelect({ id: 'addNew', type: 'addNew', label: 'Add New Card' });
                onClose();
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

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[
                  styles.modalCardOption,
                  selectedPaymentOption?.type === 'applePay' && styles.modalCardOptionSelected,
                  !isApplePaySupported && styles.modalCardOptionDisabled,
                ]}
                onPress={() => {
                  if (isApplePaySupported) {
                    onSelect({ id: 'applePay', type: 'applePay', label: 'Apple Pay' });
                    onClose();
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
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalCardOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  modalCardOptionSelected: {
    backgroundColor: '#2A2A2C',
  },
  modalCardOptionDisabled: {
    opacity: 0.5,
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  modalCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  modalCardTextSelected: {
    fontWeight: '600',
    color: '#4285F4',
  },
  modalCardTextDisabled: {
    color: '#666666',
  },
  modalCardName: {
    fontSize: 13,
    fontWeight: '400',
    color: '#CCCCCC',
    marginTop: 2,
  },
});

