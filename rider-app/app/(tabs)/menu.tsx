import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@/context/UserContext';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { logger } from '@/utils/logger';
import { handleErrorWithAlert } from '@/utils/errorHandler';
import { getRiderProfile } from '@/services/api/profile';

export default function MenuScreen(): React.JSX.Element {
  const { user, setUser, logout } = useUser();
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Refresh user profile if emailVerified is missing
  useEffect(() => {
    const refreshProfileIfNeeded = async () => {
      // Only fetch if user exists but emailVerified is undefined
      if (user && user.emailVerified === undefined && !isLoadingProfile) {
        setIsLoadingProfile(true);
        try {
          logger.debug('Fetching profile to get emailVerified status', undefined, 'menu');
          const profileResponse = await getRiderProfile();
          
          if (profileResponse.success && profileResponse.user) {
            // Update user with emailVerified from profile
            await setUser({
              ...user,
              emailVerified: profileResponse.user.emailVerified,
            });
            logger.debug('User profile updated with emailVerified', { 
              emailVerified: profileResponse.user.emailVerified 
            }, 'menu');
          }
        } catch (error) {
          logger.error('Failed to fetch profile for emailVerified', error, 'menu');
          // Silently fail - don't show error to user
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    refreshProfileIfNeeded();
  }, [user, setUser, isLoadingProfile]);

  const handleSignOut = (): void => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              handleErrorWithAlert(error, { context: 'signOut', title: 'Sign Out Error' });
            }
          },
        },
      ]
    );
  };

  const getFullName = (): string => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    return 'User';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Menu</Text>
          {user && (
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{getFullName()}</Text>
                {/* Show verified badge if emailVerified is true or undefined (default to verified) */}
                {/* Only show unverified if explicitly false */}
                {user.emailVerified === false ? (
                  <View style={styles.unverifiedBadge}>
                    <IconSymbol size={12} name="exclamationmark.triangle.fill" color="#FF9500" />
                    <Text style={styles.unverifiedText}>Unverified</Text>
                  </View>
                ) : (
                  <View style={styles.verifiedBadge}>
                    <IconSymbol size={12} name="checkmark.seal.fill" color="#34C759" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.phoneNumber && (
                <View style={styles.phoneInfo}>
                  <IconSymbol size={14} name="phone" color="#999999" />
                  <Text style={styles.phoneText}>{user.phoneNumber}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/profile')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="person" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Profile</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/payment-methods')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="creditcard" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Payment Methods</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/saved-addresses')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="mappin" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Saved Addresses</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.menuItem, styles.menuItemLast]} 
            activeOpacity={0.7}
            onPress={() => router.push('/help-support')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="envelope" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Help & Support</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.signOutButton} 
          onPress={handleSignOut}
          activeOpacity={0.7}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120, // Space for tab navigator + extra padding
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: -1,
  },
  userInfo: {
    backgroundColor: '#0F0F0F',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
  },
  unverifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  unverifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF9500',
  },
  userEmail: {
    fontSize: 14,
    color: '#999999',
    fontWeight: '400',
    marginBottom: 8,
  },
  phoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 13,
    color: '#999999',
    fontWeight: '500',
  },
  menuSection: {
    marginBottom: 32,
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    gap: 12,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(66, 133, 244, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  signOutButton: {
    marginTop: 40,
    paddingVertical: 16,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

