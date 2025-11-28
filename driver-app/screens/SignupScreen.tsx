import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { signup, type ApiError } from '@/services/api';

export default function SignupScreen(): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

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

  const handleNext = (): void => {
    if (validateStep1()) {
      setCurrentStep(2);
      setErrors({});
    }
  };

  const handleBack = (): void => {
    setCurrentStep(1);
    setErrors({});
  };

  const handleSignup = async (): Promise<void> => {
    if (!validateStep2()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
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
      if (apiError.errors && apiError.errors.length > 0) {
        // Map API errors to form errors
        const newErrors: typeof errors = {};
        apiError.errors.forEach((err) => {
          if (err.toLowerCase().includes('name')) {
            newErrors.fullName = err;
          } else if (err.toLowerCase().includes('email')) {
            newErrors.email = err;
          } else if (err.toLowerCase().includes('phone')) {
            newErrors.phoneNumber = err;
          } else if (err.toLowerCase().includes('password')) {
            newErrors.password = err;
          }
        });
        setErrors(newErrors);
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
                  : 'Create a secure password for your account.'}
              </Text>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, currentStep === 1 && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, currentStep === 2 && styles.stepDotActive]} />
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
                    <Text style={styles.label}>Full Name</Text>
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
                    {errors.fullName && (
                      <Text style={styles.fieldError}>{errors.fullName}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={[styles.input, errors.email && styles.inputError]}
                      placeholder="Enter your email"
                      placeholderTextColor="#666"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (errors.email) {
                          setErrors({ ...errors, email: undefined });
                        }
                      }}
                      editable={!isLoading}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {errors.email && (
                      <Text style={styles.fieldError}>{errors.email}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
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
                    {errors.phoneNumber && (
                      <Text style={styles.fieldError}>{errors.phoneNumber}</Text>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
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
                    {errors.password && (
                      <Text style={styles.fieldError}>{errors.password}</Text>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm Password</Text>
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
                    {errors.confirmPassword && (
                      <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
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
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    height: 56,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 0,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
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
});

