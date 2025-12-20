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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CachedImage } from '@/components/CachedImage';
import { LoadingScreen } from '@/components/LoadingScreen';
import { 
  getProfile, 
  updateProfile, 
  updatePassword, 
  getPreferences,
  updatePreferences,
  deleteAccount,
  type ApiError,
  type NotificationPreferences 
} from '@/services/api';
import { useUser } from '@/context/UserContext';
import { useFormValidation } from '@/hooks/useFormValidation';
import { validateRequired, validateEmail, validatePhoneNumber } from '@/utils/validation';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';

export default function ProfileScreen(): React.JSX.Element {
  const { user, setUser, logout } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Preferences
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    notifyBookings: true,
    notifyMessages: true,
    notifyRideUpdates: true,
    notifyPromotions: true,
    shareLocationEnabled: true,
  });

  // Form validation with real-time feedback
  const {
    errors,
    setErrors,
    clearErrors,
    validateField,
    validateAll,
    handleFieldChange: createFieldChangeHandler,
    handleFieldBlur: createFieldBlurHandler,
  } = useFormValidation({
    rules: {
      fullName: { required: true },
      email: { required: true, email: true },
      phoneNumber: { required: true, phoneNumber: true },
      city: { required: false },
      photoUrl: { required: false },
      currentPassword: { required: false },
      newPassword: { required: false },
      confirmPassword: { required: false },
    },
    validateOnChange: true,
    validateOnBlur: true,
    validateOnMount: false,
  });

  // Fetch profile data and preferences
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Fetch profile
        const profile = await getProfile(user.id);
        setFullName(profile.fullName || '');
        setEmail(profile.email || '');
        setPhoneNumber(profile.phoneNumber || '');
        setCity(profile.city || '');
        // Set photoUrl - use profile photoUrl or fallback to user context photoUrl
        const profilePhotoUrl = profile.photoUrl && profile.photoUrl.trim() ? profile.photoUrl.trim() : '';
        const userPhotoUrl = user?.photoUrl && user.photoUrl.trim() ? user.photoUrl.trim() : '';
        setPhotoUrl(profilePhotoUrl || userPhotoUrl || '');

        // Fetch preferences
        try {
          const prefsResponse = await getPreferences(user.id);
          if (prefsResponse.success) {
            setPreferences(prefsResponse.preferences);
          }
        } catch {
          // Use defaults if preferences not found
        }
      } catch (error) {
        const apiError = error as ApiError;
        const errorMessage = getUserFriendlyErrorMessage(apiError);
        Alert.alert('Error', errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.id]);

  const validateForm = (): boolean => {
    // Use the validation hook's validateAll function
    return validateAll({
      fullName,
      email,
      phoneNumber,
      city,
      photoUrl,
    });
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
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        city: city.trim() || undefined,
      };

      const response = await updateProfile(user.id, updateData);

      if (response.success && response.user) {
        // Update user context - preserve all existing fields and update changed ones
        await setUser({
          ...user,
          fullName: response.user.fullName,
          email: response.user.email,
          phoneNumber: response.user.phoneNumber,
          city: response.user.city,
          photoUrl: response.user.photoUrl,
          updatedAt: response.user.updatedAt,
        });

        Alert.alert('Success', 'Profile updated successfully', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
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

  const validatePasswordForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    if (!validatePasswordForm()) {
      return;
    }

    try {
      setIsChangingPassword(true);
      setErrors({});

      const response = await updatePassword(user.id, {
        currentPassword,
        newPassword,
      });

      if (response.success) {
        Alert.alert('Success', 'Password updated successfully', [
          {
            text: 'OK',
            onPress: () => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]);
      }
    } catch (error) {
      const apiError = error as ApiError;
      Alert.alert('Error', apiError.message || 'Failed to update password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };


  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id) return;

    try {
      // Optimistically update UI
      setPreferences(prev => ({ ...prev, [key]: value }));

      // Update on server
      await updatePreferences(user.id, { [key]: value });
    } catch (error) {
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !value }));
      const apiError = error as ApiError;
      Alert.alert('Error', apiError.message || 'Failed to update preference. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => showPasswordConfirmation(),
        },
      ]
    );
  };

  const showPasswordConfirmation = () => {
    Alert.prompt(
      'Confirm Password',
      'Please enter your password to confirm account deletion:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: (password?: string) => {
            if (password) {
              confirmAccountDeletion(password);
            } else {
              Alert.alert('Error', 'Password is required to delete account');
            }
          },
        },
      ],
      'secure-text'
    );
  };

  const confirmAccountDeletion = async (password: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    try {
      setIsDeletingAccount(true);

      const response = await deleteAccount(user.id, password);

      if (response.success) {
        Alert.alert(
          'Account Deleted',
          'Your account has been successfully deleted. We\'re sorry to see you go.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();
                router.replace('/login');
              },
            },
          ]
        );
      }
    } catch (error: unknown) {
      // Type guard to check if error is ApiError
      const apiError: ApiError = 
        error && typeof error === 'object' && 'message' in error
          ? (error as ApiError)
          : { message: 'Failed to delete account. Please try again.', success: false };
      
      if (apiError.message?.includes('active ride') || apiError.message?.includes('pending booking')) {
        Alert.alert(
          'Cannot Delete Account',
          apiError.message,
          [{ text: 'OK' }]
        );
      } else if (apiError.message?.includes('Password is incorrect')) {
        Alert.alert('Incorrect Password', 'The password you entered is incorrect. Please try again.');
      } else {
        Alert.alert('Error', apiError.message || 'Failed to delete account. Please try again.');
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading profile..." />;
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
        <Text style={styles.headerTitle}>Profile</Text>
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
          {/* Profile Photo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Photo</Text>
            
            <View style={styles.photoContainer}>
              {(photoUrl && photoUrl.trim()) || (user?.photoUrl && user.photoUrl.trim()) ? (
                <CachedImage
                  source={(photoUrl && photoUrl.trim()) || (user?.photoUrl && user.photoUrl.trim()) || ''}
                  style={styles.profileImage}
                  contentFit="cover"
                  placeholder="default"
                  priority="high"
                  cachePolicy="disk"
                  accessibilityLabel="Profile photo"
                  transition={300}
                  onError={() => {
                    // If image fails to load, show placeholder
                    console.log('Failed to load profile image');
                  }}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <IconSymbol size={48} name="person.circle.fill" color="#666666" />
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Photo URL</Text>
              <TextInput
                style={styles.input}
                value={photoUrl}
                onChangeText={(text) => {
                  setPhotoUrl(text);
                  if (errors.photoUrl) {
                    setErrors({ ...errors, photoUrl: undefined });
                  }
                }}
                placeholder="https://example.com/photo.jpg"
                placeholderTextColor="#666666"
                autoCapitalize="none"
                keyboardType="url"
              />
              {errors.photoUrl && <Text style={styles.errorText}>{errors.photoUrl}</Text>}
            </View>
          </View>

          {/* Profile Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[styles.input, errors.fullName && styles.inputError]}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  createFieldChangeHandler('fullName')(text);
                }}
                onBlur={() => createFieldBlurHandler('fullName')(fullName)}
                placeholder="Enter your full name"
                placeholderTextColor="#666666"
                autoCapitalize="words"
              />
              {errors.fullName && (
                <Text style={styles.errorText}>{errors.fullName}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  createFieldChangeHandler('email')(text);
                }}
                onBlur={() => createFieldBlurHandler('email')(email)}
                placeholder="Enter your email"
                placeholderTextColor="#666666"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, errors.phoneNumber && styles.inputError]}
                value={phoneNumber}
                onChangeText={(text) => {
                  setPhoneNumber(text);
                  createFieldChangeHandler('phoneNumber')(text);
                }}
                onBlur={() => createFieldBlurHandler('phoneNumber')(phoneNumber)}
                placeholder="Enter your phone number"
                placeholderTextColor="#666666"
                keyboardType="phone-pad"
              />
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>City (Optional)</Text>
              <TextInput
                style={[styles.input, errors.city && styles.inputError]}
                value={city}
                onChangeText={(text) => {
                  setCity(text);
                  createFieldChangeHandler('city')(text);
                }}
                onBlur={() => createFieldBlurHandler('city')(city)}
                placeholder="Enter your city"
                placeholderTextColor="#666666"
                autoCapitalize="words"
              />
              {errors.city && (
                <Text style={styles.errorText}>{errors.city}</Text>
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

          {/* Change Password Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                style={[styles.input, errors.currentPassword && styles.inputError]}
                value={currentPassword}
                onChangeText={(text) => {
                  setCurrentPassword(text);
                  if (errors.currentPassword) {
                    setErrors({ ...errors, currentPassword: undefined });
                  }
                }}
                placeholder="Enter current password"
                placeholderTextColor="#666666"
                secureTextEntry
                autoCapitalize="none"
                textContentType="none"
                autoComplete="password"
              />
              {errors.currentPassword && (
                <Text style={styles.errorText}>{errors.currentPassword}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={[styles.input, errors.newPassword && styles.inputError]}
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: undefined });
                  }
                }}
                placeholder="Enter new password (min 8 characters)"
                placeholderTextColor="#666666"
                secureTextEntry
                autoCapitalize="none"
                textContentType="none"
                autoComplete="password-new"
              />
              {errors.newPassword && (
                <Text style={styles.errorText}>{errors.newPassword}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                }}
                placeholder="Confirm new password"
                placeholderTextColor="#666666"
                secureTextEntry
                autoCapitalize="none"
                textContentType="none"
                autoComplete="password-new"
              />
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.changePasswordButton, isChangingPassword && styles.changePasswordButtonDisabled]}
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              activeOpacity={0.8}
            >
              {isChangingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.changePasswordButtonText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Notification & Privacy Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications & Privacy</Text>
            
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceLabel}>Booking Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Get notified about new bookings and updates
                </Text>
              </View>
              <Switch
                value={preferences.notifyBookings}
                onValueChange={(value) => handlePreferenceChange('notifyBookings', value)}
                trackColor={{ false: '#2A2A2A', true: '#4285F4' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceLabel}>Message Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Receive alerts for new messages
                </Text>
              </View>
              <Switch
                value={preferences.notifyMessages}
                onValueChange={(value) => handlePreferenceChange('notifyMessages', value)}
                trackColor={{ false: '#2A2A2A', true: '#4285F4' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceLabel}>Ride Update Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Stay informed about ride status changes
                </Text>
              </View>
              <Switch
                value={preferences.notifyRideUpdates}
                onValueChange={(value) => handlePreferenceChange('notifyRideUpdates', value)}
                trackColor={{ false: '#2A2A2A', true: '#4285F4' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceLabel}>Promotional Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Receive updates about offers and features
                </Text>
              </View>
              <Switch
                value={preferences.notifyPromotions}
                onValueChange={(value) => handlePreferenceChange('notifyPromotions', value)}
                trackColor={{ false: '#2A2A2A', true: '#4285F4' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.preferenceRow, styles.lastPreferenceRow]}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceLabel}>Share Location</Text>
                <Text style={styles.preferenceDescription}>
                  Allow riders to see your real-time location during rides
                </Text>
              </View>
              <Switch
                value={preferences.shareLocationEnabled}
                onValueChange={(value) => handlePreferenceChange('shareLocationEnabled', value)}
                trackColor={{ false: '#2A2A2A', true: '#4285F4' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Account Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Actions</Text>
            
            <TouchableOpacity
              style={[styles.deleteAccountButton, isDeletingAccount && styles.deleteAccountButtonDisabled]}
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
              activeOpacity={0.8}
            >
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol size={18} name="trash.fill" color="#FFFFFF" />
                  <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>
            
            <Text style={styles.deleteWarning}>
              Warning: This action is permanent and cannot be undone. All your data will be permanently deleted.
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
    marginBottom: 32,
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
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
  changePasswordButton: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  changePasswordButtonDisabled: {
    opacity: 0.6,
  },
  changePasswordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  photoContainer: {
    alignItems: 'center',
    gap: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    borderWidth: 3,
    borderColor: '#2A2A2A',
  },
  profileImagePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1A1A1A',
    borderWidth: 4,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  uploadPhotoButtonDisabled: {
    opacity: 0.6,
  },
  uploadPhotoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  lastPreferenceRow: {
    borderBottomWidth: 0,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  preferenceDescription: {
    fontSize: 13,
    color: '#999999',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  deleteAccountButtonDisabled: {
    opacity: 0.6,
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  deleteWarning: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: -0.1,
  },
});

