import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface RideActionsProps {
  rideStatus: string;
  allPassengersPickedUp: boolean;
  onStartRide: () => void;
  onCompleteRide: () => void;
  onCancelRide: () => void;
  onOpenNavigation: () => void;
  isLoading?: boolean;
}

export const RideActions: React.FC<RideActionsProps> = ({
  rideStatus,
  allPassengersPickedUp,
  onStartRide,
  onCompleteRide,
  onCancelRide,
  onOpenNavigation,
  isLoading = false,
}) => {
  const handleEmergency = () => {
    Alert.alert(
      'Emergency / Help',
      'Choose an option:',
      [
        {
          text: 'Call 911',
          onPress: () => Linking.openURL('tel:911'),
        },
        {
          text: 'Contact Support',
          onPress: () => Linking.openURL('tel:+1234567890'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Start Ride Button */}
      {rideStatus === 'scheduled' && (
        <TouchableOpacity
          style={[styles.primaryButton, styles.startButton]}
          onPress={onStartRide}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <IconSymbol size={20} name="play.fill" color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Start Ride</Text>
        </TouchableOpacity>
      )}

      {/* Complete Ride Button */}
      {rideStatus === 'in-progress' && allPassengersPickedUp && (
        <TouchableOpacity
          style={[styles.primaryButton, styles.completeButton]}
          onPress={onCompleteRide}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <IconSymbol size={20} name="checkmark.circle.fill" color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Complete Ride</Text>
        </TouchableOpacity>
      )}

      {/* Navigation Button */}
      {rideStatus === 'in-progress' && (
        <TouchableOpacity
          style={[styles.secondaryButton, styles.navigationButton]}
          onPress={onOpenNavigation}
          activeOpacity={0.7}
        >
          <IconSymbol size={20} name="map.fill" color="#4285F4" />
          <Text style={styles.secondaryButtonText}>Open Navigation</Text>
        </TouchableOpacity>
      )}

      {/* Cancel & Emergency Buttons */}
      {rideStatus !== 'cancelled' && rideStatus !== 'completed' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancelRide}
            activeOpacity={0.7}
          >
            <IconSymbol size={18} name="xmark.circle.fill" color="#FF3B30" />
            <Text style={styles.cancelButtonText}>Cancel Ride</Text>
          </TouchableOpacity>

          {rideStatus === 'in-progress' && (
            <TouchableOpacity
              style={styles.emergencyButton}
              onPress={handleEmergency}
              activeOpacity={0.7}
            >
              <IconSymbol size={20} name="exclamationmark.triangle.fill" color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 16,
  },
  startButton: {
    backgroundColor: '#34C759',
  },
  completeButton: {
    backgroundColor: '#4285F4',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 2,
  },
  navigationButton: {
    borderColor: '#4285F4',
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
  emergencyButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FF3B30',
  },
});





