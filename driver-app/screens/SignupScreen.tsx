import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
import { CachedImage } from '@/components/CachedImage';
import { signup, checkEmail, type ApiError } from '@/services/api';
import { getCitiesByState, getStateNames } from '@/data/usStatesCities';
import CustomDropdown from '@/components/CustomDropdown';

// Import new components
import { StepIndicator, FormInput } from '@/components/signup';

export default function SignupScreen(): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState(1);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carColor, setCarColor] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    photoUrl?: string;
    state?: string;
    city?: string;
    carMake?: string;
    carModel?: string;
    carYear?: string;
    carColor?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const emailCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update cities when state changes
  useEffect(() => {
    if (selectedState) {
      const cities = getCitiesByState(selectedState);
      setAvailableCities(cities);
      setSelectedCity('');
    }
  }, [selectedState]);

  // Email validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Debounced email check
  useEffect(() => {
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current);
    }

    if (email && validateEmail(email)) {
      emailCheckTimeoutRef.current = setTimeout(async () => {
        setIsCheckingEmail(true);
        try {
          const response = await checkEmail(email.trim());
          // Handle both wrapped (data.available) and direct (available) response formats
          const isAvailable = response.data?.available ?? response.available ?? false;
          if (!isAvailable) {
            setErrors((prev) => ({
              ...prev,
              email: 'This email is already registered.',
            }));
          } else {
            setErrors((prev) => {
              const newErrors = { ...prev };
              if (newErrors.email?.includes('already registered')) {
                delete newErrors.email;
              }
              return newErrors;
            });
          }
        } catch {
        } finally {
          setIsCheckingEmail(false);
        }
      }, 500);
    }

    return () => {
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current);
      }
    };
  }, [email]);

  // Validation functions
  const validateStep1 = (): boolean => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (errors.email?.includes('already registered')) {
      // Don't allow proceeding if email is already registered as a driver
      newErrors.email = errors.email;
    }
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.replace(/\D/g, '').length !== 10) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: typeof errors = {};

    if (!selectedState) newErrors.state = 'State is required';
    if (!selectedCity) newErrors.city = 'City is required';
    if (!carMake.trim()) newErrors.carMake = 'Car make is required';
    if (!carModel.trim()) newErrors.carModel = 'Car model is required';
    if (!carYear.trim()) {
      newErrors.carYear = 'Car year is required';
    } else if (parseInt(carYear) < 1900 || parseInt(carYear) > new Date().getFullYear() + 1) {
      newErrors.carYear = 'Please enter a valid year';
    }
    if (!carColor.trim()) newErrors.carColor = 'Car color is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSignup = async () => {
    if (!photoUrl.trim()) {
      setErrors({ ...errors, photoUrl: 'Photo URL is required' });
      return;
    }

    setIsLoading(true);

    try {
      const signupData = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.replace(/\D/g, ''),
        password,
        photoUrl: photoUrl.trim(),
        city: selectedCity,
        carMake: carMake.trim(),
        carModel: carModel.trim(),
        carYear: parseInt(carYear.trim(), 10),
        carColor: carColor.trim(),
      };

      await signup(signupData);

      Alert.alert(
        'Success',
        'Your account has been created successfully!',
        [{ text: 'Login', onPress: () => router.replace('/login') }]
      );
    } catch (error: unknown) {
      let errorMessage = 'Failed to create account';
      
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = String(error.message);
        } else if ('errors' in error && Array.isArray(error.errors) && error.errors.length > 0) {
          errorMessage = error.errors.join('\n');
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles = ['Personal Info', 'Vehicle Info', 'Photo & Finish'];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => currentStep === 1 ? router.back() : handleBack()}
              activeOpacity={0.7}
            >
              <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Step Indicator */}
          <StepIndicator
            currentStep={currentStep}
            totalSteps={3}
            stepTitles={stepTitles}
          />

          {/* Step 1: Personal Info */}
          {currentStep === 1 && (
            <View style={styles.stepContent}>
              <FormInput
                label="Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                icon="person.fill"
                required
                error={errors.fullName}
              />

              <FormInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                icon="envelope.fill"
                required
                error={errors.email}
              />
              {isCheckingEmail && (
                <ActivityIndicator size="small" color="#4285F4" />
              )}

              <FormInput
                label="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                icon="phone.fill"
                required
                error={errors.phoneNumber}
              />

              <FormInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                icon="lock.fill"
                required
                error={errors.password}
              />

              <FormInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry
                icon="lock.fill"
                required
                error={errors.confirmPassword}
              />
            </View>
          )}

          {/* Step 2: Vehicle Info */}
          {currentStep === 2 && (
            <View style={styles.stepContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  State <Text style={styles.required}>*</Text>
                </Text>
                <CustomDropdown
                  items={getStateNames().map(state => ({ label: state, value: state }))}
                  selectedValue={selectedState}
                  onValueChange={setSelectedState}
                  placeholder="Select state"
                />
                {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  City <Text style={styles.required}>*</Text>
                </Text>
                <CustomDropdown
                  items={availableCities.map(city => ({ label: city, value: city }))}
                  selectedValue={selectedCity}
                  onValueChange={setSelectedCity}
                  placeholder="Select city"
                  enabled={!!selectedState}
                />
                {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
              </View>

              <FormInput
                label="Car Make"
                value={carMake}
                onChangeText={setCarMake}
                placeholder="Toyota, Honda, etc."
                icon="car.fill"
                required
                error={errors.carMake}
              />

              <FormInput
                label="Car Model"
                value={carModel}
                onChangeText={setCarModel}
                placeholder="Camry, Accord, etc."
                icon="car.fill"
                required
                error={errors.carModel}
              />

              <FormInput
                label="Car Year"
                value={carYear}
                onChangeText={setCarYear}
                placeholder="2020"
                keyboardType="number-pad"
                icon="calendar"
                required
                error={errors.carYear}
              />

              <FormInput
                label="Car Color"
                value={carColor}
                onChangeText={setCarColor}
                placeholder="Black, White, etc."
                icon="paintbrush.fill"
                required
                error={errors.carColor}
              />
            </View>
          )}

          {/* Step 3: Photo */}
          {currentStep === 3 && (
            <View style={styles.stepContent}>
              <FormInput
                label="Photo URL"
                value={photoUrl}
                onChangeText={setPhotoUrl}
                placeholder="https://example.com/photo.jpg"
                keyboardType="url"
                autoCapitalize="none"
                icon="camera.fill"
                required
                error={errors.photoUrl}
              />

              {photoUrl && (
                <View style={styles.photoPreview}>
                  <CachedImage
                    source={photoUrl}
                    style={styles.photoImage}
                    contentFit="cover"
                    placeholder="default"
                    priority="normal"
                    cachePolicy="disk"
                    onError={() => {
                      setErrors({ ...errors, photoUrl: 'Invalid photo URL' });
                    }}
                    accessibilityLabel="Profile photo preview"
                  />
                </View>
              )}

              <View style={styles.infoBox}>
                <IconSymbol size={20} name="info.circle.fill" color="#4285F4" />
                <Text style={styles.infoText}>
                  Please provide a URL to your profile photo. This will be visible to passengers.
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {currentStep < 3 ? (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                activeOpacity={0.7}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <IconSymbol size={20} name="chevron.right" color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.nextButton, isLoading && styles.nextButtonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.nextButtonText}>Sign Up</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.footerLink}>Login</Text>
            </TouchableOpacity>
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
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
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
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
  },
  photoPreview: {
    alignItems: 'center',
    marginVertical: 16,
  },
  photoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2C2C2E',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 16,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },
});
