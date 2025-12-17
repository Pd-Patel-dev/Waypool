import React, { useState, useEffect, useRef } from 'react';
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
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
// TEMP DISABLED - Rebuilding app
// import { IconSymbol } from '@/components/ui/icon-symbol';
import { signup, checkEmail, type ApiError } from '@/services/api';
import { US_STATES_CITIES, getCitiesByState, getStateNames } from '@/data/usStatesCities';
import CustomDropdown from '@/components/CustomDropdown';

export default function SignupScreen(): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [carMake, setCarMake] = useState<string>('');
  const [carModel, setCarModel] = useState<string>('');
  const [carYear, setCarYear] = useState<string>('');
  const [carColor, setCarColor] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

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
    general?: string;
  }>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState<boolean>(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const emailCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkEmailAvailability = async (emailValue: string): Promise<void> => {
    if (!emailValue.trim() || !validateEmail(emailValue)) {
      return;
    }

    setIsCheckingEmail(true);
    try {
      const response = await checkEmail(emailValue.trim());
      if (!response.available) {
        setErrors((prev) => ({
          ...prev,
          email: 'This email is already registered. Please use a different email.',
        }));
      } else {
        // Clear email error if email is available
        setErrors((prev) => {
          const newErrors = { ...prev };
          if (newErrors.email && newErrors.email.includes('already registered')) {
            delete newErrors.email;
          }
          return newErrors;
        });
      }
    } catch (error) {
      // Silently fail - don't show error for real-time check
      console.error('Email check error:', error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Debounced email check
  useEffect(() => {
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current);
    }

    if (email.trim() && validateEmail(email)) {
      emailCheckTimeoutRef.current = setTimeout(() => {
        checkEmailAvailability(email);
      }, 800); // Wait 800ms after user stops typing
    }

    return () => {
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Update cities when state changes
  useEffect(() => {
    if (selectedState) {
      const cities = getCitiesByState(selectedState);
      setAvailableCities(cities);
      setSelectedCity(''); // Reset city when state changes
    } else {
      setAvailableCities([]);
      setSelectedCity('');
    }
  }, [selectedState]);

  const validateStep1 = (): boolean => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.trim().length < 10) {
      newErrors.phoneNumber = 'Enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: typeof errors = {};

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

  const validateStep3 = (): boolean => {
    const newErrors: typeof errors = {};

    // TEMP: Skip photo validation during rebuild
    // if (!selectedImage) {
    //   newErrors.photoUrl = 'Profile photo is required';
    // }

    if (!selectedState) {
      newErrors.state = 'State is required';
    }

    if (!selectedCity) {
      newErrors.city = 'City is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  const validateStep4 = (): boolean => {
    const newErrors: typeof errors = {};

    if (!carMake || !carMake.trim()) {
      newErrors.carMake = 'Car make is required';
    }

    if (!carModel || !carModel.trim()) {
      newErrors.carModel = 'Car model is required';
    }

    if (!carYear || !carYear.trim()) {
      newErrors.carYear = 'Car year is required';
    } else if (carYear.trim().length !== 4) {
      newErrors.carYear = 'Car year must be 4 digits';
    }

    if (!carColor || !carColor.trim()) {
      newErrors.carColor = 'Car color is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = (): void => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
      setErrors({});
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
      setErrors({});
    } else if (currentStep === 3 && validateStep3()) {
      setCurrentStep(4);
      setErrors({});
    }
  };

  const handleBack = (): void => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setErrors({});
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setErrors({});
    } else if (currentStep === 4) {
      setCurrentStep(3);
      setErrors({});
    }
  };

  const handleSignup = async (): Promise<void> => {
    if (!validateStep4()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const cityValue = selectedState && selectedCity 
        ? `${selectedCity}, ${selectedState}`
        : '';

      const response = await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
        photoUrl: photoUrl.trim(),
        city: cityValue,
        carMake: carMake.trim(),
        carModel: carModel.trim(),
        carYear: parseInt(carYear.trim(), 10),
        carColor: carColor.trim(),
      });

      if (response.success) {
        // Navigate to Login screen on success
        router.push('/login');
      } else {
        setErrors({
          general: response.message || 'Something went wrong. Please try again.',
        });
      }
    } catch (error) {
      const apiError = error as ApiError;
      
      // Check if it's an email already exists error
      if (apiError.message && apiError.message.toLowerCase().includes('email already exists')) {
        setErrors({
          email: 'This email is already registered. Please use a different email or log in.',
        });
        // Go back to step 1 to show the error
        setCurrentStep(1);
      } else if (apiError.errors && apiError.errors.length > 0) {
        // Map API errors to form errors
        const newErrors: typeof errors = {};
        apiError.errors.forEach((err) => {
          if (err.toLowerCase().includes('name')) {
            newErrors.fullName = err;
          } else if (err.toLowerCase().includes('email')) {
            newErrors.email = err;
          } else if (err.toLowerCase().includes('phone')) {
            newErrors.phoneNumber = err;
          } else if (err.toLowerCase().includes('photo')) {
            newErrors.photoUrl = err;
          } else if (err.toLowerCase().includes('city')) {
            newErrors.city = err;
          } else if (err.toLowerCase().includes('password')) {
            newErrors.password = err;
          }
        });
        setErrors(newErrors);
        // If email error, go back to step 1
        if (newErrors.email) {
          setCurrentStep(1);
        }
      } else {
        setErrors({
          general: apiError.message || 'Something went wrong. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateToLogin = (): void => {
    router.push('/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Create your driver account</Text>
              <Text style={styles.subtitle}>
                {currentStep === 1
                  ? 'Enter your basic information to get started.'
                  : currentStep === 2
                  ? 'Create a secure password for your account.'
                  : currentStep === 3
                  ? 'Complete your profile setup.'
                  : 'Add your vehicle information.'}
              </Text>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, currentStep === 1 && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep === 2 && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep === 3 && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep === 4 && styles.stepDotActive]} />
              </View>
            </View>

            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}

            <View style={styles.form}>
              {currentStep === 1 ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Full Name <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.fullName && styles.inputError]}
                        placeholder="Enter your full name"
                        placeholderTextColor="#666"
                        value={fullName}
                        onChangeText={(text) => {
                          setFullName(text);
                          if (errors.fullName) {
                            setErrors({ ...errors, fullName: undefined });
                          }
                        }}
                        editable={!isLoading}
                        autoCapitalize="words"
                      />
                    </View>
                    {errors.fullName && (
                      <Text style={styles.fieldError}>{errors.fullName}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Email <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        placeholder="Enter your email"
                        placeholderTextColor="#666"
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          // Clear error when user starts typing (but keep it if it's from real-time check)
                          if (errors.email && !errors.email.includes('already registered')) {
                            setErrors({ ...errors, email: undefined });
                          }
                        }}
                        editable={!isLoading}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {isCheckingEmail && (
                        <ActivityIndicator
                          size="small"
                          color="#FFFFFF"
                          style={styles.emailCheckIndicator}
                        />
                      )}
                    </View>
                    {errors.email && (
                      <Text style={styles.fieldError}>{errors.email}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Phone Number <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.phoneNumber && styles.inputError]}
                        placeholder="Enter your phone number"
                        placeholderTextColor="#666"
                        value={phoneNumber}
                        onChangeText={(text) => {
                          setPhoneNumber(text);
                          if (errors.phoneNumber) {
                            setErrors({ ...errors, phoneNumber: undefined });
                          }
                        }}
                        editable={!isLoading}
                        keyboardType="phone-pad"
                      />
                    </View>
                    {errors.phoneNumber && (
                      <Text style={styles.fieldError}>{errors.phoneNumber}</Text>
                    )}
                  </View>
                </>
              ) : currentStep === 2 ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Password <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.password && styles.inputError]}
                        placeholder="Enter your password"
                        placeholderTextColor="#666"
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          if (errors.password) {
                            setErrors({ ...errors, password: undefined });
                          }
                        }}
                        editable={!isLoading}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {errors.password && (
                      <Text style={styles.fieldError}>{errors.password}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Confirm Password <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.confirmPassword && styles.inputError]}
                        placeholder="Confirm your password"
                        placeholderTextColor="#666"
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          if (errors.confirmPassword) {
                            setErrors({ ...errors, confirmPassword: undefined });
                          }
                        }}
                        editable={!isLoading}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    {errors.confirmPassword && (
                      <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
                    )}
                  </View>
                </>
              ) : currentStep === 3 ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Profile Photo URL <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    
                    {photoUrl && (
                      <View style={styles.photoPreviewContainer}>
                        <Image source={{ uri: photoUrl }} style={styles.photoPreview} />
                      </View>
                    )}
                    
                    <TextInput
                      style={styles.input}
                      value={photoUrl}
                      onChangeText={(text) => {
                        setPhotoUrl(text);
                        if (errors.photoUrl) {
                          setErrors({ ...errors, photoUrl: undefined });
                        }
                      }}
                      placeholder="https://example.com/your-photo.jpg"
                      placeholderTextColor="#666666"
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                    
                    {errors.photoUrl && (
                      <Text style={styles.fieldError}>{errors.photoUrl}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      State <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <CustomDropdown
                      items={[
                        { label: 'Select a state', value: '' },
                        ...getStateNames().map((state) => ({ label: state, value: state })),
                      ]}
                      selectedValue={selectedState}
                      onValueChange={(value) => {
                        setSelectedState(value);
                        if (errors.state) {
                          setErrors({ ...errors, state: undefined });
                        }
                      }}
                      placeholder="Select a state"
                      enabled={!isLoading}
                      error={errors.state}
                    />
                    {errors.state && (
                      <Text style={styles.fieldError}>{errors.state}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      City <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <CustomDropdown
                      items={[
                        {
                          label: selectedState ? 'Select a city' : 'Select a state first',
                          value: '',
                        },
                        ...availableCities.map((city) => ({ label: city, value: city })),
                      ]}
                      selectedValue={selectedCity}
                      onValueChange={(value) => {
                        setSelectedCity(value);
                        if (errors.city) {
                          setErrors({ ...errors, city: undefined });
                        }
                      }}
                      placeholder={selectedState ? 'Select a city' : 'Select a state first'}
                      enabled={!isLoading && !!selectedState}
                      error={errors.city}
                    />
                    {errors.city && (
                      <Text style={styles.fieldError}>{errors.city}</Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Car Make <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.carMake && styles.inputError]}
                        placeholder="e.g., Toyota, Honda, Ford"
                        placeholderTextColor="#666"
                        value={carMake}
                        onChangeText={(text) => {
                          setCarMake(text);
                          if (errors.carMake) {
                            setErrors({ ...errors, carMake: undefined });
                          }
                        }}
                        editable={!isLoading}
                        autoCapitalize="words"
                      />
                    </View>
                    {errors.carMake && (
                      <Text style={styles.fieldError}>{errors.carMake}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Car Model <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.carModel && styles.inputError]}
                        placeholder="e.g., Camry, Accord, F-150"
                        placeholderTextColor="#666"
                        value={carModel}
                        onChangeText={(text) => {
                          setCarModel(text);
                          if (errors.carModel) {
                            setErrors({ ...errors, carModel: undefined });
                          }
                        }}
                        editable={!isLoading}
                        autoCapitalize="words"
                      />
                    </View>
                    {errors.carModel && (
                      <Text style={styles.fieldError}>{errors.carModel}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Car Year <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.carYear && styles.inputError]}
                        placeholder="e.g., 2020"
                        placeholderTextColor="#666"
                        value={carYear}
                        onChangeText={(text) => {
                          // Only allow numbers
                          const numericValue = text.replace(/[^0-9]/g, '');
                          setCarYear(numericValue);
                          if (errors.carYear) {
                            setErrors({ ...errors, carYear: undefined });
                          }
                        }}
                        editable={!isLoading}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                    </View>
                    {errors.carYear && (
                      <Text style={styles.fieldError}>{errors.carYear}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Car Color <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, errors.carColor && styles.inputError]}
                        placeholder="e.g., Black, White, Red"
                        placeholderTextColor="#666"
                        value={carColor}
                        onChangeText={(text) => {
                          setCarColor(text);
                          if (errors.carColor) {
                            setErrors({ ...errors, carColor: undefined });
                          }
                        }}
                        editable={!isLoading}
                        autoCapitalize="words"
                      />
                    </View>
                    {errors.carColor && (
                      <Text style={styles.fieldError}>{errors.carColor}</Text>
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={styles.footer}>
              {currentStep === 1 ? (
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                  onPress={handleNext}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Next</Text>
                </TouchableOpacity>
              ) : currentStep === 2 ? (
                <>
                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleNext}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleBack}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                </>
              ) : currentStep === 3 ? (
                <>
                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleNext}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleBack}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleSignup}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Sign up</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleBack}
                    disabled={isLoading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.loginLink}
                onPress={handleNavigateToLogin}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account? Log in
                </Text>
              </TouchableOpacity>
            </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#E5E5E5',
    opacity: 0.9,
    lineHeight: 22,
    marginBottom: 24,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2C2C2E',
  },
  stepDotActive: {
    backgroundColor: '#FFFFFF',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#2C2C2E',
    marginHorizontal: 8,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 56,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  emailCheckIndicator: {
    position: 'absolute',
    right: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  fieldError: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 6,
  },
  footer: {
    marginTop: 'auto',
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    width: '100%',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#1C1C1E',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginLinkText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  photoPickerContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
  },
  selectedImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2C2C2E',
    borderWidth: 3,
    borderColor: '#3A3A3C',
  },
  photoPreviewContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2C2C2E',
    borderWidth: 2,
    borderColor: '#3A3A3C',
  },
});

