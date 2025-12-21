import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  getRiderProfile,
  updateRiderProfile,
  updateRiderProfilePhoto,
  type UpdateProfileRequest,
} from '@/services/api';

export default function ProfileScreen(): React.JSX.Element {
  const { user, setUser } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    photoUrl: '',
  });

  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    general?: string;
  }>({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const response = await getRiderProfile();
      if (response.success && response.user) {
        const profile = response.user;
        setFormData({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          phoneNumber: profile.phoneNumber || '',
          photoUrl: profile.photoUrl || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      // If API fails, use user data from context as fallback
      if (user) {
        setFormData({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          photoUrl: user.profilePicture || '',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!validatePhoneNumber(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const updateData: UpdateProfileRequest = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
      };

      // Update profile photo if it changed
      if (formData.photoUrl !== (user?.profilePicture || '')) {
        if (formData.photoUrl.trim()) {
          await updateRiderProfilePhoto(formData.photoUrl.trim());
        } else {
          await updateRiderProfilePhoto('');
        }
      }

      const response = await updateRiderProfile(updateData);

      if (response.success && response.user) {
        // Update user context
        await setUser({
          id: user?.id || String(response.user.id),
          email: response.user.email,
          role: user?.role || 'rider',
          firstName: response.user.firstName,
          lastName: response.user.lastName,
          phoneNumber: response.user.phoneNumber || undefined,
          profilePicture: response.user.photoUrl || undefined,
        });

        Alert.alert('Success', 'Profile updated successfully');
        setIsEditing(false);
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    loadProfile(); // Reload original data
    setIsEditing(false);
    setErrors({});
  };

  const getInitials = (): string => {
    const first = formData.firstName.charAt(0).toUpperCase() || '';
    const last = formData.lastName.charAt(0).toUpperCase() || '';
    return first + last || (formData.email.charAt(0).toUpperCase() || 'U');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        {isEditing ? (
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <View style={styles.profilePictureSection}>
          {formData.photoUrl ? (
            <Image source={{ uri: formData.photoUrl }} style={styles.profilePicture} />
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Text style={styles.profilePictureText}>{getInitials()}</Text>
            </View>
          )}
          {isEditing && (
            <View style={styles.photoUrlSection}>
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={() => {
                  Alert.alert(
                    'Change Photo',
                    'Enter a photo URL or remove current photo',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove Photo',
                        style: 'destructive',
                        onPress: () => setFormData({ ...formData, photoUrl: '' }),
                      },
                    ],
                    { cancelable: true }
                  );
                }}
              >
                <IconSymbol name="camera.fill" size={16} color="#FFFFFF" />
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
              <View style={styles.photoUrlInput}>
                <Text style={styles.photoUrlLabel}>Photo URL</Text>
                <TextInput
                  style={styles.photoUrlInputField}
                  value={formData.photoUrl}
                  onChangeText={(text) => setFormData({ ...formData, photoUrl: text })}
                  placeholder="Enter photo URL (optional)"
                  placeholderTextColor="#666666"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={[styles.input, errors.firstName && styles.inputError]}
              value={formData.firstName}
              onChangeText={(text) => {
                setFormData({ ...formData, firstName: text });
                if (errors.firstName) setErrors({ ...errors, firstName: undefined });
              }}
              placeholder="Enter first name"
              placeholderTextColor="#666666"
              editable={isEditing}
            />
            {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={[styles.input, errors.lastName && styles.inputError]}
              value={formData.lastName}
              onChangeText={(text) => {
                setFormData({ ...formData, lastName: text });
                if (errors.lastName) setErrors({ ...errors, lastName: undefined });
              }}
              placeholder="Enter last name"
              placeholderTextColor="#666666"
              editable={isEditing}
            />
            {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="Enter email"
              placeholderTextColor="#666666"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={isEditing}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              value={formData.phoneNumber}
              onChangeText={(text) => {
                setFormData({ ...formData, phoneNumber: text });
                if (errors.phoneNumber) setErrors({ ...errors, phoneNumber: undefined });
              }}
              placeholder="Enter phone number"
              placeholderTextColor="#666666"
              keyboardType="phone-pad"
              editable={isEditing}
            />
            {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
          </View>

          {errors.general && <Text style={styles.generalErrorText}>{errors.general}</Text>}
        </View>

        {/* Save Button */}
        {isEditing && (
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#CCCCCC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1C1C1E',
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#4285F4',
    borderRadius: 12,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photoUrlSection: {
    width: '100%',
    marginTop: 16,
  },
  photoUrlInput: {
    marginTop: 12,
    gap: 8,
  },
  photoUrlLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999999',
  },
  photoUrlInputField: {
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  formSection: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF3B30',
    marginTop: -4,
  },
  generalErrorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

