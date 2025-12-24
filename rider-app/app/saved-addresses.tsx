import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import AddressAutocomplete, { type AddressDetails } from '@/components/AddressAutocomplete';
import {
  getSavedAddresses,
  createSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  type SavedAddress,
  type CreateSavedAddressRequest,
} from '@/services/api';
import { handleErrorSilently, handleErrorWithAlert, ErrorType } from '@/utils/errorHandler';
import type { LocationService } from '@/types/common';
import { Platform } from 'react-native';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import ScreenHeader from '@/components/common/ScreenHeader';

// Conditionally import Location only on native platforms
let Location: LocationService | null = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    // expo-location not available
  }
}

type AddressLabel = 'home' | 'work' | 'custom';

interface AddressFormData {
  label: AddressLabel;
  customLabel: string;
  address: string;
  addressDetails: AddressDetails | null;
}

export default function SavedAddressesScreen(): React.JSX.Element {
  const { user, isLoading: isLoadingUser } = useUser();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [formData, setFormData] = useState<AddressFormData>({
    label: 'home',
    customLabel: '',
    address: '',
    addressDetails: null,
  });

  useEffect(() => {
    if (!isLoadingUser && !user) {
      router.replace('/welcome');
      return;
    }
    if (user) {
      loadAddresses();
      loadCurrentLocation();
    }
  }, [user, isLoadingUser]);

  const loadCurrentLocation = async () => {
    if (Location && Platform.OS !== 'web') {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000,
          });
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        // Silently fail
      }
    }
  };

  const loadAddresses = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const response = await getSavedAddresses();
      if (response.success) {
        setAddresses(response.addresses);
      }
    } catch (error) {
      const appError = handleErrorSilently(error, 'loadSavedAddresses');
      // If unauthorized, redirect to login
      if (appError.type === ErrorType.AUTHENTICATION) {
        Alert.alert(
          'Session Expired',
          'Please log in again to access your saved addresses.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login'),
            },
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to load saved addresses');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAddress = (addressDetails: AddressDetails) => {
    setFormData({ ...formData, addressDetails, address: addressDetails.fullAddress });
  };

  const handleSave = async () => {
    if (!formData.addressDetails) {
      Alert.alert('Error', 'Please select a valid address');
      return;
    }

    if (formData.label === 'custom' && !formData.customLabel.trim()) {
      Alert.alert('Error', 'Please enter a custom label');
      return;
    }

    setIsSaving(true);
    try {
      const label = formData.label === 'custom' ? formData.customLabel.trim().toLowerCase() : formData.label;
      const addressData: CreateSavedAddressRequest = {
        label,
        address: formData.addressDetails.fullAddress,
        city: formData.addressDetails.city || null,
        state: formData.addressDetails.state || null,
        zipCode: formData.addressDetails.zipCode || null,
        latitude: formData.addressDetails.latitude!,
        longitude: formData.addressDetails.longitude!,
        isDefault: false,
      };

      if (editingAddress) {
        await updateSavedAddress(editingAddress.id, addressData);
        Alert.alert('Success', 'Address updated successfully');
      } else {
        await createSavedAddress(addressData);
        Alert.alert('Success', 'Address saved successfully');
      }

      setShowAddModal(false);
      setEditingAddress(null);
      setFormData({
        label: 'home',
        customLabel: '',
        address: '',
        addressDetails: null,
      });
      loadAddresses();
    } catch (error) {
      handleErrorWithAlert(error, {
        context: 'saveAddress',
        title: 'Save Address',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (address: SavedAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label === 'home' || address.label === 'work' ? address.label : 'custom',
      customLabel: address.label !== 'home' && address.label !== 'work' ? address.label : '',
      address: address.address,
      addressDetails: {
        fullAddress: address.address,
        city: address.city || undefined,
        state: address.state || undefined,
        zipCode: address.zipCode || undefined,
        latitude: address.latitude,
        longitude: address.longitude,
      },
    });
    setShowAddModal(true);
  };

  const handleDelete = (address: SavedAddress) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete "${address.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavedAddress(address.id);
              Alert.alert('Success', 'Address deleted successfully');
              loadAddresses();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (address: SavedAddress) => {
    try {
      await updateSavedAddress(address.id, { isDefault: true });
      loadAddresses();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set default address');
    }
  };

  const getLabelDisplay = (label: string): string => {
    if (label === 'home') return 'Home';
    if (label === 'work') return 'Work';
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const getLabelIcon = (label: string): string => {
    if (label === 'home') return 'house.fill';
    if (label === 'work') return 'briefcase.fill';
    return 'mappin.circle.fill';
  };

  if (isLoading || isLoadingUser || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <LoadingState message="Loading addresses..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <ScreenHeader
        title="Saved Addresses"
        rightAction={
          <TouchableOpacity
            onPress={() => {
              setEditingAddress(null);
              setFormData({
                label: 'home',
                customLabel: '',
                address: '',
                addressDetails: null,
              });
              setShowAddModal(true);
            }}
            style={styles.addButton}
          >
            <IconSymbol name="plus" size={20} color="#4285F4" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {addresses.length === 0 ? (
          <EmptyState
            icon="mappin.circle.fill"
            title="No saved addresses"
            description="Save your home, work, or other frequently used addresses to make booking rides faster and easier."
            actionLabel="Add Your First Address"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          addresses.map((address) => (
            <Card key={address.id} style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <View style={styles.addressIcon}>
                  <IconSymbol
                    size={20}
                    name={getLabelIcon(address.label)}
                    color="#4285F4"
                  />
                </View>
                <View style={styles.addressInfo}>
                  <View style={styles.addressLabelRow}>
                    <Text style={styles.addressLabel}>{getLabelDisplay(address.label)}</Text>
                    {address.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {address.address}
                  </Text>
                  {address.city && address.state && (
                    <Text style={styles.addressCity}>{address.city}, {address.state}</Text>
                  )}
                </View>
              </View>
              <View style={styles.addressActions}>
                {!address.isDefault && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleSetDefault(address)}
                  >
                    <IconSymbol name="star" size={16} color="#4285F4" />
                    <Text style={styles.actionButtonText}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEdit(address)}
                >
                  <IconSymbol name="pencil" size={16} color="#4285F4" />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(address)}
                >
                  <IconSymbol name="trash" size={16} color="#FF3B30" />
                  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          setEditingAddress(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <StatusBar style="light" />
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setEditingAddress(null);
                setFormData({
                  label: 'home',
                  customLabel: '',
                  address: '',
                  addressDetails: null,
                });
              }}
              style={styles.modalCloseButton}
            >
              <IconSymbol name="xmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </Text>
            <View style={styles.modalPlaceholder} />
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Label Selection */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Label</Text>
              <View style={styles.labelOptions}>
                <TouchableOpacity
                  style={[
                    styles.labelOption,
                    formData.label === 'home' && styles.labelOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, label: 'home' })}
                >
                  <IconSymbol
                    size={20}
                    name="house.fill"
                    color={formData.label === 'home' ? '#4285F4' : '#999999'}
                  />
                  <Text
                    style={[
                      styles.labelOptionText,
                      formData.label === 'home' && styles.labelOptionTextActive,
                    ]}
                  >
                    Home
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.labelOption,
                    formData.label === 'work' && styles.labelOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, label: 'work' })}
                >
                  <IconSymbol
                    size={20}
                    name="briefcase.fill"
                    color={formData.label === 'work' ? '#4285F4' : '#999999'}
                  />
                  <Text
                    style={[
                      styles.labelOptionText,
                      formData.label === 'work' && styles.labelOptionTextActive,
                    ]}
                  >
                    Work
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.labelOption,
                    formData.label === 'custom' && styles.labelOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, label: 'custom' })}
                >
                  <IconSymbol
                    size={20}
                    name="mappin.circle.fill"
                    color={formData.label === 'custom' ? '#4285F4' : '#999999'}
                  />
                  <Text
                    style={[
                      styles.labelOptionText,
                      formData.label === 'custom' && styles.labelOptionTextActive,
                    ]}
                  >
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {formData.label === 'custom' && (
                <TextInput
                  style={styles.customLabelInput}
                  value={formData.customLabel}
                  onChangeText={(text) => setFormData({ ...formData, customLabel: text })}
                  placeholder="Enter custom label"
                  placeholderTextColor="#666666"
                />
              )}
            </View>

            {/* Address Input */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Address</Text>
              <AddressAutocomplete
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                onSelectAddress={handleSelectAddress}
                placeholder="Enter address"
                currentLocation={currentLocation}
              />
            </View>

            <Button
              title={editingAddress ? 'Update Address' : 'Save Address'}
              onPress={handleSave}
              disabled={isSaving}
              loading={isSaving}
              icon="checkmark.circle.fill"
              fullWidth
              style={styles.saveButton}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    fontWeight: '400',
    color: '#999999',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addressCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2C',
  },
  addressHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  defaultBadge: {
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD60A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  addressCity: {
    fontSize: 13,
    fontWeight: '400',
    color: '#999999',
  },
  addressActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2C',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4285F4',
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2C',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalPlaceholder: {
    width: 40,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  labelOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  labelOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2A2A2C',
  },
  labelOptionActive: {
    borderColor: '#4285F4',
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
  },
  labelOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  labelOptionTextActive: {
    color: '#4285F4',
  },
  customLabelInput: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A2A2C',
    marginTop: 12,
  },
  saveButton: {
    marginTop: 8,
  },
});

