import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface PINModalProps {
  visible: boolean;
  passengerName: string;
  isVerifying: boolean;
  onClose: () => void;
  onVerify: (pin: string) => Promise<void>;
}

export const PINModal: React.FC<PINModalProps> = ({
  visible,
  passengerName,
  isVerifying,
  onClose,
  onVerify,
}) => {
  const [pinInput, setPinInput] = useState('');

  const handlePinChange = (text: string) => {
    // Only allow numeric characters (0-9)
    const numericOnly = text.replace(/[^0-9]/g, '');
    // Limit to 4 digits
    if (numericOnly.length <= 4) {
      setPinInput(numericOnly);
    }
  };

  const handleVerify = async () => {
    if (pinInput.length !== 4) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit PIN');
      return;
    }
    await onVerify(pinInput);
    setPinInput('');
  };

  const handleClose = () => {
    setPinInput('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <IconSymbol size={48} name="lock.shield.fill" color="#4285F4" />
            <Text style={styles.modalTitle}>Enter Pickup PIN</Text>
            <Text style={styles.modalSubtitle}>
              Ask {passengerName} for their 4-digit PIN
            </Text>
          </View>

          <TextInput
            style={styles.pinInput}
            value={pinInput}
            onChangeText={handlePinChange}
            placeholder="0000"
            placeholderTextColor="#666666"
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            editable={!isVerifying}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isVerifying}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.verifyButton, isVerifying && styles.verifyButtonDisabled]}
              onPress={handleVerify}
              disabled={isVerifying}
              activeOpacity={0.7}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify PIN</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 20,
  },
  modalHeader: {
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  verifyButton: {
    flex: 1,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});





