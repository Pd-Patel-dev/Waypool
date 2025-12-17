import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Passenger } from '@/services/api';

interface PassengerListProps {
  passengers: Passenger[];
  driverLocation: { latitude: number; longitude: number } | null;
  onArrivedAtPickup: (bookingId: number, passengerName: string) => void;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export const PassengerList: React.FC<PassengerListProps> = ({
  passengers,
  driverLocation,
  onArrivedAtPickup,
  calculateDistance,
}) => {
  const handleCallPassenger = (phoneNumber: string) => {
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) return;
    const phoneUrl = Platform.OS === 'ios' ? `telprompt:${cleanPhone}` : `tel:${cleanPhone}`;
    Linking.openURL(phoneUrl).catch((err) => {
    });
  };

  const handleMessagePassenger = (phoneNumber: string) => {
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) return;
    const smsUrl = Platform.OS === 'ios' ? `sms:${cleanPhone}` : `sms:${cleanPhone}`;
    Linking.openURL(smsUrl).catch((err) => {
    });
  };

  const getProximityStatus = (passenger: Passenger) => {
    if (!passenger.pickupLatitude || !passenger.pickupLongitude || !driverLocation) {
      return { status: 'unknown', distance: null };
    }

    const distance = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      passenger.pickupLatitude,
      passenger.pickupLongitude
    );

    if (distance < 0.05) { // < 50 meters
      return { status: 'arrived', distance };
    } else if (distance < 0.12) { // < 120 meters
      return { status: 'near', distance };
    } else {
      return { status: 'far', distance };
    }
  };

  return (
    <View style={styles.passengerList}>
      <Text style={styles.passengerListTitle}>
        Passengers ({passengers.length})
      </Text>

      {passengers.map((passenger) => {
        const proximity = getProximityStatus(passenger);
        const isPickedUp = passenger.pickupStatus === 'picked_up';

        return (
          <View
            key={passenger.id}
            style={[
              styles.passengerCard,
              isPickedUp && styles.passengerCardPickedUp,
            ]}
          >
            <View style={styles.passengerHeader}>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>
                  {passenger.riderName || 'Passenger'}
                </Text>
                <Text style={styles.passengerSeats}>
                  {passenger.numberOfSeats || 1} seat{(passenger.numberOfSeats || 1) !== 1 ? 's' : ''}
                </Text>
              </View>

              {isPickedUp ? (
                <View style={styles.pickedUpBadge}>
                  <IconSymbol size={14} name="checkmark.circle.fill" color="#34C759" />
                  <Text style={styles.pickedUpText}>Picked Up</Text>
                </View>
              ) : (
                <View style={styles.pendingBadge}>
                  <IconSymbol size={14} name="clock.fill" color="#FF9500" />
                  <Text style={styles.pendingText}>Waiting</Text>
                </View>
              )}
            </View>

            <Text style={styles.passengerLocation}>
              📍 {passenger.pickupAddress}
              {passenger.pickupCity && `, ${passenger.pickupCity}`}
            </Text>

            {proximity.distance !== null && !isPickedUp && (
              <Text style={styles.passengerDistance}>
                {proximity.distance < 0.1
                  ? `${Math.round(proximity.distance * 5280)} ft away`
                  : `${proximity.distance.toFixed(2)} mi away`}
              </Text>
            )}

            {/* Contact Buttons */}
            {passenger.riderPhone && (
              <View style={styles.contactButtons}>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => {
                    if (passenger.riderPhone) {
                      handleCallPassenger(passenger.riderPhone);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol size={18} name="phone.fill" color="#4285F4" />
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => {
                    if (passenger.riderPhone) {
                      handleMessagePassenger(passenger.riderPhone);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <IconSymbol size={18} name="message.fill" color="#34C759" />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Arrived at Pickup Button */}
            {!isPickedUp && proximity.status !== 'unknown' && (
              <View style={styles.pickupButtonContainer}>
                {proximity.status === 'arrived' ? (
                  <TouchableOpacity
                    style={[styles.arrivedButton, styles.arrivedButtonSuccess]}
                    onPress={() => onArrivedAtPickup(passenger.id, passenger.riderName || 'Passenger')}
                    activeOpacity={0.7}
                  >
                    <IconSymbol size={18} name="checkmark.circle.fill" color="#FFFFFF" />
                    <Text style={styles.arrivedButtonText}>Arrived at Pickup</Text>
                  </TouchableOpacity>
                ) : proximity.status === 'near' ? (
                  <TouchableOpacity
                    style={[styles.arrivedButton, styles.arrivedButtonWarning]}
                    onPress={() => onArrivedAtPickup(passenger.id, passenger.riderName || 'Passenger')}
                    activeOpacity={0.7}
                  >
                    <IconSymbol size={18} name="clock.fill" color="#FFFFFF" />
                    <Text style={styles.arrivedButtonText}>Ready to Pickup</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  passengerList: {
    marginTop: 16,
    gap: 12,
  },
  passengerListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  passengerCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  passengerCardPickedUp: {
    backgroundColor: '#1E2F1E',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  passengerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passengerInfo: {
    flex: 1,
    gap: 4,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  passengerSeats: {
    fontSize: 14,
    color: '#8E8E93',
  },
  pickedUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pickedUpText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34C759',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9500',
  },
  passengerLocation: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  passengerDistance: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4285F4',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.3)',
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  pickupButtonContainer: {
    marginTop: 8,
  },
  arrivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  arrivedButtonSuccess: {
    backgroundColor: '#34C759',
  },
  arrivedButtonWarning: {
    backgroundColor: '#FF9500',
  },
  arrivedButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});





