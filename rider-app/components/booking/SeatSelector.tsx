import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface SeatSelectorProps {
  numberOfSeats: number;
  availableSeats: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export default function SeatSelector({
  numberOfSeats,
  availableSeats,
  onIncrement,
  onDecrement,
}: SeatSelectorProps): React.JSX.Element {
  return (
    <View style={styles.seatSection}>
      <Text style={styles.sectionLabel}>Seats</Text>
      <View style={styles.seatSelector}>
        <TouchableOpacity
          style={[styles.seatButton, numberOfSeats <= 1 && styles.seatButtonDisabled]}
          onPress={onDecrement}
          disabled={numberOfSeats <= 1}
        >
          <IconSymbol name="minus" size={16} color={numberOfSeats <= 1 ? '#666666' : '#FFFFFF'} />
        </TouchableOpacity>
        <Text style={styles.seatCount}>{numberOfSeats}</Text>
        <TouchableOpacity
          style={[styles.seatButton, numberOfSeats >= availableSeats && styles.seatButtonDisabled]}
          onPress={onIncrement}
          disabled={numberOfSeats >= availableSeats}
        >
          <IconSymbol name="plus" size={16} color={numberOfSeats >= availableSeats ? '#666666' : '#FFFFFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  seatSection: {
    flex: 1,
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
});

