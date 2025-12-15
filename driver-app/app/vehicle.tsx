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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getVehicle, updateVehicle, type Vehicle, type ApiError } from '@/services/api';
import { useUser } from '@/context/UserContext';

export default function VehicleScreen(): React.JSX.Element {
  const { user, setUser } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [carMake, setCarMake] = useState<string>('');
  const [carModel, setCarModel] = useState<string>('');
  const [carYear, setCarYear] = useState<string>('');
  const [carColor, setCarColor] = useState<string>('');

  // Errors
  const [errors, setErrors] = useState<{
    carMake?: string;
    carModel?: string;
    carYear?: string;
    carColor?: string;
    general?: string;
  }>({});

  // Fetch vehicle data
  useEffect(() => {
    const fetchVehicle = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const vehicle = await getVehicle(user.id);
        
        setCarMake(vehicle.carMake || '');
        setCarModel(vehicle.carModel || '');
        setCarYear(vehicle.carYear ? vehicle.carYear.toString() : '');
        setCarColor(vehicle.carColor || '');
      } catch (error) {
        console.error('Error fetching vehicle:', error);
        const apiError = error as ApiError;
        Alert.alert('Error', apiError.message || 'Failed to load vehicle information. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVehicle();
  }, [user?.id]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!carMake.trim()) {
      newErrors.carMake = 'Car make is required';
    }

    if (!carModel.trim()) {
      newErrors.carModel = 'Car model is required';
    }

    if (!carYear.trim()) {
      newErrors.carYear = 'Car year is required';
    } else {
      const year = parseInt(carYear, 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(year) || year < 1900 || year > currentYear + 1) {
        newErrors.carYear = `Car year must be between 1900 and ${currentYear + 1}`;
      }
    }

    if (!carColor.trim()) {
      newErrors.carColor = 'Car color is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);
      setErrors({});

      const updateData = {
        carMake: carMake.trim(),
        carModel: carModel.trim(),
        carYear: parseInt(carYear, 10),
        carColor: carColor.trim(),
      };

      const response = await updateVehicle(user.id, updateData);

      if (response.success && response.vehicle) {
        // Update user context
        await setUser({
          ...user,
          carMake: response.vehicle.carMake,
          carModel: response.vehicle.carModel,
          carYear: response.vehicle.carYear,
          carColor: response.vehicle.carColor,
        });

        Alert.alert('Success', 'Vehicle information updated successfully', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error updating vehicle:', error);
      const apiError = error as ApiError;
      if (apiError.errors && apiError.errors.length > 0) {
        Alert.alert('Validation Error', apiError.errors.join('\n'));
      } else {
        Alert.alert('Error', apiError.message || 'Failed to update vehicle information. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Vehicle</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Vehicle</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Vehicle Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol size={20} name="car" color="#4285F4" />
              <Text style={styles.sectionTitle}>Vehicle Details</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Car Make</Text>
              <TextInput
                style={[styles.input, errors.carMake && styles.inputError]}
                value={carMake}
                onChangeText={(text) => {
                  setCarMake(text);
                  if (errors.carMake) {
                    setErrors({ ...errors, carMake: undefined });
                  }
                }}
                placeholder="e.g., Toyota, Honda, Ford"
                placeholderTextColor="#666666"
                autoCapitalize="words"
              />
              {errors.carMake && (
                <Text style={styles.errorText}>{errors.carMake}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Car Model</Text>
              <TextInput
                style={[styles.input, errors.carModel && styles.inputError]}
                value={carModel}
                onChangeText={(text) => {
                  setCarModel(text);
                  if (errors.carModel) {
                    setErrors({ ...errors, carModel: undefined });
                  }
                }}
                placeholder="e.g., Camry, Civic, F-150"
                placeholderTextColor="#666666"
                autoCapitalize="words"
              />
              {errors.carModel && (
                <Text style={styles.errorText}>{errors.carModel}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Car Year</Text>
              <TextInput
                style={[styles.input, errors.carYear && styles.inputError]}
                value={carYear}
                onChangeText={(text) => {
                  // Only allow numbers
                  const numericText = text.replace(/[^0-9]/g, '');
                  setCarYear(numericText);
                  if (errors.carYear) {
                    setErrors({ ...errors, carYear: undefined });
                  }
                }}
                placeholder="e.g., 2020"
                placeholderTextColor="#666666"
                keyboardType="number-pad"
                maxLength={4}
              />
              {errors.carYear && (
                <Text style={styles.errorText}>{errors.carYear}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Car Color</Text>
              <TextInput
                style={[styles.input, errors.carColor && styles.inputError]}
                value={carColor}
                onChangeText={(text) => {
                  setCarColor(text);
                  if (errors.carColor) {
                    setErrors({ ...errors, carColor: undefined });
                  }
                }}
                placeholder="e.g., Black, White, Red"
                placeholderTextColor="#666666"
                autoCapitalize="words"
              />
              {errors.carColor && (
                <Text style={styles.errorText}>{errors.carColor}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <IconSymbol size={18} name="info.circle" color="#4285F4" />
            <Text style={styles.infoText}>
              Your vehicle information will be displayed to passengers when they book a ride with you.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  section: {
    marginBottom: 24,
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 6,
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
    color: '#000000',
    letterSpacing: 0.3,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#999999',
    lineHeight: 18,
  },
});

