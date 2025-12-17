import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useUser } from '@/context/UserContext';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_BASE_URL } from '@/config/api';
import Constants from 'expo-constants';

export default function MenuScreen(): React.JSX.Element {
  const { user, logout } = useUser();
  const [showDebug, setShowDebug] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<string | null>(null);
  
  const isPhysicalDevice = Constants.isDevice;
  const isSimulator = !isPhysicalDevice || Constants.executionEnvironment === 'storeClient';
  
  const testApiConnection = async () => {
    setApiTestResult('Testing...');
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiTestResult(`✅ Connected! Status: ${data.status}`);
      } else {
        setApiTestResult(`❌ Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      setApiTestResult(`❌ Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

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

        {/* Debug Section */}
        <View style={styles.debugSection}>
          <TouchableOpacity 
            style={styles.debugHeader}
            onPress={() => setShowDebug(!showDebug)}
            activeOpacity={0.7}>
            <View style={styles.debugHeaderLeft}>
              <IconSymbol size={18} name="info.circle" color="#4285F4" />
              <Text style={styles.debugTitle}>API Configuration</Text>
            </View>
            <IconSymbol 
              size={18} 
              name={showDebug ? "chevron.up" : "chevron.down"} 
              color="#666666" 
            />
          </TouchableOpacity>
          
          {showDebug && (
            <View style={styles.debugContent}>
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>API Base URL:</Text>
                <Text style={styles.debugValue} selectable>{API_BASE_URL}</Text>
              </View>
              
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Platform:</Text>
                <Text style={styles.debugValue}>{Platform.OS}</Text>
              </View>
              
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Device Type:</Text>
                <Text style={styles.debugValue}>
                  {isPhysicalDevice && !isSimulator ? '📱 Physical Device' : '💻 Simulator'}
                </Text>
              </View>
              
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Constants.isDevice:</Text>
                <Text style={styles.debugValue}>{String(isPhysicalDevice)}</Text>
              </View>
              
              <View style={styles.debugRow}>
                <Text style={styles.debugLabel}>Environment:</Text>
                <Text style={styles.debugValue}>
                  {Constants.executionEnvironment || 'N/A'}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.testButton}
                onPress={testApiConnection}
                activeOpacity={0.7}>
                <Text style={styles.testButtonText}>Test API Connection</Text>
              </TouchableOpacity>
              
              {apiTestResult && (
                <View style={styles.testResult}>
                  <Text style={styles.testResultText}>{apiTestResult}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/past-rides')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="clock" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Past Rides</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/profile')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="house" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Profile</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/vehicle')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="car" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>My Vehicle</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            activeOpacity={0.7}
            onPress={() => router.push('/help-support')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="questionmark.circle" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Help & Support</Text>
            <IconSymbol size={18} name="chevron.right" color="#666666" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.menuItem, styles.menuItemLast]} 
            activeOpacity={0.7}
            onPress={() => router.push('/settings')}
          >
            <View style={styles.menuItemIcon}>
              <IconSymbol size={20} name="gearshape" color="#4285F4" />
            </View>
            <Text style={styles.menuItemText}>Settings</Text>
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
  debugSection: {
    marginBottom: 24,
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  debugHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  debugContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  debugRow: {
    marginTop: 12,
  },
  debugLabel: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 4,
    fontWeight: '500',
  },
  debugValue: {
    fontSize: 15,
    color: '#4285F4',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  testResult: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  testResultText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
