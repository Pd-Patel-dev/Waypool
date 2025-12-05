import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@/context/UserContext';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function MenuScreen(): React.JSX.Element {
  const { user, logout } = useUser();

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
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
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
              <Text style={styles.userName}>{user.fullName}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.carMake && user.carModel && (
                <View style={styles.carInfo}>
                  <IconSymbol size={14} name="car" color="#999999" />
                  <Text style={styles.carText}>
                    {user.carYear} {user.carMake} {user.carModel}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="house" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Profile</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="car" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>My Vehicle</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} activeOpacity={0.7}>
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
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 14,
    color: '#999999',
    fontWeight: '400',
    marginBottom: 8,
  },
  carInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  carText: {
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
