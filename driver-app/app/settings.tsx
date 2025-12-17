import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = '@waypool_driver_settings';

interface SettingsData {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  locationSharingEnabled: boolean;
}

export default function SettingsScreen(): React.JSX.Element {
  const { user } = useUser();
  const [settings, setSettings] = useState<SettingsData>({
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    locationSharingEnabled: true,
  });
  const [loading, setLoading] = useState(false);

  // Load settings on mount
  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: SettingsData) => {
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const toggleSetting = (key: keyof SettingsData) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear app cache and stored data. You will need to log in again. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'Cache cleared. Please restart the app.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              {user?.phoneNumber ? (
                <TouchableOpacity
                  onPress={() => {
                    const cleanPhone = user.phoneNumber.replace(/\D/g, '');
                    const phoneUrl = Platform.OS === 'ios' ? `telprompt:${cleanPhone}` : `tel:${cleanPhone}`;
                    Linking.canOpenURL(phoneUrl)
                      .then((supported) => {
                        if (supported) {
                          return Linking.openURL(phoneUrl);
                        } else {
                          Alert.alert('Error', 'Unable to make phone call.');
                        }
                      })
                      .catch((err) => {
                        console.error('Error opening phone:', err);
                        Alert.alert('Error', 'Unable to make phone call.');
                      });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.infoValue, styles.phoneLink]}>{user.phoneNumber}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoValue}>N/A</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <IconSymbol size={20} name="person.fill" color="#4285F4" />
              <Text style={styles.settingText}>Edit Profile</Text>
            </View>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <IconSymbol size={20} name="bell.fill" color="#4285F4" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Push Notifications</Text>
                  <Text style={styles.settingSubtext}>Receive booking requests and updates</Text>
                </View>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={() => toggleSetting('notificationsEnabled')}
                trackColor={{ false: '#333333', true: '#4285F4' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <IconSymbol size={20} name="speaker.wave.2.fill" color="#4285F4" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Sound</Text>
                  <Text style={styles.settingSubtext}>Play sounds for notifications</Text>
                </View>
              </View>
              <Switch
                value={settings.soundEnabled}
                onValueChange={() => toggleSetting('soundEnabled')}
                trackColor={{ false: '#333333', true: '#4285F4' }}
                thumbColor="#FFFFFF"
                disabled={!settings.notificationsEnabled}
              />
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <IconSymbol size={20} name="iphone.radiowaves.left.and.right" color="#4285F4" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Vibration</Text>
                  <Text style={styles.settingSubtext}>Vibrate for notifications</Text>
                </View>
              </View>
              <Switch
                value={settings.vibrationEnabled}
                onValueChange={() => toggleSetting('vibrationEnabled')}
                trackColor={{ false: '#333333', true: '#4285F4' }}
                thumbColor="#FFFFFF"
                disabled={!settings.notificationsEnabled}
              />
            </View>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <IconSymbol size={20} name="location.fill" color="#4285F4" />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Share Location</Text>
                  <Text style={styles.settingSubtext}>Share your location with passengers during rides</Text>
                </View>
              </View>
              <Switch
                value={settings.locationSharingEnabled}
                onValueChange={() => toggleSetting('locationSharingEnabled')}
                trackColor={{ false: '#333333', true: '#4285F4' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          
          <TouchableOpacity
            style={styles.settingButton}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <IconSymbol size={20} name="trash.fill" color="#FF3B30" />
              <Text style={[styles.settingText, styles.destructiveText]}>Clear Cache</Text>
            </View>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => router.push('/help-support')}
            activeOpacity={0.7}
          >
            <View style={styles.settingLeft}>
              <IconSymbol size={20} name="questionmark.circle.fill" color="#4285F4" />
              <Text style={styles.settingText}>Help & Support</Text>
            </View>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Waypool Driver App</Text>
          <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
          <Text style={styles.appInfoCopyright}>© 2024 Waypool. All rights reserved.</Text>
        </View>
      </ScrollView>
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#999999',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  settingCard: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  settingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingSubtext: {
    fontSize: 13,
    color: '#999999',
  },
  destructiveText: {
    color: '#FF3B30',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  appInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  appInfoVersion: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  appInfoCopyright: {
    fontSize: 11,
    color: '#666666',
  },
});

