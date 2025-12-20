/**
 * Payout Onboarding Screen
 * In-app onboarding for Stripe Connect Express accounts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import {
  createConnectAccount,
  updatePayoutAccount,
  createBankAccountToken,
  getAccountRequirements,
  getAccountStatus,
} from '@/services/api';
import { LoadingScreen } from '@/components/LoadingScreen';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';

interface FormErrors {
  ssnLast4?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountHolderName?: string;
  accountType?: string;
}

export default function PayoutOnboardingScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Personal Info, 2: Bank Account

  // Personal Information
  const [ssnLast4, setSsnLast4] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Bank Account Information
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    // Ensure account exists
    const ensureAccount = async () => {
      if (!user?.id) return;

      try {
        const status = await getAccountStatus(user.id);
        if (!status.hasAccount) {
          // Create account if it doesn't exist
          await createConnectAccount(user.id);
        }
      } catch (error) {
        console.error('Error ensuring account:', error);
      } finally {
        setLoading(false);
      }
    };

    ensureAccount();
  }, [user?.id]);

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};

    // SSN Last 4
    if (!ssnLast4.trim()) {
      newErrors.ssnLast4 = 'SSN last 4 digits are required';
    } else if (!/^\d{4}$/.test(ssnLast4.trim())) {
      newErrors.ssnLast4 = 'Please enter 4 digits';
    }

    // Date of Birth
    if (!dob.trim()) {
      newErrors.dob = 'Date of birth is required';
    } else {
      const dobDate = new Date(dob);
      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      if (isNaN(dobDate.getTime()) || age < 18 || age > 120) {
        newErrors.dob = 'Please enter a valid date (must be 18+)';
      }
    }

    // Address
    if (!address.trim()) {
      newErrors.address = 'Street address is required';
    }

    // City
    if (!city.trim()) {
      newErrors.city = 'City is required';
    }

    // State
    if (!state.trim()) {
      newErrors.state = 'State is required';
    } else if (state.trim().length !== 2) {
      newErrors.state = 'Please enter 2-letter state code (e.g., NY, CA)';
    }

    // Postal Code
    if (!postalCode.trim()) {
      newErrors.postalCode = 'ZIP code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(postalCode.trim())) {
      newErrors.postalCode = 'Please enter a valid ZIP code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};

    // Routing Number
    if (!routingNumber.trim()) {
      newErrors.routingNumber = 'Routing number is required';
    } else {
      const cleaned = routingNumber.replace(/\D/g, '');
      if (cleaned.length !== 9) {
        newErrors.routingNumber = 'Routing number must be exactly 9 digits';
      }
    }

    // Account Number
    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (accountNumber.trim().length < 4) {
      newErrors.accountNumber = 'Please enter a valid account number';
    }

    // Account Holder Name
    if (!accountHolderName.trim()) {
      newErrors.accountHolderName = 'Account holder name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    if (!validateStep2()) {
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Create bank account token
      const bankTokenResult = await createBankAccountToken(user.id, {
        accountNumber: accountNumber.trim(),
        routingNumber: routingNumber.trim(),
        accountHolderName: accountHolderName.trim(),
        accountType: accountType,
      });

      // Step 2: Link bank account only (individual info cannot be updated via API)
      const updateResult = await updatePayoutAccount(user.id, {
        // Note: Individual info (SSN, DOB, address) cannot be updated via API for Express accounts
        // We can only link the bank account via API
        bankAccountToken: bankTokenResult.token,
      });

      // Step 4: Check if complete
      const requirements = await getAccountRequirements(user.id);

      if (updateResult.payoutsEnabled) {
        Alert.alert(
          'Success!',
          'Your account has been set up successfully. You can now receive payouts!',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/payouts'),
            },
          ]
        );
      } else if (requirements.currentlyDue.length > 0) {
        Alert.alert(
          'Almost There!',
          `Your bank account has been linked. Stripe may need to verify some details:\n\n${requirements.currentlyDue.join(', ')}\n\nYou'll be notified when verification is complete.`,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/payouts'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Bank Account Linked!',
          'Your bank account has been linked successfully. Stripe will verify your account, which may take 1-2 business days.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/payouts'),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', getUserFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Setting up your account..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBack} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentStep === 1 ? 'Personal Information' : 'Bank Account'}
        </Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressStep, currentStep >= 1 && styles.progressStepActive]} />
        <View style={[styles.progressLine, currentStep >= 2 && styles.progressLineActive]} />
        <View style={[styles.progressStep, currentStep >= 2 && styles.progressStepActive]} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 1 ? (
          // Personal Information Step
          <View style={styles.stepContainer}>
            <Text style={styles.stepDescription}>
              We need some personal information to verify your identity for payouts.
            </Text>

            {/* SSN Last 4 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                SSN Last 4 Digits <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.ssnLast4 && styles.inputError]}
                placeholder="1234"
                placeholderTextColor="#666666"
                value={ssnLast4}
                onChangeText={(text) => {
                  setSsnLast4(text.replace(/\D/g, '').slice(0, 4));
                  if (errors.ssnLast4) {
                    setErrors({ ...errors, ssnLast4: undefined });
                  }
                }}
                keyboardType="number-pad"
                maxLength={4}
              />
              {errors.ssnLast4 && <Text style={styles.errorText}>{errors.ssnLast4}</Text>}
            </View>

            {/* Date of Birth */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Date of Birth <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.dob && styles.inputError]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#666666"
                value={dob}
                onChangeText={(text) => {
                  setDob(text);
                  if (errors.dob) {
                    setErrors({ ...errors, dob: undefined });
                  }
                }}
                keyboardType="default"
              />
              {errors.dob && <Text style={styles.errorText}>{errors.dob}</Text>}
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Street Address <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.address && styles.inputError]}
                placeholder="123 Main St"
                placeholderTextColor="#666666"
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  if (errors.address) {
                    setErrors({ ...errors, address: undefined });
                  }
                }}
              />
              {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
            </View>

            {/* City */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                City <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="New York"
                placeholderTextColor="#666666"
                value={city}
                onChangeText={(text) => {
                  setCity(text);
                  if (errors.city) {
                    setErrors({ ...errors, city: undefined });
                  }
                }}
              />
              {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
            </View>

            {/* State and ZIP Row */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>
                  State <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.state && styles.inputError]}
                  placeholder="NY"
                  placeholderTextColor="#666666"
                  value={state}
                  onChangeText={(text) => {
                    setState(text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2));
                    if (errors.state) {
                      setErrors({ ...errors, state: undefined });
                    }
                  }}
                  maxLength={2}
                  autoCapitalize="characters"
                />
                {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>
                  ZIP Code <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.postalCode && styles.inputError]}
                  placeholder="10001"
                  placeholderTextColor="#666666"
                  value={postalCode}
                  onChangeText={(text) => {
                    setPostalCode(text.replace(/\D/g, '').slice(0, 10));
                    if (errors.postalCode) {
                      setErrors({ ...errors, postalCode: undefined });
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={10}
                />
                {errors.postalCode && <Text style={styles.errorText}>{errors.postalCode}</Text>}
              </View>
            </View>

            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              disabled={submitting}
            >
              <Text style={styles.nextButtonText}>Next: Bank Account</Text>
              <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          // Bank Account Step
          <View style={styles.stepContainer}>
            <Text style={styles.stepDescription}>
              Link your bank account to receive payouts. Your information is encrypted and secure.
            </Text>

            {/* Account Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Account Type <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    accountType === 'checking' && styles.radioOptionSelected,
                  ]}
                  onPress={() => setAccountType('checking')}
                >
                  <View style={styles.radio}>
                    {accountType === 'checking' && <View style={styles.radioSelected} />}
                  </View>
                  <Text
                    style={[
                      styles.radioLabel,
                      accountType === 'checking' && styles.radioLabelSelected,
                    ]}
                  >
                    Checking
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    accountType === 'savings' && styles.radioOptionSelected,
                  ]}
                  onPress={() => setAccountType('savings')}
                >
                  <View style={styles.radio}>
                    {accountType === 'savings' && <View style={styles.radioSelected} />}
                  </View>
                  <Text
                    style={[
                      styles.radioLabel,
                      accountType === 'savings' && styles.radioLabelSelected,
                    ]}
                  >
                    Savings
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Routing Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Routing Number <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.routingNumber && styles.inputError]}
                placeholder="110000000 (test: 110000000)"
                placeholderTextColor="#666666"
                value={routingNumber}
                onChangeText={(text) => {
                  setRoutingNumber(text.replace(/\D/g, '').slice(0, 9));
                  if (errors.routingNumber) {
                    setErrors({ ...errors, routingNumber: undefined });
                  }
                }}
                keyboardType="number-pad"
                maxLength={9}
              />
              {errors.routingNumber && (
                <Text style={styles.errorText}>{errors.routingNumber}</Text>
              )}
              <Text style={styles.helperText}>
                For testing, use: 110000000
              </Text>
            </View>

            {/* Account Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Account Number <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.accountNumber && styles.inputError]}
                placeholder="000123456789"
                placeholderTextColor="#666666"
                value={accountNumber}
                onChangeText={(text) => {
                  setAccountNumber(text.replace(/\D/g, ''));
                  if (errors.accountNumber) {
                    setErrors({ ...errors, accountNumber: undefined });
                  }
                }}
                keyboardType="number-pad"
                secureTextEntry
              />
              {errors.accountNumber && (
                <Text style={styles.errorText}>{errors.accountNumber}</Text>
              )}
            </View>

            {/* Account Holder Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Account Holder Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.accountHolderName && styles.inputError]}
                placeholder="John Doe"
                placeholderTextColor="#666666"
                value={accountHolderName}
                onChangeText={(text) => {
                  setAccountHolderName(text);
                  if (errors.accountHolderName) {
                    setErrors({ ...errors, accountHolderName: undefined });
                  }
                }}
                autoCapitalize="words"
              />
              {errors.accountHolderName && (
                <Text style={styles.errorText}>{errors.accountHolderName}</Text>
              )}
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backButtonStep}
                onPress={handleBack}
                disabled={submitting}
              >
                <IconSymbol name="chevron.left" size={20} color="#4285F4" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Complete Setup</Text>
                    <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  progressStep: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2C2C2E',
  },
  progressStepActive: {
    backgroundColor: '#4285F4',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#2C2C2E',
  },
  progressLineActive: {
    backgroundColor: '#4285F4',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
    gap: 20,
  },
  stepDescription: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 20,
    marginBottom: 8,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: -4,
  },
  helperText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  radioOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  radioOptionSelected: {
    borderColor: '#4285F4',
    backgroundColor: '#1A237E',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4285F4',
  },
  radioLabel: {
    fontSize: 16,
    color: '#999999',
  },
  radioLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backButtonStep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4285F4',
    gap: 8,
    flex: 1,
  },
  backButtonText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    flex: 2,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

