import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface DateTimeSelectorProps {
  departureDate: string;
  departureTime: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  errors?: {
    departureDate?: string;
    departureTime?: string;
  };
}

export const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  departureDate,
  departureTime,
  onDateChange,
  onTimeChange,
  errors = {},
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Initialize date at midnight to avoid time comparison issues
  const getInitialDate = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  };
  
  const [selectedDate, setSelectedDate] = useState<Date>(getInitialDate());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());

  const getTodayAtMidnight = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const handleDateChange = (event: any, date?: Date) => {
    // On Android, close immediately when selected
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      
      if (date) {
        setSelectedDate(date);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
        });
        onDateChange(formattedDate);
        
        // Auto-advance to time picker
        setTimeout(() => setShowTimePicker(true), 300);
      }
    } else {
      // On iOS, just update the temporary selected date (not saved until Done is pressed)
      if (date) {
        setSelectedDate(date);
      }
    }
  };

  const handleDateDone = () => {
    // Save the selected date
    const formattedDate = selectedDate.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
    onDateChange(formattedDate);
    setShowDatePicker(false);
    
    // Auto-advance to time picker
    setTimeout(() => setShowTimePicker(true), 300);
  };

  const handleTimeChange = (event: any, time?: Date) => {
    // On Android, close immediately when selected
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      
      if (time) {
        setSelectedTime(time);
        const formattedTime = time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        onTimeChange(formattedTime);
      }
    } else {
      // On iOS, just update the temporary selected time (not saved until Done is pressed)
      if (time) {
        setSelectedTime(time);
      }
    }
  };

  const handleTimeDone = () => {
    // Save the selected time
    const formattedTime = selectedTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    onTimeChange(formattedTime);
    setShowTimePicker(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            Departure Date <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.pickerButton, errors.departureDate && styles.inputError]}
            onPress={() => {
              setShowTimePicker(false); // Close time picker if open
              setShowDatePicker(true);
            }}
            activeOpacity={0.7}
          >
            <IconSymbol size={18} name="calendar" color="#8E8E93" />
            <Text style={[styles.pickerText, !departureDate && styles.placeholderText]}>
              {departureDate || 'Select date'}
            </Text>
          </TouchableOpacity>
          {errors.departureDate && (
            <Text style={styles.errorText}>{errors.departureDate}</Text>
          )}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            Departure Time <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.pickerButton, errors.departureTime && styles.inputError]}
            onPress={() => {
              setShowDatePicker(false); // Close date picker if open
              setShowTimePicker(true);
            }}
            activeOpacity={0.7}
          >
            <IconSymbol size={18} name="clock" color="#8E8E93" />
            <Text style={[styles.pickerText, !departureTime && styles.placeholderText]}>
              {departureTime || 'Select time'}
            </Text>
          </TouchableOpacity>
          {errors.departureTime && (
            <Text style={styles.errorText}>{errors.departureTime}</Text>
          )}
        </View>
      </View>

      {/* Date Picker - iOS Modal with Done Button */}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity
                  onPress={handleDateDone}
                  style={styles.modalButton}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={getTodayAtMidnight()}
                themeVariant="dark"
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Date Picker - Android (no modal needed) */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={getTodayAtMidnight()}
        />
      )}

      {/* Time Picker - iOS Modal with Done Button */}
      {Platform.OS === 'ios' && showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Time</Text>
                <TouchableOpacity
                  onPress={handleTimeDone}
                  style={styles.modalButton}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                themeVariant="dark"
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker - Android (no modal needed) */}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
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
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  pickerText: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  placeholderText: {
    color: '#666666',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: -4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#4285F4',
  },
  modalButtonDone: {
    fontWeight: '700',
  },
  picker: {
    height: 200,
  },
});





