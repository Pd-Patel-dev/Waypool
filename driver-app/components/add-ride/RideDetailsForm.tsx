import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface RideDetailsFormProps {
  availableSeats: string;
  pricePerSeat: string;
  onSeatsChange: (seats: string) => void;
  onPriceChange: (price: string) => void;
  errors?: {
    availableSeats?: string;
    pricePerSeat?: string;
  };
}

export const RideDetailsForm: React.FC<RideDetailsFormProps> = ({
  availableSeats,
  pricePerSeat,
  onSeatsChange,
  onPriceChange,
  errors = {},
}) => {
  // Predefined seat options
  const seatOptions = [1, 2, 3, 4, 5, 6];

  return (
    <View style={styles.container}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Available Seats <Text style={styles.required}>*</Text>
        </Text>
        
        <View style={styles.seatSelector}>
          {seatOptions.map((num) => (
            <TouchableOpacity
              key={num}
              style={[
                styles.seatButton,
                availableSeats === num.toString() && styles.seatButtonSelected,
              ]}
              onPress={() => onSeatsChange(num.toString())}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.seatButtonText,
                  availableSeats === num.toString() && styles.seatButtonTextSelected,
                ]}
              >
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {errors.availableSeats && (
          <Text style={styles.errorText}>{errors.availableSeats}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>
          Price per Seat <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.priceInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={[styles.priceInput, errors.pricePerSeat && styles.inputError]}
            value={pricePerSeat}
            onChangeText={onPriceChange}
            placeholder="0.00"
            placeholderTextColor="#666666"
            keyboardType="decimal-pad"
          />
        </View>
        {errors.pricePerSeat && (
          <Text style={styles.errorText}>{errors.pricePerSeat}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  required: {
    color: '#FF3B30',
  },
  seatSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  seatButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    borderWidth: 2,
    borderColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatButtonSelected: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  seatButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
  },
  seatButtonTextSelected: {
    color: '#FFFFFF',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 14,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
  },
});





