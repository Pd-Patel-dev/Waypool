import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getRideById, updateRide, type Ride, type ApiError } from '@/services/api';
import { useUser } from '@/context/UserContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { validateDate, validateNumberRange, validatePrice } from '@/utils/validation';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';

export default function EditRideScreen(): React.JSX.Element {
  const { user } = useUser();
  const params = useLocalSearchParams();
  const rideId = params.rideId ? parseInt(params.rideId as string) : null;

  const [rideData, setRideData] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [departureDate, setDepartureDate] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>('');
  const [availableSeats, setAvailableSeats] = useState<string>('');
  const [pricePerSeat, setPricePerSeat] = useState<string>('');

  // Date and Time Picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());

  // Errors
  const [errors, setErrors] = useState<{
    departureDate?: string;
    departureTime?: string;
    availableSeats?: string;
    pricePerSeat?: string;
    general?: string;
  }>({});

  // Check if ride has bookings
  const hasBookings = rideData?.passengers && rideData.passengers.length > 0;

  // Fetch ride data
  useEffect(() => {
    const fetchRide = async () => {
      if (!rideId || !user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        if (!user?.id) {
          Alert.alert('Error', 'User session expired. Please login again.');
          setIsLoading(false);
          return;
        }
        const ride = await getRideById(rideId, user.id);
        setRideData(ride);

        // Pre-fill form with existing data
        if (ride.departureDate) {
          setDepartureDate(ride.departureDate);
          // Parse date string (MM/DD/YYYY)
          const dateParts = ride.departureDate.split('/');
          if (dateParts.length === 3) {
            const [month, day, year] = dateParts.map(Number);
            setSelectedDate(new Date(year, month - 1, day));
          }
        }

        if (ride.departureTimeString || ride.departureTime) {
          const timeStr = ride.departureTimeString || ride.departureTime;
          setDepartureTime(timeStr);
          // Parse time string (e.g., "2:30 PM")
          const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const meridiem = timeMatch[3].toUpperCase();
            if (meridiem === 'PM' && hours !== 12) hours += 12;
            if (meridiem === 'AM' && hours === 12) hours = 0;
            setSelectedTime(new Date(2000, 0, 1, hours, minutes));
          }
        }

        if (ride.availableSeats !== undefined) {
          setAvailableSeats(ride.availableSeats.toString());
        }

        if (ride.pricePerSeat !== undefined && ride.pricePerSeat !== null) {
          setPricePerSeat(ride.pricePerSeat.toString());
        }
      } catch (error) {
        const apiError = error as ApiError;
        const errorMessage = getUserFriendlyErrorMessage(apiError);
        Alert.alert('Error', errorMessage);
        router.back();
      } finally {
        setIsLoading(false);
      }
    };

    fetchRide();
  }, [rideId, user?.id]);

  // Format date for display
  const formatDate = (date: Date): string => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Format time for display
  const formatTime = (date: Date): string => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${meridiem}`;
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'ios') {
      if (date) {
        setSelectedDate(date);
        setDepartureDate(formatDate(date));
      }
    } else {
      setShowDatePicker(false);
      if (date) {
        setSelectedDate(date);
        setDepartureDate(formatDate(date));
      }
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'ios') {
      if (date) {
        setSelectedTime(date);
        setDepartureTime(formatTime(date));
      }
    } else {
      setShowTimePicker(false);
      if (date) {
        setSelectedTime(date);
        setDepartureTime(formatTime(date));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    const dateValidation = validateDate(departureDate, 'Departure date');
    if (!dateValidation.isValid) {
      newErrors.departureDate = dateValidation.error || 'Departure date is required';
    }

    if (!departureTime.trim()) {
      newErrors.departureTime = 'Departure time is required';
    }

    const seatsNum = availableSeats.trim();
    if (!seatsNum) {
      newErrors.availableSeats = 'Number of seats is required';
    } else {
      const seatsValidation = validateNumberRange(seatsNum, 1, 8, 'Number of seats');
      if (!seatsValidation.isValid) {
        newErrors.availableSeats = seatsValidation.error || 'Invalid number of seats';
      } else {
        // Check if trying to reduce seats below booked seats
        if (hasBookings && rideData && rideData.passengers) {
          const bookedSeats = rideData.passengers.reduce((sum, p) => {
            return sum + (p.numberOfSeats || 1);
          }, 0);
          const seats = parseInt(seatsNum, 10);
          if (seats < bookedSeats) {
            newErrors.availableSeats = `Cannot reduce seats below ${bookedSeats} (already booked)`;
          }
        }
      }
    }

    if (!pricePerSeat.trim()) {
      newErrors.pricePerSeat = 'Price per seat is required';
    } else {
      const priceValidation = validatePrice(pricePerSeat, 'Price per seat');
      if (!priceValidation.isValid) {
        newErrors.pricePerSeat = priceValidation.error || 'Invalid price';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user?.id || !rideId) {
      Alert.alert('Error', 'User session expired. Please login again.');
      return;
    }

    // Show warning if bookings exist
    if (hasBookings) {
      Alert.alert(
        'Ride Has Bookings',
        'This ride has active bookings. All passengers will be notified of the changes. Do you want to continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Continue',
            onPress: async () => {
              await performUpdate();
            },
          },
        ]
      );
    } else {
      await performUpdate();
    }
  };

  const performUpdate = async () => {
    setIsSaving(true);
    setErrors({});

    try {
      const updateData: any = {};

      if (departureDate !== rideData?.departureDate) {
        updateData.departureDate = departureDate;
      }

      if (departureTime !== (rideData?.departureTimeString || rideData?.departureTime)) {
        updateData.departureTime = departureTime;
      }

      if (parseFloat(pricePerSeat) !== rideData?.pricePerSeat) {
        updateData.pricePerSeat = parseFloat(pricePerSeat);
      }

      if (parseInt(availableSeats) !== rideData?.availableSeats) {
        updateData.availableSeats = parseInt(availableSeats);
      }

      if (Object.keys(updateData).length === 0) {
        Alert.alert('No Changes', 'No changes were made to the ride.');
        setIsSaving(false);
        return;
      }

      if (!user?.id) {
        Alert.alert('Error', 'User session expired. Please login again.');
        setIsSaving(false);
        return;
      }

      const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
      const response = await updateRide(rideId!, driverId, updateData);

      if (response.success) {
        Alert.alert(
          'Success',
          response.message || 'Ride updated successfully. All passengers have been notified.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      const apiError = error as ApiError;
      const errorMessage = getUserFriendlyErrorMessage(apiError);
      if (apiError.errors && apiError.errors.length > 0) {
        Alert.alert('Validation Error', apiError.errors.join('\n'));
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading ride details..." />;
  }

  if (!rideData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ride not found</Text>
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Ride</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Warning Banner */}
      {hasBookings && (
        <View style={styles.warningBanner}>
          <IconSymbol size={20} name="exclamationmark.triangle.fill" color="#FFD60A" />
          <Text style={styles.warningText}>
            This ride has {rideData.passengers?.length || 0} active booking(s). Passengers will be notified of any changes.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          
          {/* Route Info (Read-only) */}
          <View style={styles.routeCard}>
            <Text style={styles.routeLabel}>Route</Text>
            <Text style={styles.routeText}>
              {rideData.fromAddress} → {rideData.toAddress}
            </Text>
          </View>

          {/* Date Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Departure Date</Text>
            <TouchableOpacity
              style={[styles.input, errors.departureDate && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}>
              <Text style={[styles.inputText, !departureDate && styles.inputPlaceholder]}>
                {departureDate || 'Select date'}
              </Text>
              <IconSymbol size={20} name="calendar" color="#999999" />
            </TouchableOpacity>
            {errors.departureDate && (
              <Text style={styles.errorText}>{errors.departureDate}</Text>
            )}
          </View>

          {/* Time Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Departure Time</Text>
            <TouchableOpacity
              style={[styles.input, errors.departureTime && styles.inputError]}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}>
              <Text style={[styles.inputText, !departureTime && styles.inputPlaceholder]}>
                {departureTime || 'Select time'}
              </Text>
              <IconSymbol size={20} name="clock" color="#999999" />
            </TouchableOpacity>
            {errors.departureTime && (
              <Text style={styles.errorText}>{errors.departureTime}</Text>
            )}
          </View>

          {/* Available Seats Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Available Seats
              {hasBookings && (
                <Text style={styles.labelHint}>
                  {' '}(Min: {rideData.passengers?.reduce((sum, p) => sum + ((p as any).numberOfSeats || 1), 0) || 0})
                </Text>
              )}
            </Text>
            <TextInput
              style={[styles.input, errors.availableSeats && styles.inputError]}
              value={availableSeats}
              onChangeText={setAvailableSeats}
              placeholder="Enter number of seats (1-8)"
              placeholderTextColor="#666666"
              keyboardType="number-pad"
              editable={!hasBookings || true} // Can edit but with validation
            />
            {errors.availableSeats && (
              <Text style={styles.errorText}>{errors.availableSeats}</Text>
            )}
          </View>

          {/* Price Per Seat Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price Per Seat ($)</Text>
            <TextInput
              style={[styles.input, errors.pricePerSeat && styles.inputError]}
              value={pricePerSeat}
              onChangeText={setPricePerSeat}
              placeholder="Enter price per seat"
              placeholderTextColor="#666666"
              keyboardType="decimal-pad"
            />
            {errors.pricePerSeat && (
              <Text style={styles.errorText}>{errors.pricePerSeat}</Text>
            )}
          </View>

          {errors.general && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.7}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal (iOS) */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.modalButton}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity
                  onPress={() => {
                    setDepartureDate(formatDate(selectedDate));
                    setShowDatePicker(false);
                  }}
                  style={styles.modalButton}>
                  <Text style={[styles.modalButtonText, styles.modalButtonPrimary]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={new Date()}
                textColor="#FFFFFF"
                themeVariant="dark"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker Modal (iOS) */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
                  style={styles.modalButton}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Time</Text>
                <TouchableOpacity
                  onPress={() => {
                    setDepartureTime(formatTime(selectedTime));
                    setShowTimePicker(false);
                  }}
                  style={styles.modalButton}>
                  <Text style={[styles.modalButtonText, styles.modalButtonPrimary]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                textColor="#FFFFFF"
                themeVariant="dark"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android Date/Time Pickers */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#FFD60A',
    lineHeight: 18,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  routeCard: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  inputPlaceholder: {
    color: '#666666',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF3B30',
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF3B30',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#999999',
  },
  backButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999999',
  },
  modalButtonPrimary: {
    color: '#4285F4',
    fontWeight: '700',
  },
});

